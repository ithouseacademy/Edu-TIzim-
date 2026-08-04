import json
import logging
from django.shortcuts import render, redirect, get_object_or_404
from django.template.loader import render_to_string
from django.http import JsonResponse, HttpResponse
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.decorators import login_required
from django.contrib.auth.models import User
from django.contrib import messages
from django.db.models import Count, Q, Sum
from django.core.paginator import Paginator, EmptyPage, PageNotAnInteger
from django.utils import timezone
from datetime import date, timedelta, datetime, timezone as dt_timezone
import calendar
from decimal import Decimal
from .models import Course, CourseLevel, Group, Student, MarketingSurvey, StudentLog, LessonTime, Branch, Room, Role, Position, Employee, Attendance, AbsenceReason, GroupLog, StudentBalance, Transaction, StudentLessonPrice, GlobalConfig, ReceiptTemplate, ReceiptSettings, SavedReceipt, Kassa, KassaTransaction, PaymentMethod, SmsHistory
from .forms import LoginForm, CourseForm, CourseLevelForm, GroupForm, StudentCreateForm, StudentEditForm, MarketingSurveyForm, FreezeForm, RemoveFromGroupForm, AddToGroupForm, LessonTimeForm, BranchForm, RoomForm, PositionForm, EmployeeForm
from .sms_service import send_absence_sms, send_payment_received_sms, send_bulk_debt_reminders

logger = logging.getLogger(__name__)


def login_view(request):
    if request.user.is_authenticated:
        try:
            if request.user.employee_profile.role and request.user.employee_profile.role.name == "O'qituvchi":
                return redirect("teacher_dashboard")
        except:
            pass
        return redirect("dashboard")
    form = LoginForm()
    if request.method == "POST":
        phone_raw = request.POST.get("phone", "")
        password = request.POST.get("password", "")
        clean_phone = phone_raw.replace("+998", "").replace(" ", "").strip()
        user = authenticate(request, username=clean_phone, password=password)
        if user:
            login(request, user)
            try:
                if user.employee_profile.role and user.employee_profile.role.name == "O'qituvchi":
                    return redirect("teacher_dashboard")
            except:
                pass
            return redirect("dashboard")
        messages.error(request, "Telefon raqam yoki parol noto'g'ri")
    return render(request, "login.html", {"form": form})


def logout_view(request):
    logout(request)
    return redirect("login")


# ===== BALANCE HELPERS =====

def get_or_create_balance(student):
    balance, _ = StudentBalance.objects.get_or_create(student=student, defaults={"balance": Decimal('0.00')})
    return balance


def get_student_lesson_price(student, group):
    try:
        slp = StudentLessonPrice.objects.get(student=student, group=group)
        return slp.lesson_price
    except StudentLessonPrice.DoesNotExist:
        return group.lesson_price or Decimal('0.00')


def add_balance_transaction(student, amount, transaction_type, group=None, attendance=None, description="", created_by=""):
    balance = get_or_create_balance(student)
    balance.balance += amount
    balance.save()
    Transaction.objects.create(
        student=student,
        amount=amount,
        balance_after=balance.balance,
        transaction_type=transaction_type,
        group=group,
        attendance=attendance,
        description=description,
        created_by=created_by,
    )
    return balance


def should_deduct_for_status(status, group=None):
    """Davomat holatiga qarab pul yechish kerakmi yoki yo'qmi.
    Qoida: faqat 'Keldi' (present) belgilangan dars uchun pul yechiladi.
    Kemagan (absent) va sababli kelmagan (excused) darslardan pul YECHILMAYDI."""
    return status == "present"


def sync_attendance_balance(student, group, attendance, new_status, created_by=""):
    """
    Davomat o'zgartirilganda balansni sinxronlashtiradi.
    
    Qoidalar:
    - Qatnashdi (present) → balansdan yechiladi
    - Sababli kelmadi (excused) → pul yechilmaydi
    - Sababsiz kelmadi (absent) → pul yechilmaydi
    - Belgilanmagan (none) → yechilmaydi
    - Bir dars uchun faqat bir marta to'lov yechiladi
    - Davomat tahrirlanganda avtomatik qayta hisoblanadi
    """
    price = get_student_lesson_price(student, group)

    # Mavjud tranzaksiyalarni tekshirish
    existing_charges = Transaction.objects.filter(
        attendance=attendance,
        transaction_type=Transaction.Type.LESSON,
    )
    total_charged = sum(t.amount for t in existing_charges)  # manfiy summa

    existing_refunds = Transaction.objects.filter(
        attendance=attendance,
        transaction_type=Transaction.Type.CORRECTION,
    )
    total_refunded = sum(t.amount for t in existing_refunds)  # musbat summa

    net_deducted = total_charged + total_refunded  # manfiy yoki 0

    should_deduct_now = should_deduct_for_status(new_status, group)

    if should_deduct_now and net_deducted == 0:
        # Oldin yechilmagan, endi yechish kerak
        add_balance_transaction(
            student=student,
            amount=-price,
            transaction_type=Transaction.Type.LESSON,
            group=group,
            attendance=attendance,
            description=f"{group.name} - {attendance.date} dars",
            created_by=created_by,
        )
    elif not should_deduct_now and net_deducted < 0:
        # Oldin yechilgan edi, endi qaytarish kerak
        refund_amount = abs(net_deducted)
        add_balance_transaction(
            student=student,
            amount=refund_amount,
            transaction_type=Transaction.Type.CORRECTION,
            group=group,
            attendance=attendance,
            description=f"{group.name} - {attendance.date} dars uchun yechilgan summa qaytarildi",
            created_by=created_by,
        )
    # else: hech narsa qilish shart emas


def process_payment(student, amount, description="", created_by="", payment_method=""):
    """
    To'lovni amalga oshiradi. Avval qarzni (minus balans) qoplaydi,
    qolgan summa balansga qo'shiladi.
    """
    balance = get_or_create_balance(student)
    balance.balance += amount
    balance.save()
    transaction = Transaction.objects.create(
        student=student,
        amount=amount,
        balance_after=balance.balance,
        transaction_type=Transaction.Type.PAYMENT,
        payment_method=payment_method,
        description=description,
        created_by=created_by,
    )
    return balance, transaction


def calculate_remaining_month_payment(student):
    balance = get_or_create_balance(student)
    today = date.today()
    last_day = calendar.monthrange(today.year, today.month)[1]
    first_of_month = date(today.year, today.month, 1)
    end_of_month = date(today.year, today.month, last_day)
    total_expected = Decimal('0.00')
    active_groups = student.groups.filter(status='aktiv')
    for group in active_groups:
        price = get_student_lesson_price(student, group)
        if price <= 0:
            continue
        join_date = get_student_join_date(student, group)
        effective_start = first_of_month
        if join_date:
            effective_start = max(first_of_month, join_date)
        lesson_dates = generate_lesson_dates(group, effective_start, end_of_month)
        total_lessons = len(lesson_dates)
        if total_lessons == 0:
            continue
        attended = Attendance.objects.filter(
            student=student, group=group,
            date__gte=effective_start, date__lte=end_of_month
        ).count()
        remaining_lessons = total_lessons - attended
        total_expected += remaining_lessons * price
    remaining = total_expected - balance.balance
    return max(remaining, Decimal('0.00'))


def calculate_expected_payment_up_to_today(student):
    today = date.today()
    first_of_month = date(today.year, today.month, 1)
    _, last_day = calendar.monthrange(today.year, today.month)
    month_end = date(today.year, today.month, last_day)
    total_expected = Decimal('0.00')
    active_groups = student.groups.filter(status='aktiv')
    for group in active_groups:
        price = get_student_lesson_price(student, group)
        if price <= 0:
            continue
        join_date = get_student_join_date(student, group)
        effective_start = first_of_month
        if join_date:
            effective_start = max(first_of_month, join_date)
        lesson_dates = generate_lesson_dates(group, effective_start, month_end)
        total_lessons = len(lesson_dates)
        if total_lessons == 0:
            continue
        total_expected += total_lessons * price
        attended_before = Attendance.objects.filter(
            student=student, group=group,
            date__gte=first_of_month, date__lt=effective_start,
            status='present'
        ).count()
        total_expected += attended_before * price
    return total_expected


def calculate_previous_debt(student):
    today = date.today()
    first_of_month = date(today.year, today.month, 1)

    # O'tgan oy xarajati (dars sanasi bo'yicha)
    prev_cost = Decimal('0.00')
    for att in Attendance.objects.filter(student=student, date__lt=first_of_month):
        if should_deduct_for_status(att.status, att.group):
            prev_cost += get_student_lesson_price(student, att.group)

    from django.db.models import Sum
    # O'tgan oy to'lovlari (tranzaksiya vaqti bo'yicha)
    prev_payments = Transaction.objects.filter(
        student=student,
        transaction_type=Transaction.Type.PAYMENT,
        created_at__lt=first_of_month
    ).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')

    prev_corrections = Transaction.objects.filter(
        student=student,
        transaction_type=Transaction.Type.CORRECTION,
        created_at__lt=first_of_month
    ).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')

    prev_net = prev_payments + prev_corrections - prev_cost
    if prev_net >= 0:
        return Decimal('0.00')

    old_debt = abs(prev_net)
    # Shu oydagi to'lovlar avval eski qarzni yopadi
    payments_this_month = Transaction.objects.filter(
        student=student,
        transaction_type=Transaction.Type.PAYMENT,
        created_at__gte=first_of_month
    ).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')

    return max(Decimal('0.00'), old_debt - payments_this_month)


WEEKDAY_MAP = {0:"dushanba",1:"seshanba",2:"chorshanba",3:"payshanba",4:"juma",5:"shanba",6:"yakshanba"}
WEEKDAY_MAP_REV = {v:k for k,v in WEEKDAY_MAP.items()}


def get_student_join_date(student, group):
    """O'quvchi guruhga qachon qo'shilganini qaytaradi.
    1) StudentLog 'joined' yozuvi
    2) Student yaratilgan sana (created_at)
    3) Bugungi sana (topilmasa - butun oy hisoblanmasligi uchun)
    """
    log = StudentLog.objects.filter(
        student=student, group=group, action="joined"
    ).order_by("created_at").first()
    if log:
        return log.created_at.date()
    if student.created_at:
        return student.created_at.date()
    return date.today()


def _calc_monthly_debts(student):
    monthly_debts = []
    deferred = []
    today = date.today()
    uz_months = {1:"Yanv",2:"Fev",3:"Mart",4:"Apr",5:"May",6:"Iyun",7:"Iyul",8:"Avg",9:"Sen",10:"Okt",11:"Noy",12:"Dek"}
    all_payments = list(Transaction.objects.filter(
        student=student, transaction_type=Transaction.Type.PAYMENT
    ))
    # Har bir to'lovni oylarga taqsimlash.
    # 'pm:2026-05,2026-06' ko'rinishidagi to'lovlar ro'yxatdagi oylarga teng bo'linadi.
    month_payment_alloc = {}
    for tx in all_payments:
        desc = tx.description or ''
        pm_match = None
        if 'pt:' in desc:
            for part in desc.split('|'):
                if part.startswith('pm:'):
                    pm_match = part[3:]
        if pm_match is not None and pm_match.strip():
            months = [mm.strip() for mm in pm_match.split(',') if mm.strip()]
            if months:
                share = tx.amount / Decimal(len(months))
                for mm in months:
                    month_payment_alloc[mm] = month_payment_alloc.get(mm, Decimal('0.00')) + share
                continue
        mkey = tx.created_at.date().strftime('%Y-%m')
        month_payment_alloc[mkey] = month_payment_alloc.get(mkey, Decimal('0.00')) + tx.amount
    # Collect deferred months from payment descriptions
    deferred_months = set()
    for tx in all_payments:
        desc = tx.description or ''
        for part in desc.split('|'):
            if part.startswith('df:'):
                raw = part[3:].strip()
                df_month = raw[:7] if len(raw) >= 7 and raw[4] == '-' else raw
                df_reason = raw[8:] if len(raw) > 7 and raw[4] == '-' else ''
                if df_month and df_month not in deferred_months:
                    deferred_months.add(df_month)
                    if df_reason:
                        reason = df_reason
                    else:
                        reason = desc.split('|reason:')[-1] if '|reason:' in desc else ''
                    deferred.append({"month": df_month, "reason": reason})
    for i in range(11, 0, -1):
        m = today.month - i
        y = today.year
        while m < 1:
            m += 12
            y -= 1
        month_start = date(y, m, 1)
        last_d = calendar.monthrange(y, m)[1]
        month_end = date(y, m, last_d)
        if month_end >= today:
            continue
        month_key = month_start.strftime('%Y-%m')
        cost = Decimal('0.00')
        for att in Attendance.objects.filter(student=student, date__gte=month_start, date__lte=month_end):
            if should_deduct_for_status(att.status, att.group):
                tx_sum = Transaction.objects.filter(
                    attendance=att
                ).exclude(
                    transaction_type=Transaction.Type.PAYMENT
                ).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
                if tx_sum < 0:
                    cost += get_student_lesson_price(student, att.group)
        month_payments = month_payment_alloc.get(month_key, Decimal('0.00'))
        corrections = Transaction.objects.filter(
            student=student,
            transaction_type=Transaction.Type.CORRECTION,
            created_at__gte=month_start, created_at__lt=month_end + timedelta(days=1)
        ).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
        net = cost - month_payments - corrections
        if month_key in deferred_months:
            for d in deferred:
                if d["month"] == month_key:
                    d["label"] = uz_months.get(m, str(m))
                    d["debt"] = float(net) if net > 0 else 0
                    break
            monthly_debts.append({"label": uz_months.get(m, str(m)), "debt": Decimal('0.00'), "month_start": month_start, "deferred": True})
        elif net > 0:
            monthly_debts.append({"label": uz_months.get(m, str(m)), "debt": net, "month_start": month_start})
    return monthly_debts, deferred


def get_lesson_weekdays(group):
    nums = set()
    for lt in group.lesson_times.all():
        for d_name in lt.days.split(","):
            d_name = d_name.strip().lower()
            if d_name in WEEKDAY_MAP_REV:
                nums.add(WEEKDAY_MAP_REV[d_name])
    return nums


def generate_lesson_dates(group, month_start, month_end):
    weekdays = get_lesson_weekdays(group)
    if not weekdays:
        return []
    g_start = group.start_date if group.start_date else month_start
    g_end = group.end_date if group.end_date else month_end
    lesson_start = max(month_start, g_start)
    lesson_end = min(month_end, g_end)
    dates = []
    d = lesson_start
    while d <= lesson_end:
        if d.weekday() in weekdays:
            dates.append(d)
        d += timedelta(days=1)
    return dates


@login_required(login_url="login")
def teacher_dashboard(request):
    try:
        employee = request.user.employee_profile
        if not employee.role or employee.role.name != "O'qituvchi":
            messages.error(request, "Siz o'qituvchi emassiz!")
            return redirect("login")
    except:
        messages.error(request, "Siz o'qituvchi emassiz!")
        return redirect("login")

    now = timezone.localtime(timezone.now())
    current_time = now.time()
    current_weekday = now.weekday()
    weekday_map = {
        0: "dushanba", 1: "seshanba", 2: "chorshanba",
        3: "payshanba", 4: "juma", 5: "shanba", 6: "yakshanba"
    }
    today_uz = weekday_map[current_weekday]

    today_date = timezone.localdate()
    weekdays_uz = {
        0: "Dushanba", 1: "Seshanba", 2: "Chorshanba",
        3: "Payshanba", 4: "Juma", 5: "Shanba", 6: "Yakshanba"
    }
    months_uz = {
        1: "Yanvar", 2: "Fevral", 3: "Mart", 4: "Aprel",
        5: "May", 6: "Iyun", 7: "Iyul", 8: "Avgust",
        9: "Sentabr", 10: "Oktabr", 11: "Noyabr", 12: "Dekabr"
    }
    today_display = f"{weekdays_uz[today_date.weekday()]}, {today_date.day} {months_uz[today_date.month]} {today_date.year}"

    day_filter = request.GET.get("day", "")
    date_filter = request.GET.get("date", "")

    all_teacher_groups = Group.objects.filter(
        teacher=employee, status__in=["aktiv", "kutilyotgan"]
    ).select_related("course", "room").prefetch_related("lesson_times", "students").annotate(
        student_count=Count("students")
    )

    selected_date_display = ""
    if date_filter:
        try:
            from datetime import datetime as dt
            parsed = dt.strptime(date_filter, "%Y-%m-%d")
            wd = weekday_map[parsed.weekday()]
            groups = all_teacher_groups.filter(lesson_times__days__contains=wd)
            day_filter = wd
            selected_date_display = f"{weekdays_uz[parsed.weekday()]}, {parsed.day} {months_uz[parsed.month]} {parsed.year}"
        except:
            groups = all_teacher_groups
    elif day_filter:
        groups = all_teacher_groups.filter(lesson_times__days__contains=day_filter)
    else:
        groups = all_teacher_groups

    groups = groups.distinct().order_by("name")

    today_count = 0
    active_count = 0
    total_students = 0

    group_list = []
    for g in groups:
        if g.is_date_overdue():
            group_list.append({
                "group": g,
                "student_count": g.students.count(),
                "lesson_display": "",
                "status": "expired",
                "nearest_time": None,
            })
            continue

        lesson_times = list(g.lesson_times.all())
        status = "kutilmoqda"
        lesson_display = ""
        nearest_time = None

        students_count = g.students.count()
        total_students += students_count

        for lt in lesson_times:
            days_list = [d.strip().lower() for d in lt.days.split(",") if d.strip()]
            day_matches = today_uz in days_list
            if day_filter:
                day_matches = day_filter in days_list

            day_matches_for_today = today_uz in days_list

            if nearest_time is None or (lt.start_time and (nearest_time is None or lt.start_time < nearest_time)):
                nearest_time = lt.start_time

            if day_matches_for_today:
                today_count += 1
                if lt.start_time <= current_time <= lt.end_time:
                    status = "active"
                    active_count += 1
                elif lt.end_time < current_time:
                    if status != "active":
                        status = "finished"
                elif lt.start_time > current_time:
                    if status not in ("active", "finished"):
                        status = "upcoming"

            if day_filter and day_matches:
                lesson_display = f"{lt.get_days_display()} {lt.start_time.strftime('%H:%M')}-{lt.end_time.strftime('%H:%M')}"
            elif not day_filter:
                lesson_display = f"{lt.get_days_display()} {lt.start_time.strftime('%H:%M')}-{lt.end_time.strftime('%H:%M')}"

        group_list.append({
            "group": g,
            "student_count": students_count,
            "lesson_display": lesson_display or (str(lesson_times[0]) if lesson_times else ""),
            "status": status,
            "nearest_time": nearest_time,
        })

    active_groups = [g for g in group_list if g["status"] == "active"]
    upcoming_groups = [g for g in group_list if g["status"] == "upcoming"]
    finished_groups = [g for g in group_list if g["status"] == "finished"]
    pending_groups = [g for g in group_list if g["status"] == "kutilmoqda"]
    expired_groups = [g for g in group_list if g["status"] == "expired"]

    sorted_groups = active_groups + upcoming_groups + finished_groups + pending_groups + expired_groups

    total_groups = all_teacher_groups.count()

    return render(request, "teacher/dashboard.html", {
        "groups": sorted_groups,
        "employee": employee,
        "selected_day": day_filter,
        "selected_date": date_filter,
        "selected_date_display": selected_date_display,
        "total_groups": total_groups,
        "today_count": today_count,
        "active_count": active_count,
        "total_students": total_students,
        "today_display": today_display,
    })


@login_required(login_url="login")
def teacher_my_groups(request):
    try:
        employee = request.user.employee_profile
        if not employee.role or employee.role.name != "O'qituvchi":
            messages.error(request, "Siz o'qituvchi emassiz!")
            return redirect("login")
    except:
        messages.error(request, "Siz o'qituvchi emassiz!")
        return redirect("login")

    groups = Group.objects.filter(
        teacher=employee, status__in=["aktiv", "kutilyotgan"]
    ).select_related("course", "room").prefetch_related(
        "lesson_times", "students"
    ).annotate(student_count=Count("students")).distinct().order_by("name")

    from datetime import datetime, date
    now = datetime.now()
    current_time = now.time()
    current_weekday = now.weekday()
    weekday_map = {0:"dushanba",1:"seshanba",2:"chorshanba",3:"payshanba",4:"juma",5:"shanba",6:"yakshanba"}
    today_uz = weekday_map[current_weekday]

    group_list = []
    for g in groups:
        if g.is_date_overdue():
            group_list.append({"group":g,"student_count":g.students.count(),"lesson_display":"","status":"expired","nearest_time":None})
            continue
        lesson_times = list(g.lesson_times.all())
        status = "kutilmoqda"
        lesson_display = ""
        nearest_time = None
        for lt in lesson_times:
            days_list = [d.strip().lower() for d in lt.days.split(",") if d.strip()]
            if nearest_time is None or (lt.start_time and lt.start_time < nearest_time):
                nearest_time = lt.start_time
            if today_uz in days_list:
                if lt.start_time <= current_time <= lt.end_time:
                    status = "active"
                elif lt.end_time < current_time:
                    if status != "active":
                        status = "finished"
                elif lt.start_time > current_time:
                    if status not in ("active","finished"):
                        status = "upcoming"
            lesson_display = f"{lt.get_days_display()} {lt.start_time.strftime('%H:%M')}-{lt.end_time.strftime('%H:%M')}"
        group_list.append({"group":g,"student_count":g.students.count(),"lesson_display":lesson_display,"status":status,"nearest_time":nearest_time})

    return render(request, "teacher/my_groups.html", {
        "groups": group_list,
        "employee": employee,
    })


@login_required(login_url="login")
def admin_mobile_groups(request):
    is_admin = request.user.is_staff or request.user.is_superuser
    if not is_admin:
        emp = getattr(request.user, 'employee_profile', None)
        if emp is None or not emp.role or emp.role.name != "O'qituvchi":
            is_admin = True
    if not is_admin:
        messages.error(request, "Siz admin emassiz!")
        return redirect("login")

    groups = Group.objects.filter(
        status__in=["aktiv", "kutilyotgan"]
    ).select_related("course", "room", "teacher").prefetch_related(
        "lesson_times", "students"
    ).annotate(student_count=Count("students")).distinct().order_by("name")

    from datetime import datetime, date
    now = datetime.now()
    current_time = now.time()
    current_weekday = now.weekday()
    weekday_map = {0:"dushanba",1:"seshanba",2:"chorshanba",3:"payshanba",4:"juma",5:"shanba",6:"yakshanba"}
    today_uz = weekday_map[current_weekday]

    # Only today's groups
    groups = groups.filter(lesson_times__days__contains=today_uz)

    group_list = []
    for g in groups:
        if g.is_date_overdue():
            continue
        lesson_times = list(g.lesson_times.all())
        status = "kutilmoqda"
        lesson_display = ""
        nearest_time = None
        for lt in lesson_times:
            days_list = [d.strip().lower() for d in lt.days.split(",") if d.strip()]
            if nearest_time is None or (lt.start_time and lt.start_time < nearest_time):
                nearest_time = lt.start_time
            if today_uz in days_list:
                if lt.start_time <= current_time <= lt.end_time:
                    status = "active"
                elif lt.end_time < current_time:
                    if status != "active":
                        status = "finished"
                elif lt.start_time > current_time:
                    if status not in ("active","finished"):
                        status = "upcoming"
            lesson_display = f"{lt.get_days_display()} {lt.start_time.strftime('%H:%M')}-{lt.end_time.strftime('%H:%M')}"
        group_list.append({"group":g,"student_count":g.students.count(),"lesson_display":lesson_display,"status":status,"nearest_time":nearest_time})

    return render(request, "teacher/admin_mobile_groups.html", {
        "groups": group_list,
    })


@login_required(login_url="login")
def teacher_group_detail(request, pk):
    try:
        employee = request.user.employee_profile
    except:
        messages.error(request, "Siz o'qituvchi emassiz!")
        return redirect("login")

    group = get_object_or_404(
        Group.objects.select_related("course", "room").prefetch_related("lesson_times", "students"),
        pk=pk, teacher=employee
    )
    students = group.students.all().order_by("first_name")

    from datetime import date
    today_attendances = Attendance.objects.filter(group=group, date=date.today())
    attendance_map = {a.student_id: a.status for a in today_attendances}
    attendance_notes = {a.student_id: a.notes for a in today_attendances if a.notes}

    # find today's lesson time
    weekday_map = {0:"dushanba",1:"seshanba",2:"chorshanba",3:"payshanba",4:"juma",5:"shanba",6:"yakshanba"}
    today_uz = weekday_map[date.today().weekday()]
    today_lesson = group.lesson_times.filter(days__contains=today_uz).first()

    absence_reasons = AbsenceReason.objects.filter(is_active=True).order_by("order", "name")

    return render(request, "teacher/group_detail.html", {
        "group": group,
        "students": students,
        "employee": employee,
        "attendance_map": attendance_map,
        "attendance_notes": attendance_notes,
        "absence_reasons": absence_reasons,
        "today_lesson": today_lesson,
    })


from django.views.decorators.csrf import csrf_exempt
@login_required(login_url="login")
@csrf_exempt
def take_attendance(request):
    if request.method != "POST":
        return JsonResponse({"error": "POST required"}, status=405)
    import json
    from datetime import datetime, time as dt_time
    try:
        data = json.loads(request.body)
    except:
        return JsonResponse({"error": "Invalid JSON"}, status=400)

    group_id = data.get("group_id")
    records = data.get("records", [])  # [{student_id, status}]

    try:
        employee = request.user.employee_profile
    except:
        employee = None

    is_admin = request.user.is_staff or request.user.is_superuser
    # Non-staff users with non-teacher role are also admins
    if not is_admin and (employee is None or not employee.role or employee.role.name != "O'qituvchi"):
        is_admin = True
    group = get_object_or_404(Group, pk=group_id)
    today = date.today()
    # Guruh muddati tugagan bo'lsa davomatni o'zgartirish mumkin emas
    if group.end_date and group.end_date < today:
        return JsonResponse({"error": "Guruh muddati tugagan, davomatni o'zgartirish mumkin emas"}, status=403)
    allow_dated = data.get("allow_dated", False)

    # Permission check
    if is_admin:
        # Admin can save attendance for any group
        pass
    else:
        # Teacher can only save for their own groups
        if employee is None or group.teacher_id != employee.id:
            return JsonResponse({"error": "Siz o'qituvchi emassiz!"}, status=403)
        # Teacher time restriction
        weekday_map = {0:"dushanba",1:"seshanba",2:"chorshanba",3:"payshanba",4:"juma",5:"shanba",6:"yakshanba"}
        today_uz = weekday_map[today.weekday()]
        now = datetime.now().time()
        allowed = False
        for lt in group.lesson_times.all():
            for d_name in lt.days.split(","):
                if d_name.strip() == today_uz:
                    if lt.start_time and lt.end_time:
                        if lt.start_time <= now <= lt.end_time:
                            allowed = True
                            break
            if allowed:
                break
        if not allowed:
            return JsonResponse({"error": "Dars vaqti ichida bo'lmaganda davomatni o'zgartira olmaysiz!"}, status=403)

    student_ids_in_records = set()
    created_by = ''
    if employee:
        created_by = f"{employee.first_name} {employee.last_name or ''}".strip()
    elif request.user.is_staff:
        emp = getattr(request.user, 'employee_profile', None)
        if emp:
            created_by = f"{emp.first_name} {emp.last_name or ''}".strip()
        if not created_by or created_by.replace('+', '').replace(' ', '').isdigit():
            created_by = request.user.get_full_name()
        if not created_by or created_by.replace('+', '').replace(' ', '').isdigit():
            created_by = "Admin"
    for rec in records:
        student_id = rec.get("student_id")
        status = rec.get("status", "present")
        rec_date = rec.get("date")
        if allow_dated and rec_date:
            try:
                rec_date = date.fromisoformat(rec_date)
            except:
                rec_date = today
        else:
            rec_date = today

        # Teacher can only save for today
        if not is_admin and rec_date != today:
            return JsonResponse({"error": "Faqat bugungi davomatni o'zgartira olasiz!"}, status=403)

        # Guruh tugash sanasidan keyingi davomatni saqlash mumkin emas
        if group.end_date and rec_date > group.end_date:
            return JsonResponse({"error": "Guruh muddati tugagan, davomatni o'zgartirish mumkin emas"}, status=403)

        if status == "none":
            old_att = Attendance.objects.filter(
                group=group, student_id=student_id, date=rec_date
            ).first()
            if old_att:
                # Agar eski davomat "present" bo'lsa, qaytarish kerak
                old_status = old_att.status
                try:
                    student_obj = Student.objects.get(pk=student_id)
                    # Eski davomatni o'chirishdan oldin balansni sinxronlash
                    sync_attendance_balance(student_obj, group, old_att, "none", created_by)
                except Student.DoesNotExist:
                    pass
                old_att.delete()
            continue
        student_ids_in_records.add(student_id)
        notes = rec.get("notes", "") or ""
        attendance, created = Attendance.objects.update_or_create(
            group=group,
            student_id=student_id,
            date=rec_date,
            defaults={"status": status, "teacher": employee, "notes": notes, "created_by": created_by}
        )
        # Balansni sinxronlash (yaratilgan yoki yangilangan bo'lishidan qat'iy nazar)
        try:
            student_obj = Student.objects.get(pk=student_id)
            sync_attendance_balance(student_obj, group, attendance, status, created_by)
            if status == "absent":
                date_display = rec_date.strftime("%d.%m.%Y") if hasattr(rec_date, "strftime") else str(rec_date)
                send_absence_sms(student_obj, group=group, date_str=date_display, created_by=created_by)
        except Student.DoesNotExist:
            pass

    # Tegilmagan o'quvchilarni "Keldi" qilib saqlash
    if not allow_dated:
        for student in group.students.all():
            if student.id not in student_ids_in_records:
                attendance, _ = Attendance.objects.update_or_create(
                    group=group,
                    student_id=student.id,
                    date=today,
                    defaults={"status": "present", "teacher": employee, "notes": "", "created_by": created_by}
                )
                # Balansni sinxronlash
                sync_attendance_balance(student, group, attendance, "present", created_by)

    return JsonResponse({"ok": True})



@login_required(login_url="login")
def teacher_attendance_desktop(request, pk):
    is_admin = request.user.is_staff or request.user.is_superuser
    if not is_admin:
        employee = getattr(request.user, 'employee_profile', None)
        if employee is None or not employee.role or employee.role.name != "O'qituvchi":
            is_admin = True

    if is_admin:
        group = get_object_or_404(
            Group.objects.select_related("course", "room", "teacher"),
            pk=pk
        )
        employee = getattr(request.user, 'employee_profile', None)
    else:
        try:
            employee = request.user.employee_profile
        except:
            messages.error(request, "Siz o'qituvchi emassiz!")
            return redirect("login")

        group = get_object_or_404(
            Group.objects.select_related("course", "room", "teacher"),
            pk=pk, teacher=employee
        )
    students = group.students.all().order_by("first_name")

    # Month/year from query string, default to current
    today = date.today()
    sel_year = int(request.GET.get("year", today.year))
    sel_month = int(request.GET.get("month", today.month))
    sel_month = max(1, min(12, sel_month))

    # Generate lesson dates for the selected month
    _, last_day = calendar.monthrange(sel_year, sel_month)
    month_start = date(sel_year, sel_month, 1)
    month_end = date(sel_year, sel_month, last_day)

    lesson_dates = generate_lesson_dates(group, month_start, month_end)

    # Build attendance matrix: {student_id: {date_str: status}}
    attendances = Attendance.objects.filter(group=group, date__gte=month_start, date__lte=month_end)
    att_matrix = {}
    att_notes = {}
    for a in attendances:
        sid = a.student_id
        if sid not in att_matrix:
            att_matrix[sid] = {}
        att_matrix[sid][a.date.isoformat()] = a.status
        if a.notes:
            if sid not in att_notes:
                att_notes[sid] = {}
            att_notes[sid][a.date.isoformat()] = a.notes

    # Stats for the month
    total = students.count()
    present_count = sum(1 for a in attendances if a.status == "present")
    absent_count = sum(1 for a in attendances if a.status == "absent")
    excused_count = sum(1 for a in attendances if a.status == "excused")
    total_marked = present_count + absent_count + excused_count

    def pct(n): return round((n / total * 100)) if total else 0

    # Build month options for selector
    months_uz = ["Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun", "Iyul", "Avgust", "Sentabr", "Oktabr", "Noyabr", "Dekabr"]

    # Check if teacher can edit (only during lesson time)
    from datetime import datetime
    can_edit = True if is_admin else False
    if not is_admin:
        weekday_map = {0:"dushanba",1:"seshanba",2:"chorshanba",3:"payshanba",4:"juma",5:"shanba",6:"yakshanba"}
        today_uz = weekday_map[today.weekday()]
        now = datetime.now().time()
        for lt in group.lesson_times.all():
            for d_name in lt.days.split(","):
                if d_name.strip() == today_uz:
                    if lt.start_time and lt.end_time:
                        if lt.start_time <= now <= lt.end_time:
                            can_edit = True
                            break
            if can_edit:
                break

    absence_reasons = AbsenceReason.objects.filter(is_active=True).order_by("order", "name")

    # Today's groups for mobile group picker (admin only)
    today_groups = []
    if is_admin:
        from datetime import datetime
        now = datetime.now()
        weekday_map = {0:"dushanba",1:"seshanba",2:"chorshanba",3:"payshanba",4:"juma",5:"shanba",6:"yakshanba"}
        today_uz = weekday_map[now.weekday()]
        qs = Group.objects.filter(status__in=["aktiv","kutilyotgan"], lesson_times__days__contains=today_uz).select_related("course","teacher").annotate(sc=Count("students")).distinct().order_by("name")
        for g in qs:
            today_groups.append({"id":g.id,"name":g.name,"course":g.course.name,"teacher_name":str(g.teacher),"sc":g.sc,"active":g.id==group.id})

    # Per-student latest absence reason (for the "Sabab" column)
    student_last_reason = {}
    for a in attendances.filter(status__in=['absent', 'excused']).exclude(notes__exact='').order_by('-date'):
        if a.student_id not in student_last_reason:
            student_last_reason[a.student_id] = a.notes

    # Per-student full attendance history
    status_labels = {'absent': 'Kelmadi', 'excused': 'Sababli', 'present': 'Keldi'}
    student_att_history = {}
    for a in attendances.order_by('-created_at'):
        sid = a.student_id
        if sid not in student_att_history:
            student_att_history[sid] = []
        teacher_name = ''
        if a.teacher:
            teacher_name = (a.teacher.first_name or '') + ' ' + (a.teacher.last_name or '')
            teacher_name = teacher_name.strip()
        elif a.created_by:
            teacher_name = a.created_by
        tashkent_tz = dt_timezone(timedelta(hours=5))
        day_names = {0:'Du',1:'Se',2:'Cho',3:'Pay',4:'Ju',5:'Sha',6:'Yak'}
        student_att_history[sid].append({
            'date': a.date.isoformat(),
            'datetime': a.created_at.astimezone(tashkent_tz).strftime('%d.%m.%Y %H:%M'),
            'day_name': day_names[a.date.weekday()],
            'status': status_labels.get(a.status, a.status),
            'notes': a.notes or '',
            'teacher': teacher_name,
        })

    return render(request, "teacher/attendance_desktop.html", {
        "group": group,
        "students": students,
        "employee": employee,
        "lesson_dates": lesson_dates,
        "att_matrix": att_matrix,
        "att_notes": att_notes,
        "student_last_reason": student_last_reason,
        "sel_year": sel_year,
        "sel_month": sel_month,
        "months_uz": months_uz,
        "years": range(2024, 2031),
        "today": today,
        "total": total,
        "present_count": present_count,
        "absent_count": absent_count,
        "excused_count": excused_count,
        "total_marked": total_marked,
        "student_last_reason": student_last_reason,
        "student_att_history": student_att_history,
        "is_admin": is_admin,
        "can_edit": can_edit,
        "lessons_count": len(lesson_dates),
        "absence_reasons": absence_reasons,
        "today_groups": today_groups,
    })


@login_required(login_url="login")
def dashboard(request):
    try:
        if request.user.employee_profile.role and request.user.employee_profile.role.name == "O'qituvchi":
            return redirect("teacher_dashboard")
    except:
        pass
    course_count = Course.objects.count()
    group_count = Group.objects.count()
    student_count = Student.objects.count()
    survey_count = MarketingSurvey.objects.count()
    active_groups = Group.objects.filter(status="aktiv").count()
    pending_groups = Group.objects.filter(status="kutilyotgan").count()
    pending_student_count = Student.objects.filter(groups__isnull=True, status="kutilyotgan").count()
    recent_students = Student.objects.prefetch_related("groups").order_by("-created_at")[:5]
    survey_stats = MarketingSurvey.objects.annotate(
        student_count=Count("students")
    ).filter(student_count__gt=0).order_by("-student_count")
    return render(request, "dashboard.html", {
        "course_count": course_count,
        "group_count": group_count,
        "student_count": student_count,
        "survey_count": survey_count,
        "active_groups": active_groups,
        "pending_groups": pending_groups,
        "pending_student_count": pending_student_count,
        "recent_students": recent_students,
        "survey_stats": survey_stats,
    })


@login_required(login_url="login")
def course_list(request):
    courses = Course.objects.filter(is_active=True).annotate(group_count=Count("groups")).order_by("-created_at")
    return render(request, "course/list.html", {"courses": courses})


@login_required(login_url="login")
def course_create(request):
    form = CourseForm()
    if request.method == "POST":
        form = CourseForm(request.POST)
        if form.is_valid():
            form.save()
            messages.success(request, "Kurs muvaffaqiyatli qo'shildi")
            return redirect("course_list")
    return render(request, "course/form.html", {"form": form, "title": "Kurs qo'shish"})


@login_required(login_url="login")
def course_update(request, pk):
    course = get_object_or_404(Course, pk=pk)
    form = CourseForm(instance=course)
    if request.method == "POST":
        form = CourseForm(request.POST, instance=course)
        if form.is_valid():
            form.save()
            messages.success(request, "Kurs muvaffaqiyatli yangilandi")
            return redirect("course_list")
    return render(request, "course/form.html", {"form": form, "title": "Kursni tahrirlash"})


@login_required(login_url="login")
def course_delete(request, pk):
    course = get_object_or_404(Course, pk=pk)
    if request.method == "POST":
        course.delete()
        messages.success(request, "Kurs muvaffaqiyatli o'chirildi (faolligi bekor qilindi)")
        return redirect("course_list")
    return render(request, "course/delete.html", {"object": course, "title": "Kursni o'chirish"})


@login_required(login_url="login")
def course_level_list(request):
    levels = CourseLevel.objects.select_related("course").order_by("course", "name")
    return render(request, "course_level/list.html", {"levels": levels})


@login_required(login_url="login")
def course_level_create(request):
    form = CourseLevelForm()
    if request.method == "POST":
        form = CourseLevelForm(request.POST)
        if form.is_valid():
            form.save()
            messages.success(request, "Daraja muvaffaqiyatli qo'shildi")
            return redirect("course_level_list")
    return render(request, "course_level/form.html", {"form": form, "title": "Daraja qo'shish"})


@login_required(login_url="login")
def course_level_update(request, pk):
    level = get_object_or_404(CourseLevel, pk=pk)
    form = CourseLevelForm(instance=level)
    if request.method == "POST":
        form = CourseLevelForm(request.POST, instance=level)
        if form.is_valid():
            form.save()
            messages.success(request, "Daraja muvaffaqiyatli yangilandi")
            return redirect("course_level_list")
    return render(request, "course_level/form.html", {"form": form, "title": "Darajani tahrirlash"})


@login_required(login_url="login")
def course_level_delete(request, pk):
    level = get_object_or_404(CourseLevel, pk=pk)
    if request.method == "POST":
        level.delete()
        messages.success(request, "Daraja muvaffaqiyatli o'chirildi (faolligi bekor qilindi)")
        return redirect("course_level_list")
    return render(request, "course_level/delete.html", {"object": level, "title": "Darajani o'chirish"})


@login_required(login_url="login")
def api_course_levels(request):
    course_id = request.GET.get("course_id")
    if not course_id:
        return JsonResponse({"levels": []})
    levels = CourseLevel.objects.filter(course_id=course_id).values("id", "name", "daily_price")
    return JsonResponse({"levels": list(levels)})


@login_required(login_url="login")
def group_list(request):
    status = request.GET.get("status")
    day = request.GET.get("day")
    day_type = request.GET.get("day_type")
    time_from = request.GET.get("time_from")
    time_to = request.GET.get("time_to")
    course_id = request.GET.get("course")
    level_id = request.GET.get("level")
    teacher_id = request.GET.get("teacher")
    room_id = request.GET.get("room")
    search = request.GET.get("search")

    if status == "arxivlangan":
        status_filter = ["arxivlangan"]
        page_title = "Arxivlangan guruhlar"
    else:
        status_filter = ["aktiv", "kutilyotgan"]
        page_title = "Oddiy guruhlar"

    groups = Group.objects.filter(is_active=True).select_related("course", "room", "teacher").prefetch_related(
        "lesson_times"
    ).annotate(
        student_count=Count("students")
    ).filter(status__in=status_filter)

    if day_type:
        groups = groups.filter(day_type=day_type)

    if day:
        groups = groups.filter(lesson_times__days__contains=day)

    if time_from:
        groups = groups.filter(lesson_times__start_time__gte=time_from)

    if time_to:
        groups = groups.filter(lesson_times__end_time__lte=time_to)

    if course_id:
        groups = groups.filter(course_id=course_id)

    if level_id:
        groups = groups.filter(level_id=level_id)

    if teacher_id:
        groups = groups.filter(teacher_id=teacher_id)

    if room_id:
        groups = groups.filter(room_id=room_id)

    if search:
        groups = groups.filter(name__icontains=search)

    groups = groups.distinct().order_by("-created_at")

    courses = Course.objects.filter(is_active=True)
    levels = CourseLevel.objects.filter(is_active=True).select_related("course")
    teachers = Employee.objects.filter(is_active=True, is_deleted=False, role__name="O'qituvchi")
    rooms = Room.objects.filter(is_active=True)

    today = date.today()
    today_weekday_num = today.weekday()
    WEEKDAY_MAP = {0:"dushanba",1:"seshanba",2:"chorshanba",3:"payshanba",4:"juma",5:"shanba",6:"yakshanba"}
    today_uz = WEEKDAY_MAP[today_weekday_num]
    now_time = timezone.localtime(timezone.now()).time()

    today_attendance_list = []
    for g in groups:
        has_lesson_today = False
        lesson_end_time = None
        for lt in g.lesson_times.all():
            days = [d.strip().lower() for d in lt.days.split(",")]
            if today_uz in days:
                has_lesson_today = True
                if lt.end_time and (lesson_end_time is None or lt.end_time > lesson_end_time):
                    lesson_end_time = lt.end_time

        if not has_lesson_today:
            today_attendance_list.append((g.id, "no_lesson"))
            continue

        if g.end_date and g.end_date < today:
            today_attendance_list.append((g.id, "expired"))
            continue

        att_count = Attendance.objects.filter(group=g, date=today).count()
        student_count = g.students.count()

        if att_count > 0:
            if att_count >= student_count:
                today_attendance_list.append((g.id, "done"))
            else:
                today_attendance_list.append((g.id, "partial"))
        else:
            if lesson_end_time and now_time > lesson_end_time:
                today_attendance_list.append((g.id, "missed"))
            else:
                today_attendance_list.append((g.id, "pending"))

    today_attendance_dict = dict(today_attendance_list)

    return render(request, "group/list.html", {
        "groups": groups,
        "page_title": page_title,
        "courses": courses,
        "levels": levels,
        "teachers": teachers,
        "rooms": rooms,
        "today_attendance_dict": today_attendance_dict,
        "today": today,
    })


def _log_group_action(group, action, description, request=None, user=None):
    created_by = ""
    if request and request.user.is_authenticated:
        employee = getattr(request.user, 'employee_profile', None)
        if employee:
            created_by = f"{employee.first_name} {employee.last_name or ''}".strip()
        else:
            created_by = request.user.username or ""
    elif user:
        created_by = str(user)
    GroupLog.objects.create(group=group, action=action, description=description, created_by=created_by)


def _resolve_created_by(value):
    """Saqlangan 'kim' qiymatini chiroyli ko'rinishga keltiradi.
    Agar qiymat username bo'lib, foydalanuvchida ism-familiya bo'lsa — o'sha ism qaytariladi.
    Aks holda saqlangan qiymat o'zi qaytariladi (admin o'chirilgan bo'lsa ham yo'qolmaydi)."""
    if not value:
        return ""
    if value == "Avtomatik":
        return value
    user = User.objects.filter(username=value).first()
    if user:
        name = f"{user.first_name} {user.last_name}".strip()
        if name:
            return name
    return value


def _log_student_action(student, group, action, reason="", request=None, user=None):
    """O'quvchi harakatini log qiladi.

    Harakatni bajargan adminning ism-familiyasi matn ko'rinishida saqlanadi,
    shuning uchun admin o'chirilganda ham log yo'qolmaydi.
    """
    created_by = ""
    if request and request.user.is_authenticated:
        employee = getattr(request.user, 'employee_profile', None)
        if employee:
            created_by = f"{employee.first_name} {employee.last_name or ''}".strip()
        else:
            created_by = request.user.username or ""
    elif user:
        created_by = str(user)
    StudentLog.objects.create(
        student=student, group=group, action=action,
        reason=reason, created_by=created_by,
    )


@login_required(login_url="login")
def group_create(request):
    form = GroupForm()
    if request.method == "POST":
        form = GroupForm(request.POST)
        if form.is_valid():
            group = form.save()
            teacher_name = str(group.teacher) if group.teacher else "Belgilanmagan"
            _log_group_action(group, "created", f"{group.name} (O'qituvchi: {teacher_name}, Kurs: {group.course.name})", request)
            messages.success(request, "Guruh muvaffaqiyatli qo'shildi")
            return redirect("group_list")
    return render(request, "group/form.html", {"form": form, "title": "Guruh qo'shish"})


@login_required(login_url="login")
def group_update(request, pk):
    group = get_object_or_404(Group, pk=pk)
    form = GroupForm(instance=group)
    if request.method == "POST":
        old_teacher = str(group.teacher) if group.teacher else "-"
        old_course = str(group.course) if group.course else "-"
        old_room = str(group.room) if group.room else "-"
        old_start = group.start_date
        old_end = group.end_date
        form = GroupForm(request.POST, instance=group)
        if form.is_valid():
            form.save()
            changes = []
            new_teacher = str(group.teacher) if group.teacher else "-"
            new_course = str(group.course) if group.course else "-"
            new_room = str(group.room) if group.room else "-"
            if old_teacher != new_teacher:
                changes.append(f"O'qituvchi: {old_teacher} → {new_teacher}")
            if old_course != new_course:
                changes.append(f"Kurs: {old_course} → {new_course}")
            if old_room != new_room:
                changes.append(f"Xona: {old_room} → {new_room}")
            if old_start != group.start_date:
                changes.append(f"Boshlanish: {old_start} → {group.start_date}")
            if old_end != group.end_date:
                changes.append(f"Tugash: {old_end} → {group.end_date}")
            desc = "; ".join(changes) if changes else "Guruh tahrirlandi"
            _log_group_action(group, "updated", f"{group.name} — {desc}", request)
            messages.success(request, "Guruh muvaffaqiyatli yangilandi")
            return redirect("group_list")
    return render(request, "group/form.html", {"form": form, "title": "Guruhni tahrirlash"})


@login_required(login_url="login")
def group_delete(request, pk):
    group = get_object_or_404(Group, pk=pk)
    if request.method == "POST":
        _log_group_action(group, "deleted", f"Guruh o'chirildi: {group.name}", request)
        group.delete()
        messages.success(request, "Guruh muvaffaqiyatli o'chirildi (faolligi bekor qilindi)")
        return redirect("group_list")
    return render(request, "group/delete.html", {"object": group, "title": "Guruhni o'chirish"})


@login_required(login_url="login")
def group_extend(request, pk):
    group = get_object_or_404(Group, pk=pk)
    if request.method == "POST":
        days = request.POST.get("days")
        if days and days.isdigit() and int(days) > 0:
            from datetime import timedelta
            old_end = group.end_date
            group.end_date += timedelta(days=int(days))
            group.save()
            _log_group_action(group, "extended", f"Guruh muddati {days} kunga uzaytirildi ({old_end} → {group.end_date})", request)
            messages.success(request, f"Guruh muddati {days} kunga uzaytirildi")
            return redirect("group_detail", pk=group.pk)
        messages.error(request, "Kunlar sonini to'g'ri kiriting")
    return render(request, "group/extend.html", {"group": group})


@login_required(login_url="login")
def student_list(request):
    from django.db.models import Count, Q

    search = request.GET.get("search", "").strip()
    status_filter = request.GET.get("status", "")
    group_id = request.GET.get("group", "")

    students = Student.objects.filter(is_deleted=False).prefetch_related("groups", "marketing_survey").annotate(
        group_count=Count("groups")
    ).order_by("-created_at")

    if search:
        q_filter = Q(first_name__icontains=search) | Q(last_name__icontains=search)
        digits_only = ''.join(c for c in search if c.isdigit())
        if digits_only:
            q_filter |= Q(phone__icontains=digits_only)
        students = students.filter(q_filter)

    if status_filter == "aktiv":
        students = students.filter(groups__isnull=False).exclude(status="chiqarilgan").exclude(frozen_until__gte=date.today())
    elif status_filter == "muzlatilgan":
        students = students.filter(frozen_until__gte=date.today())
    elif status_filter == "kutilyotgan":
        students = students.filter(groups__isnull=True, status="kutilyotgan")
    elif status_filter == "chiqarilgan":
        students = students.filter(status="chiqarilgan")

    if group_id:
        students = students.filter(groups__id=group_id)

    students = students.distinct()

    total_count = Student.objects.count()
    active_count = Student.objects.filter(groups__isnull=False).exclude(status="chiqarilgan").exclude(frozen_until__gte=date.today()).distinct().count()
    frozen_count = Student.objects.filter(frozen_until__gte=date.today()).distinct().count()
    pending_count = Student.objects.filter(groups__isnull=True, status="kutilyotgan").distinct().count()

    student_data = []
    for s in students:
        try:
            balance = get_or_create_balance(s)
            bal_val = float(balance.balance)
        except Exception:
            bal_val = 0.0
        active_groups = s.groups.filter(status='aktiv')
        groups_info = []
        for g in active_groups:
            groups_info.append({'name': g.name, 'id': g.pk})
        age_val = None
        if s.birth_date:
            age_val = (date.today() - s.birth_date).days // 365
        student_data.append({
            'id': s.pk,
            'first_name': s.first_name,
            'last_name': s.last_name,
            'phone': s.phone,
            'balance': bal_val,
            'groups': groups_info,
            'group_count': active_groups.count(),
            'is_frozen': s.frozen_until is not None and s.frozen_until >= date.today(),
            'status': s.status,
            'birth_date': s.birth_date,
            'age': age_val,
            'category': s.marketing_survey.name if s.marketing_survey else "",
            'father_phone': s.father_phone or "",
            'mother_phone': s.mother_phone or "",
            'created_at': s.created_at,
        })

    groups = Group.objects.filter(status__in=["aktiv", "kutilyotgan"]).order_by("name")

    return render(request, "student/list.html", {
        "students": student_data,
        "groups": groups,
        "total_count": total_count,
        "active_count": active_count,
        "frozen_count": frozen_count,
        "pending_count": pending_count,
        "active_filters": {
            "search": search,
            "status": status_filter,
            "group": group_id,
        },
    })


@login_required(login_url="login")
def student_filter(request):
    from django.db.models import Count, Q
    from datetime import datetime as dt_parse

    search = request.GET.get("search", "").strip()
    status_filter = request.GET.get("status", "")
    group_id = request.GET.get("group", "")
    date_from = request.GET.get("date_from", "")
    date_to = request.GET.get("date_to", "")
    debtor_only = request.GET.get("debtor_only", "")
    course_id = request.GET.get("course", "")
    level_id = request.GET.get("level", "")
    teacher_id = request.GET.get("teacher", "")
    moderator_name = request.GET.get("moderator", "")
    category_id = request.GET.get("category", "")
    source_id = request.GET.get("source", "")
    student_id = request.GET.get("student", "")
    group_count_filter = request.GET.get("group_count", "")
    day_filter = request.GET.get("day", "")
    day_type_filter = request.GET.get("day_type", "")
    frozen_only = request.GET.get("frozen_only", "")
    app_status = request.GET.get("app_status", "")
    age_from = request.GET.get("age_from", "")
    age_to = request.GET.get("age_to", "")
    balance_filter = request.GET.get("balance_filter", "")

    students = Student.objects.prefetch_related("groups", "groups__teacher", "groups__level", "groups__course", "marketing_survey").annotate(
        group_count=Count("groups", filter=Q(groups__status="aktiv"))
    ).order_by("-created_at")

    if search:
        q_filter = Q(first_name__icontains=search) | Q(last_name__icontains=search)
        digits_only = ''.join(c for c in search if c.isdigit())
        if digits_only:
            q_filter |= Q(phone__icontains=digits_only)
        students = students.filter(q_filter)

    if status_filter == "aktiv":
        students = students.filter(groups__isnull=False).exclude(status="chiqarilgan").exclude(frozen_until__gte=date.today())
    elif status_filter == "muzlatilgan":
        students = students.filter(frozen_until__gte=date.today())
    elif status_filter == "kutilyotgan":
        students = students.filter(groups__isnull=True, status="kutilyotgan")
    elif status_filter == "chiqarilgan":
        students = students.filter(status="chiqarilgan")

    if group_id:
        students = students.filter(groups__id=group_id)

    if course_id:
        students = students.filter(groups__course__id=course_id)

    if level_id:
        students = students.filter(groups__level__id=level_id)

    if teacher_id:
        students = students.filter(groups__teacher__id=teacher_id)

    if moderator_name:
        students = students.filter(transactions__created_by__icontains=moderator_name)

    if category_id:
        students = students.filter(marketing_survey__id=category_id)

    if source_id:
        students = students.filter(marketing_survey__id=source_id)

    if student_id:
        students = students.filter(pk=student_id)

    if day_filter:
        students = students.filter(groups__lesson_times__days__icontains=day_filter)

    if day_type_filter:
        students = students.filter(groups__day_type=day_type_filter)

    if date_from:
        try:
            df = date.fromisoformat(date_from)
            students = students.filter(created_at__date__gte=df)
        except (ValueError, TypeError):
            pass

    if date_to:
        try:
            dt = date.fromisoformat(date_to)
            students = students.filter(created_at__date__lte=dt)
        except (ValueError, TypeError):
            pass

    if frozen_only == "1":
        students = students.filter(frozen_until__gte=date.today())

    if app_status == "installed":
        students = students.filter(telegram_chat_id__isnull=False).exclude(telegram_chat_id="")
    elif app_status == "not_installed":
        students = students.filter(Q(telegram_chat_id__isnull=True) | Q(telegram_chat_id=""))

    today = date.today()
    if age_from:
        try:
            af = int(age_from)
            max_birth = today.replace(year=today.year - af)
            students = students.filter(birth_date__lte=max_birth)
        except (ValueError, TypeError):
            pass

    if age_to:
        try:
            at = int(age_to)
            min_birth = today.replace(year=today.year - at - 1)
            students = students.filter(birth_date__gt=min_birth)
        except (ValueError, TypeError):
            pass

    students = students.distinct()

    student_data = []
    for s in students:
        try:
            balance = get_or_create_balance(s)
            bal_val = float(balance.balance)
        except Exception:
            bal_val = 0.0
        try:
            remaining = calculate_remaining_month_payment(s)
            rem_val = float(remaining)
        except Exception:
            rem_val = 0.0
        try:
            expected_up_to_today = calculate_expected_payment_up_to_today(s)
            exp_val = float(expected_up_to_today)
        except Exception:
            exp_val = 0.0
        try:
            prev_debt = calculate_previous_debt(s)
            prev_debt_val = float(prev_debt)
        except Exception:
            prev_debt_val = 0.0
        active_groups = s.groups.filter(status='aktiv')
        groups_info = []
        for g in active_groups:
            try:
                price = float(get_student_lesson_price(s, g))
            except Exception:
                price = 0.0
            groups_info.append({'name': g.name, 'price': price, 'id': g.pk})
        age_val = None
        if s.birth_date:
            age_val = (today - s.birth_date).days // 365
        monthly_payment_val = sum(gi['price'] for gi in groups_info)
        debt_amount_val = abs(bal_val) if bal_val < 0 else 0.0
        # Compute shu_kungacha / oy_oxirigacha
        rem_cost_no_bal = Decimal('0.00')
        for g in active_groups:
            p = get_student_lesson_price(s, g)
            if p <= 0:
                continue
            join_date = get_student_join_date(s, g)
            eff_start = month_start
            if join_date:
                eff_start = max(month_start, join_date)
            tomorrow = today + timedelta(days=1)
            rem_dates = generate_lesson_dates(g, tomorrow, month_end)
            rem_cost_no_bal += Decimal(str(len(rem_dates))) * p
        up_to_cost = Decimal(str(exp_val)) - rem_cost_no_bal
        if up_to_cost < 0:
            up_to_cost = Decimal('0.00')
        shu_k_val = float(up_to_cost)
        oy_ox_k_val = rem_val
        student_data.append({
            'id': s.pk,
            'first_name': s.first_name,
            'last_name': s.last_name,
            'phone': s.phone,
            'balance': bal_val,
            'remaining_month_payment': rem_val,
            'expected_up_to_today': exp_val,
            'previous_debt': prev_debt_val,
            'shu_kungacha': shu_k_val,
            'oy_oxirigacha': oy_ox_k_val,
            'monthly_payment': monthly_payment_val,
            'debt_amount': debt_amount_val,
            'groups': groups_info,
            'group_count': active_groups.count(),
            'is_frozen': s.frozen_until is not None and s.frozen_until >= date.today(),
            'status': s.status,
            'birth_date': s.birth_date.strftime("%d.%m.%Y") if s.birth_date else "",
            'age': age_val,
            'has_app': bool(s.telegram_chat_id),
            'category': s.marketing_survey.name if s.marketing_survey else "",
            'created_at': s.created_at.strftime("%d.%m.%Y") if s.created_at else "",
        })

    # Jami statistika - doimo filtrsiz hisoblanadi
    all_total_count = len(student_data)
    all_debtor_count = len([s for s in student_data if s['balance'] < 0])
    all_creditor_count = len([s for s in student_data if s['balance'] > 0])
    all_zero_count = all_total_count - all_debtor_count - all_creditor_count
    all_total_debt = sum(s['debt_amount'] for s in student_data)
    all_total_credit = sum(s['balance'] for s in student_data if s['balance'] > 0)

    # Filtrlash
    if debtor_only == "1" or balance_filter == "debtor":
        student_data = [s for s in student_data if s['balance'] < 0]
    elif balance_filter == "creditor":
        student_data = [s for s in student_data if s['balance'] > 0]
    elif balance_filter == "zero":
        student_data = [s for s in student_data if s['balance'] == 0]
    elif balance_filter == "paid":
        student_data = [s for s in student_data if s['balance'] >= 0]

    if group_count_filter:
        try:
            gc = int(group_count_filter)
            student_data = [s for s in student_data if s['group_count'] == gc]
        except (ValueError, TypeError):
            pass

    total_count = len(student_data)

    groups = Group.objects.filter(status__in=["aktiv", "kutilyotgan"]).order_by("name")
    courses = Course.objects.all().order_by("name")
    levels = CourseLevel.objects.all().order_by("course__name", "name")
    teachers = Employee.objects.filter(teacher_groups__isnull=False).distinct().order_by("first_name")
    categories = MarketingSurvey.objects.all().order_by("name")
    all_students = Student.objects.all().order_by("first_name")

    return render(request, "student/filter.html", {
        "students": student_data,
        "students_json": json.dumps(student_data, ensure_ascii=False),
        "groups": groups,
        "courses": courses,
        "levels": levels,
        "teachers": teachers,
        "categories": categories,
        "all_students": all_students,
        "total_count": all_total_count,
        "debtor_count": all_debtor_count,
        "creditor_count": all_creditor_count,
        "total_debt": all_total_debt,
        "total_credit": all_total_credit,
        "payment_methods": PaymentMethod.objects.filter(is_active=True),
        "zero_count": all_zero_count,
        "filtered_count": total_count,
        "active_filters": {
            "search": search,
            "status": status_filter,
            "group": group_id,
            "date_from": date_from,
            "date_to": date_to,
            "debtor_only": debtor_only,
            "course": course_id,
            "level": level_id,
            "teacher": teacher_id,
            "moderator": moderator_name,
            "category": category_id,
            "source": source_id,
            "student": student_id,
            "group_count": group_count_filter,
            "day": day_filter,
            "day_type": day_type_filter,
            "frozen_only": frozen_only,
            "app_status": app_status,
            "age_from": age_from,
            "age_to": age_to,
            "balance_filter": balance_filter,
        },
        "paper_width": ReceiptSettings.get_instance().paper_width,
        "paper_height": ReceiptSettings.get_instance().paper_height,
        "paper_padding": ReceiptSettings.get_instance().paper_padding,
        "font_name": ReceiptSettings.get_instance().font_name,
        "font_tagline": ReceiptSettings.get_instance().font_tagline,
        "font_title": ReceiptSettings.get_instance().font_title,
        "font_row": ReceiptSettings.get_instance().font_row,
        "font_amount_label": ReceiptSettings.get_instance().font_amount_label,
        "font_amount": ReceiptSettings.get_instance().font_amount,
        "font_balance": ReceiptSettings.get_instance().font_balance,
        "font_thanks": ReceiptSettings.get_instance().font_thanks,
        "font_footer": ReceiptSettings.get_instance().font_footer,
        "font_contact": ReceiptSettings.get_instance().font_contact,
        "font_notes": ReceiptSettings.get_instance().font_notes,
    })


@login_required(login_url="login")
def student_export_excel(request):
    import openpyxl
    from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
    from django.http import HttpResponse

    students = Student.objects.prefetch_related("groups", "marketing_survey").annotate(
        group_count=Count("groups")
    ).order_by("-created_at")

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "O'quvchilar"

    headers = [
        "#", "Ism", "Familya", "Telefon", "Guruhlar",
        "Guruhlar soni", "Holat", "Tug'ilgan sana",
        "Ota ism", "Ota nomer", "Ona ism", "Ona nomer",
        "Qo'shilgan sana"
    ]

    header_font = Font(bold=True, color="FFFFFF", size=11)
    header_fill = PatternFill(start_color="2563EB", end_color="2563EB", fill_type="solid")
    thin_border = Border(
        left=Side(style='thin', color='D1D5DB'),
        right=Side(style='thin', color='D1D5DB'),
        top=Side(style='thin', color='D1D5DB'),
        bottom=Side(style='thin', color='D1D5DB'),
    )

    for col, h in enumerate(headers, 1):
        cell = ws.cell(row=1, column=col, value=h)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = Alignment(horizontal='center', vertical='center')
        cell.border = thin_border

    for i, s in enumerate(students, 1):
        groups_str = ", ".join(g.name for g in s.groups.all()) if s.groups.exists() else "-"
        if s.is_frozen:
            status = "Muzlatilgan"
        elif s.groups.exists():
            status = "Aktiv"
        elif s.status == "chiqarilgan":
            status = "Chiqarilgan"
        else:
            status = "Kutilyotgan"
        row = [
            i, s.first_name, s.last_name, s.phone, groups_str,
            s.group_count, status,
            s.birth_date.strftime("%d.%m.%Y") if s.birth_date else "-",
            s.father_full_name or "-", s.father_phone or "-",
            s.mother_full_name or "-", s.mother_phone or "-",
            s.created_at.strftime("%d.%m.%Y") if s.created_at else "-",
        ]
        for col, val in enumerate(row, 1):
            cell = ws.cell(row=i+1, column=col, value=val)
            cell.border = thin_border
            cell.alignment = Alignment(vertical='center')

    ws.column_dimensions['A'].width = 5
    ws.column_dimensions['B'].width = 18
    ws.column_dimensions['C'].width = 18
    ws.column_dimensions['D'].width = 20
    ws.column_dimensions['E'].width = 35
    ws.column_dimensions['F'].width = 12
    ws.column_dimensions['G'].width = 14
    ws.column_dimensions['H'].width = 14
    ws.column_dimensions['I'].width = 22
    ws.column_dimensions['J'].width = 20
    ws.column_dimensions['K'].width = 22
    ws.column_dimensions['L'].width = 20
    ws.column_dimensions['M'].width = 14

    response = HttpResponse(
        content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )
    response['Content-Disposition'] = 'attachment; filename="oquvchilar.xlsx"'
    wb.save(response)
    return response


@login_required(login_url="login")
def student_export_csv(request):
    import csv
    from django.http import HttpResponse

    students = Student.objects.prefetch_related("groups", "marketing_survey").annotate(
        group_count=Count("groups")
    ).order_by("-created_at")

    response = HttpResponse(content_type='text/csv; charset=utf-8')
    response['Content-Disposition'] = 'attachment; filename="oquvchilar.csv"'
    response.write('\ufeff')

    writer = csv.writer(response)
    writer.writerow([
        "#", "Ism", "Familya", "Telefon", "Guruhlar",
        "Guruhlar soni", "Holat", "Tug'ilgan sana",
        "Ota ism", "Ota nomer", "Ona ism", "Ona nomer",
        "Qo'shilgan sana"
    ])

    for i, s in enumerate(students, 1):
        groups_str = ", ".join(g.name for g in s.groups.all()) if s.groups.exists() else "-"
        if s.is_frozen:
            status = "Muzlatilgan"
        elif s.groups.exists():
            status = "Aktiv"
        elif s.status == "chiqarilgan":
            status = "Chiqarilgan"
        else:
            status = "Kutilyotgan"
        writer.writerow([
            i, s.first_name, s.last_name, s.phone, groups_str,
            s.group_count, status,
            s.birth_date.strftime("%d.%m.%Y") if s.birth_date else "-",
            s.father_full_name or "-", s.father_phone or "-",
            s.mother_full_name or "-", s.mother_phone or "-",
            s.created_at.strftime("%d.%m.%Y") if s.created_at else "-",
        ])
    return response


def _write_csv(response, headers, rows):
    import csv
    response.write('\ufeff')
    writer = csv.writer(response)
    writer.writerow(headers)
    for row in rows:
        writer.writerow(row)
    return response


@login_required(login_url="login")
def group_export_excel(request):
    import openpyxl
    from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
    groups = Group.objects.select_related("course", "teacher", "room").prefetch_related("lesson_times").annotate(student_count=Count("students"))
    wb = openpyxl.Workbook(); ws = wb.active; ws.title = "Guruhlar"
    headers = ["#","Nomi","Kurs","O'qituvchi","Xona","Kunlar","Vaqt","Talabalar","Holat","Boshlanish","Tugash"]
    hf = Font(bold=True,color="FFFFFF",size=11); hfl = PatternFill(start_color="2563EB",end_color="2563EB",fill_type="solid")
    tb = Border(left=Side(style='thin',color='D1D5DB'),right=Side(style='thin',color='D1D5DB'),top=Side(style='thin',color='D1D5DB'),bottom=Side(style='thin',color='D1D5DB'))
    for c,h in enumerate(headers,1):
        cell = ws.cell(row=1,column=c,value=h); cell.font = hf; cell.fill = hfl; cell.alignment = Alignment(horizontal='center',vertical='center'); cell.border = tb
    for i,g in enumerate(groups,1):
        lt = g.lesson_times.first(); days = lt.days if lt else ""; time = f"{lt.start_time}—{lt.end_time}" if lt else ""
        teacher = f"{g.teacher.first_name} {g.teacher.last_name}" if g.teacher else "-"
        row = [i,g.name,g.course.name if g.course else "-",teacher,g.room.name if g.room else "-",days,time,g.student_count,g.get_status_display(),g.start_date.strftime('%d.%m.%Y') if g.start_date else '-',g.end_date.strftime('%d.%m.%Y') if g.end_date else '-']
        for c,v in enumerate(row,1): cell = ws.cell(row=i+1,column=c,value=v); cell.border = tb; cell.alignment = Alignment(vertical='center')
    for col,w in [(1,5),(2,25),(3,18),(4,22),(5,14),(6,14),(7,14),(8,10),(9,14),(10,14),(11,14)]: ws.column_dimensions[chr(64+col)].width = w
    response = HttpResponse(content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    response['Content-Disposition'] = 'attachment; filename="guruhlar.xlsx"'; wb.save(response); return response

@login_required(login_url="login")
def group_export_csv(request):
    groups = Group.objects.select_related("course","teacher","room").prefetch_related("lesson_times").annotate(student_count=Count("students"))
    headers = ["#","Nomi","Kurs","O'qituvchi","Xona","Kunlar","Vaqt","Talabalar","Holat","Boshlanish","Tugash"]
    rows = []
    for i,g in enumerate(groups,1):
        lt = g.lesson_times.first(); days = lt.days if lt else ""; time = f"{lt.start_time}—{lt.end_time}" if lt else ""
        teacher = f"{g.teacher.first_name} {g.teacher.last_name}" if g.teacher else "-"
        rows.append([i,g.name,g.course.name if g.course else "-",teacher,g.room.name if g.room else "-",days,time,g.student_count,g.get_status_display(),g.start_date.strftime('%d.%m.%Y') if g.start_date else '-',g.end_date.strftime('%d.%m.%Y') if g.end_date else '-'])
    response = HttpResponse(content_type='text/csv; charset=utf-8')
    response['Content-Disposition'] = 'attachment; filename="guruhlar.csv"'
    return _write_csv(response, headers, rows)

@login_required(login_url="login")
def employee_export_excel(request):
    import openpyxl
    from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
    employees = Employee.objects.prefetch_related("branches").select_related("position","role").all().order_by("-created_at")
    wb = openpyxl.Workbook(); ws = wb.active; ws.title = "Xodimlar"
    headers = ["#","Ism","Familya","Telefon","Lavozim","Rol","Filiallar","Qo'shilgan sana"]
    hf = Font(bold=True,color="FFFFFF",size=11); hfl = PatternFill(start_color="2563EB",end_color="2563EB",fill_type="solid")
    tb = Border(left=Side(style='thin',color='D1D5DB'),right=Side(style='thin',color='D1D5DB'),top=Side(style='thin',color='D1D5DB'),bottom=Side(style='thin',color='D1D5DB'))
    for c,h in enumerate(headers,1): cell = ws.cell(row=1,column=c,value=h); cell.font = hf; cell.fill = hfl; cell.alignment = Alignment(horizontal='center',vertical='center'); cell.border = tb
    for i,e in enumerate(employees,1):
        branches = ", ".join(b.name for b in e.branches.all()) if e.branches.exists() else "-"
        row = [i,e.first_name,e.last_name,e.phone,e.position.name if e.position else "-",e.role.name if e.role else "-",branches,e.created_at.strftime('%d.%m.%Y') if e.created_at else '-']
        for c,v in enumerate(row,1): cell = ws.cell(row=i+1,column=c,value=v); cell.border = tb; cell.alignment = Alignment(vertical='center')
    for col,w in [(1,5),(2,18),(3,18),(4,20),(5,22),(6,18),(7,22),(8,14)]: ws.column_dimensions[chr(64+col)].width = w
    response = HttpResponse(content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    response['Content-Disposition'] = 'attachment; filename="xodimlar.xlsx"'; wb.save(response); return response

@login_required(login_url="login")
def employee_export_csv(request):
    employees = Employee.objects.prefetch_related("branches").select_related("position","role").all().order_by("-created_at")
    headers = ["#","Ism","Familya","Telefon","Lavozim","Rol","Filiallar","Qo'shilgan sana"]
    rows = []
    for i,e in enumerate(employees,1):
        branches = ", ".join(b.name for b in e.branches.all()) if e.branches.exists() else "-"
        rows.append([i,e.first_name,e.last_name,e.phone,e.position.name if e.position else "-",e.role.name if e.role else "-",branches,e.created_at.strftime('%d.%m.%Y') if e.created_at else '-'])
    response = HttpResponse(content_type='text/csv; charset=utf-8')
    response['Content-Disposition'] = 'attachment; filename="xodimlar.csv"'
    return _write_csv(response, headers, rows)

@login_required(login_url="login")
def pending_export_excel(request):
    import openpyxl
    from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
    students = Student.objects.filter(groups__isnull=True, status="kutilyotgan").prefetch_related("desired_course").order_by("-created_at")
    wb = openpyxl.Workbook(); ws = wb.active; ws.title = "Kutilyotganlar"
    headers = ["#","Ism","Familya","Telefon","Istagan kurslari","Qo'shilgan sana"]
    hf = Font(bold=True,color="FFFFFF",size=11); hfl = PatternFill(start_color="2563EB",end_color="2563EB",fill_type="solid")
    tb = Border(left=Side(style='thin',color='D1D5DB'),right=Side(style='thin',color='D1D5DB'),top=Side(style='thin',color='D1D5DB'),bottom=Side(style='thin',color='D1D5DB'))
    for c,h in enumerate(headers,1): cell = ws.cell(row=1,column=c,value=h); cell.font = hf; cell.fill = hfl; cell.alignment = Alignment(horizontal='center',vertical='center'); cell.border = tb
    for i,s in enumerate(students,1):
        course_names = ", ".join(c.name for c in s.desired_course.all()) or "-"
        row = [i,s.first_name,s.last_name,s.phone or "-",course_names,s.created_at.strftime('%d.%m.%Y') if s.created_at else '-']
        for c,v in enumerate(row,1): cell = ws.cell(row=i+1,column=c,value=v); cell.border = tb; cell.alignment = Alignment(vertical='center')
    for col,w in [(1,5),(2,18),(3,18),(4,20),(5,22),(6,14)]: ws.column_dimensions[chr(64+col)].width = w
    response = HttpResponse(content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    response['Content-Disposition'] = 'attachment; filename="kutilyotganlar.xlsx"'; wb.save(response); return response

@login_required(login_url="login")
def pending_export_csv(request):
    students = Student.objects.filter(groups__isnull=True, status="kutilyotgan").prefetch_related("desired_course").order_by("-created_at")
    headers = ["#","Ism","Familya","Telefon","Istagan kurslari","Qo'shilgan sana"]
    rows = [[i,s.first_name,s.last_name,s.phone or "-",", ".join(c.name for c in s.desired_course.all()) or "-",s.created_at.strftime('%d.%m.%Y') if s.created_at else '-'] for i,s in enumerate(students,1)]
    response = HttpResponse(content_type='text/csv; charset=utf-8')
    response['Content-Disposition'] = 'attachment; filename="kutilyotganlar.csv"'
    return _write_csv(response, headers, rows)

@login_required(login_url="login")
def graduated_export_excel(request):
    import openpyxl
    from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
    students = Student.objects.filter(graduated_groups__isnull=False).prefetch_related("graduated_groups","groups").distinct().order_by("-created_at")
    wb = openpyxl.Workbook(); ws = wb.active; ws.title = "Bitirilganlar"
    headers = ["#","Ism","Familya","Telefon","Bitirgan guruhlari","Hozirgi guruhlari","Qo'shilgan sana"]
    hf = Font(bold=True,color="FFFFFF",size=11); hfl = PatternFill(start_color="2563EB",end_color="2563EB",fill_type="solid")
    tb = Border(left=Side(style='thin',color='D1D5DB'),right=Side(style='thin',color='D1D5DB'),top=Side(style='thin',color='D1D5DB'),bottom=Side(style='thin',color='D1D5DB'))
    for c,h in enumerate(headers,1): cell = ws.cell(row=1,column=c,value=h); cell.font = hf; cell.fill = hfl; cell.alignment = Alignment(horizontal='center',vertical='center'); cell.border = tb
    for i,s in enumerate(students,1):
        grad = ", ".join(g.name for g in s.graduated_groups.all()) or "-"
        curr = ", ".join(g.name for g in s.groups.all()) or "-"
        row = [i,s.first_name,s.last_name,s.phone or "-",grad,curr,s.created_at.strftime('%d.%m.%Y') if s.created_at else '-']
        for c,v in enumerate(row,1): cell = ws.cell(row=i+1,column=c,value=v); cell.border = tb; cell.alignment = Alignment(vertical='center')
    for col,w in [(1,5),(2,18),(3,18),(4,20),(5,35),(6,25),(7,14)]: ws.column_dimensions[chr(64+col)].width = w
    response = HttpResponse(content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    response['Content-Disposition'] = 'attachment; filename="bitirilganlar.xlsx"'; wb.save(response); return response

@login_required(login_url="login")
def graduated_export_csv(request):
    students = Student.objects.filter(graduated_groups__isnull=False).prefetch_related("graduated_groups","groups").distinct().order_by("-created_at")
    headers = ["#","Ism","Familya","Telefon","Bitirgan guruhlari","Hozirgi guruhlari","Qo'shilgan sana"]
    rows = []
    for i,s in enumerate(students,1):
        grad = ", ".join(g.name for g in s.graduated_groups.all()) or "-"
        curr = ", ".join(g.name for g in s.groups.all()) or "-"
        rows.append([i,s.first_name,s.last_name,s.phone or "-",grad,curr,s.created_at.strftime('%d.%m.%Y') if s.created_at else '-'])
    response = HttpResponse(content_type='text/csv; charset=utf-8')
    response['Content-Disposition'] = 'attachment; filename="bitirilganlar.csv"'
    return _write_csv(response, headers, rows)


@login_required(login_url="login")
def group_detail_export_excel(request, pk):
    import openpyxl
    from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
    group = get_object_or_404(Group, pk=pk)
    students = group.students.prefetch_related("groups").annotate(total_groups=Count("groups"))
    wb = openpyxl.Workbook(); ws = wb.active; ws.title = f"Guruh {group.name}"
    headers = ["#","Ism","Familya","Telefon","Guruhlari","Guruhlar soni","Qo'shilgan sana"]
    hf = Font(bold=True,color="FFFFFF",size=11); hfl = PatternFill(start_color="2563EB",end_color="2563EB",fill_type="solid")
    tb = Border(left=Side(style='thin',color='D1D5DB'),right=Side(style='thin',color='D1D5DB'),top=Side(style='thin',color='D1D5DB'),bottom=Side(style='thin',color='D1D5DB'))
    for c,h in enumerate(headers,1): cell = ws.cell(row=1,column=c,value=h); cell.font = hf; cell.fill = hfl; cell.alignment = Alignment(horizontal='center',vertical='center'); cell.border = tb
    for i,s in enumerate(students,1):
        groups_str = ", ".join(g.name for g in s.groups.all()) if s.groups.exists() else "-"
        row = [i,s.first_name,s.last_name,s.phone or "-",groups_str,s.total_groups,s.created_at.strftime('%d.%m.%Y') if s.created_at else '-']
        for c,v in enumerate(row,1): cell = ws.cell(row=i+1,column=c,value=v); cell.border = tb; cell.alignment = Alignment(vertical='center')
    for col,w in [(1,5),(2,18),(3,18),(4,20),(5,35),(6,12),(7,14)]: ws.column_dimensions[chr(64+col)].width = w
    response = HttpResponse(content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    response['Content-Disposition'] = f'attachment; filename="guruh_{group.name}_oquvchilar.xlsx"'; wb.save(response); return response

@login_required(login_url="login")
def group_detail_export_csv(request, pk):
    group = get_object_or_404(Group, pk=pk)
    students = group.students.prefetch_related("groups").annotate(total_groups=Count("groups"))
    headers = ["#","Ism","Familya","Telefon","Guruhlari","Guruhlar soni","Qo'shilgan sana"]
    rows = []
    for i,s in enumerate(students,1):
        groups_str = ", ".join(g.name for g in s.groups.all()) if s.groups.exists() else "-"
        rows.append([i,s.first_name,s.last_name,s.phone or "-",groups_str,s.total_groups,s.created_at.strftime('%d.%m.%Y') if s.created_at else '-'])
    response = HttpResponse(content_type='text/csv; charset=utf-8')
    response['Content-Disposition'] = f'attachment; filename="guruh_{group.name}_oquvchilar.csv"'
    return _write_csv(response, headers, rows)


@login_required(login_url="login")
def room_export_excel(request):
    import openpyxl
    from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
    rooms = Room.objects.filter(is_active=True).order_by("-created_at")
    wb = openpyxl.Workbook(); ws = wb.active; ws.title = "Xonalar"
    headers = ["#","Xona nomi","Yaratilgan sana"]
    hf = Font(bold=True,color="FFFFFF",size=11); hfl = PatternFill(start_color="2563EB",end_color="2563EB",fill_type="solid")
    tb = Border(left=Side(style='thin',color='D1D5DB'),right=Side(style='thin',color='D1D5DB'),top=Side(style='thin',color='D1D5DB'),bottom=Side(style='thin',color='D1D5DB'))
    for c,h in enumerate(headers,1): cell = ws.cell(row=1,column=c,value=h); cell.font = hf; cell.fill = hfl; cell.alignment = Alignment(horizontal='center',vertical='center'); cell.border = tb
    for i,r in enumerate(rooms,1):
        row = [i,r.name,r.created_at.strftime('%d.%m.%Y') if r.created_at else '-']
        for c,v in enumerate(row,1): cell = ws.cell(row=i+1,column=c,value=v); cell.border = tb; cell.alignment = Alignment(vertical='center')
    for col,w in [(1,5),(2,25),(3,14)]: ws.column_dimensions[chr(64+col)].width = w
    response = HttpResponse(content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    response['Content-Disposition'] = 'attachment; filename="xonalar.xlsx"'; wb.save(response); return response

@login_required(login_url="login")
def room_export_csv(request):
    rooms = Room.objects.filter(is_active=True).order_by("-created_at")
    headers = ["#","Xona nomi","Yaratilgan sana"]
    rows = [[i,r.name,r.created_at.strftime('%d.%m.%Y') if r.created_at else '-'] for i,r in enumerate(rooms,1)]
    response = HttpResponse(content_type='text/csv; charset=utf-8')
    response['Content-Disposition'] = 'attachment; filename="xonalar.csv"'
    return _write_csv(response, headers, rows)


@login_required(login_url="login")
def student_create(request):
    form = StudentCreateForm()
    if request.method == "POST":
        form = StudentCreateForm(request.POST)
        if form.is_valid():
            groups = list(form.cleaned_data.get("groups", []))
            student = form.save(commit=False)
            student.save()
            for g in groups:
                _add_student_to_group(student, g, "O'quvchi yaratilganda qo'shildi")
            form.save_m2m()
            if groups:
                first_group = groups[0]
                messages.success(request, f"O'quvchi {first_group.name} guruhiga qo'shildi")
                return redirect("group_detail", pk=first_group.pk)
            else:
                messages.success(request, "O'quvchi kutilyotganlar ro'yxatiga qo'shildi")
                return redirect("pending_students")
    else:
        initial_group = request.GET.get("group")
        if initial_group:
            form = StudentCreateForm(initial={"groups": [initial_group]})
    groups_qs = Group.objects.filter(status__in=["aktiv", "kutilyotgan"]).select_related("course", "teacher", "room").prefetch_related("lesson_times", "students")
    group_data = []
    for g in groups_qs:
        lts = []
        days_str = ""
        time_str = ""
        for lt in g.lesson_times.all():
            days_str = lt.get_days_display()
            time_str = f"{lt.start_time.strftime('%H:%M')}-{lt.end_time.strftime('%H:%M')}"
            lts.append(f"{days_str} {time_str}")
        group_data.append({
            "pk": g.pk, "name": g.name, "course_id": g.course_id,
            "course_name": g.course.name if g.course else "",
            "teacher_name": f"{g.teacher.first_name} {g.teacher.last_name}" if g.teacher else "",
            "times": ", ".join(lts) if lts else "",
            "days": days_str,
            "time_range": time_str,
            "level": g.get_education_type_display() if g.education_type else "",
            "start_date": g.start_date.strftime("%d.%m") if g.start_date else "",
            "end_date": g.end_date.strftime("%d.%m") if g.end_date else "",
            "room": g.room.name if g.room else "",
            "student_count": g.students.count(),
            "status": g.status,
        })
    return render(request, "student/form.html", {"form": form, "title": "O'quvchi qo'shish", "group_data": group_data, "course_data": list(Course.objects.all().values("pk", "name"))})


@login_required(login_url="login")
def student_update(request, pk):
    student = get_object_or_404(Student, pk=pk)
    old_groups = set(student.groups.all())
    form = StudentEditForm(instance=student)
    if request.method == "POST":
        form = StudentEditForm(request.POST, instance=student)
        if form.is_valid():
            student = form.save(commit=False)
            student.save()
            new_groups = set(form.cleaned_data.get("groups", []))
            for g in new_groups - old_groups:
                _add_student_to_group(student, g, "Tahrirlash orqali qo'shildi", request=request)
            form.save_m2m()
            for g in old_groups - new_groups:
                student.groups.remove(g)
                _log_student_action(student, g, "removed", "Tahrirlash orqali o'chirildi", request=request)
            messages.success(request, "O'quvchi muvaffaqiyatli yangilandi")
            return redirect("student_list")
    groups_qs = Group.objects.filter(status__in=["aktiv", "kutilyotgan"]).select_related("course", "teacher", "room").prefetch_related("lesson_times", "students")
    group_data = []
    for g in groups_qs:
        lts = []
        days_str = ""
        time_str = ""
        for lt in g.lesson_times.all():
            days_str = lt.get_days_display()
            time_str = f"{lt.start_time.strftime('%H:%M')}-{lt.end_time.strftime('%H:%M')}"
            lts.append(f"{days_str} {time_str}")
        group_data.append({
            "pk": g.pk, "name": g.name, "course_id": g.course_id,
            "course_name": g.course.name if g.course else "",
            "teacher_name": f"{g.teacher.first_name} {g.teacher.last_name}" if g.teacher else "",
            "times": ", ".join(lts) if lts else "",
            "days": days_str,
            "time_range": time_str,
            "level": g.get_education_type_display() if g.education_type else "",
            "start_date": g.start_date.strftime("%d.%m") if g.start_date else "",
            "end_date": g.end_date.strftime("%d.%m") if g.end_date else "",
            "room": g.room.name if g.room else "",
            "student_count": g.students.count(),
            "status": g.status,
        })
    return render(request, "student/form.html", {"form": form, "title": "O'quvchini tahrirlash", "group_data": group_data, "course_data": list(Course.objects.all().values("pk", "name"))})


@login_required(login_url="login")
def student_delete(request, pk):
    student = get_object_or_404(Student, pk=pk)
    if request.method == "POST":
        student.delete()
        messages.success(request, "O'quvchi muvaffaqiyatli o'chirildi (faolligi bekor qilindi)")
        return redirect("student_list")
    return render(request, "student/delete.html", {"object": student, "title": "O'quvchini o'chirish"})


@login_required(login_url="login")
def pending_students(request):
    course_filter = request.GET.get("course", "")
    students = Student.objects.filter(groups__isnull=True, status="kutilyotgan").prefetch_related("desired_course", "marketing_survey")
    if course_filter == "none":
        from django.db.models import Count
        students = students.annotate(num_courses=Count("desired_course")).filter(num_courses=0)
    elif course_filter.isdigit():
        students = students.filter(desired_course__id=int(course_filter))
    students = students.order_by("-created_at")
    from django.db.models import Count
    students = students.annotate(num_courses=Count("desired_course"))
    courses = Course.objects.all()
    return render(request, "student/pending.html", {
        "students": students,
        "courses": courses,
        "active_course": course_filter,
    })


@login_required(login_url="login")
def group_detail(request, pk):
    group = get_object_or_404(Group.objects.annotate(
        total_students=Count("students")
    ).select_related("course", "room", "teacher").prefetch_related("lesson_times"), pk=pk)
    students = group.students.prefetch_related("groups").annotate(total_groups=Count("groups"))
    q = request.GET.get("q", "").strip()
    all_students = Student.objects.exclude(pk__in=students.values_list("pk", flat=True))
    if q:
        all_students = all_students.filter(
            Q(first_name__icontains=q) |
            Q(last_name__icontains=q) |
            Q(phone__endswith=q)
        )
    all_students = all_students.prefetch_related("groups").order_by("-created_at")
    pending_students = Student.objects.filter(
        groups__isnull=True, status="kutilyotgan"
    ).prefetch_related("desired_course", "groups").order_by("-created_at")
    courses = Course.objects.all()
    removed_logs = StudentLog.objects.filter(group=group, action="removed").select_related("student").order_by("-created_at")[:50]
    for _rl in removed_logs:
        _rl.created_by = _resolve_created_by(_rl.created_by)
    frozen_students = group.students.filter(frozen_until__gte=date.today()).prefetch_related("groups")
    graduated_students = group.graduated_students.all().prefetch_related("groups")

    # Attendance data
    weekday_map = {0:"dushanba",1:"seshanba",2:"chorshanba",3:"payshanba",4:"juma",5:"shanba",6:"yakshanba"}
    today_uz = weekday_map[date.today().weekday()]
    today_lesson = group.lesson_times.filter(days__contains=today_uz).first()
    today_attendances = Attendance.objects.filter(group=group, date=date.today())
    attendance_map = {a.student_id: a.status for a in today_attendances}
    attendance_notes = {a.student_id: a.notes for a in today_attendances if a.notes}

    absence_reasons = AbsenceReason.objects.filter(is_active=True).order_by("order", "name")

    student_prices = {}
    for slp in StudentLessonPrice.objects.filter(student__in=students, group=group):
        student_prices[slp.student_id] = slp.lesson_price

    return render(request, "group/detail.html", {
        "group": group,
        "students": students,
        "all_students": all_students,
        "pending_students": pending_students,
        "removed_logs": removed_logs,
        "frozen_students": frozen_students,
        "graduated_students": graduated_students,
        "courses": courses,
        "q": q,
        "today_lesson": today_lesson,
        "attendance_map": attendance_map,
        "attendance_notes": attendance_notes,
        "absence_reasons": absence_reasons,
        "student_prices": student_prices,
    })


@login_required(login_url="login")
def group_history(request, pk):
    group = get_object_or_404(Group.objects.select_related("course", "room", "teacher"), pk=pk)
    student_logs = StudentLog.objects.filter(group=group).select_related("student").order_by("-created_at")
    group_logs = GroupLog.objects.filter(group=group).order_by("-created_at")

    CAT_MAP = {
        "created": ("create", "Yaratildi"),
        "updated": ("edit", "Tahrir"),
        "settings_updated": ("edit", "Sozlamalar"),
        "lesson_added": ("edit", "Dars vaqti"),
        "lesson_deleted": ("edit", "Dars vaqti"),
        "deleted": ("delete", "O'chirildi"),
        "archived": ("archive", "Arxiv"),
        "frozen": ("freeze", "Muzlatish"),
        "extended": ("extend", "Kun qo'shildi"),
        "joined": ("student", "Qo'shildi"),
        "student_added": ("student", "Qo'shildi"),
        "students_added": ("student", "Qo'shildi"),
        "removed": ("remove", "Chiqarildi"),
        "student_removed": ("remove", "Chiqarildi"),
        "transferred": ("transfer", "Ko'chirildi"),
        "student_transferred": ("transfer", "Ko'chirildi"),
        "all_students_transferred": ("transfer", "Ko'chirildi"),
        "graduated": ("transfer", "Bitirildi"),
        "student_graduated": ("transfer", "Bitirildi"),
        "unfrozen": ("freeze", "Muzlatish bekor"),
    }

    # Export to Excel
    if request.GET.get("export"):
        from openpyxl import Workbook
        from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
        wb = Workbook()
        ws = wb.active
        ws.title = "Davomat"

        header_font = Font(name="Calibri", bold=True, color="FFFFFF", size=11)
        header_fill = PatternFill(start_color="2001FF", end_color="2001FF", fill_type="solid")
        header_align = Alignment(horizontal="center", vertical="center")
        thin_border = Border(
            left=Side(style="thin", color="EDEEF5"),
            right=Side(style="thin", color="EDEEF5"),
            top=Side(style="thin", color="EDEEF5"),
            bottom=Side(style="thin", color="EDEEF5"),
        )

        headers = ["Sana", "O'quvchi", "Telefon", "Holati", "Izoh", "O'qituvchi", "Dars vaqti"]
        for col, h in enumerate(headers, 1):
            cell = ws.cell(row=1, column=col, value=h)
            cell.font = header_font
            cell.fill = header_fill
            cell.alignment = header_align
            cell.border = thin_border

        weekday_map_rev = {0:"dushanba",1:"seshanba",2:"chorshanba",3:"payshanba",4:"juma",5:"shanba",6:"yakshanba"}
        lesson_day_numbers = set()
        for lt in group.lesson_times.all():
            for d_name in lt.days.split(","):
                d_name = d_name.strip()
                for num, uz_name in weekday_map_rev.items():
                    if uz_name == d_name:
                        lesson_day_numbers.add(num)
        if not lesson_day_numbers:
            lesson_day_numbers = {0,1,2,3,4,5,6}

        start = group.start_date or date.today() - timedelta(days=30)
        end = min(date.today(), group.end_date) if group.end_date else date.today()
        students = group.students.all().order_by("first_name")
        attendances = Attendance.objects.filter(group=group, date__gte=start, date__lte=end).select_related("student", "teacher", "lesson_time")
        att_map = {}
        for a in attendances:
            att_map[(a.student_id, a.date)] = a

        row = 2
        d = start
        while d <= end:
            if d.weekday() in lesson_day_numbers:
                day_has = any((s.id, d) in att_map for s in students)
                if not day_has:
                    d += timedelta(days=1)
                    continue
                date_fill = PatternFill(start_color="F8F9FC", end_color="F8F9FC", fill_type="solid")
                date_font = Font(name="Calibri", bold=True, size=11, color="2001FF")
                ws.cell(row=row, column=1, value=d.strftime("%d.%m.%Y")).font = date_font
                ws.cell(row=row, column=1).fill = date_fill
                for c in range(2, 8):
                    ws.cell(row=row, column=c).fill = date_fill
                row += 1
                for s in students:
                    a = att_map.get((s.id, d))
                    ws.cell(row=row, column=2, value=f"{s.first_name} {s.last_name}")
                    ws.cell(row=row, column=3, value=s.phone or "")
                    if a:
                        status_map = {"present": "Keldi", "absent": "Kelmadi", "excused": "Sababli kelmadi"}
                        ws.cell(row=row, column=4, value=status_map.get(a.status, a.status))
                        ws.cell(row=row, column=5, value=a.notes or "")
                        ws.cell(row=row, column=6, value=str(a.teacher) if a.teacher else "")
                        ws.cell(row=row, column=7, value=str(a.lesson_time) if a.lesson_time else "")
                        status_fill_map = {
                            "present": PatternFill(start_color="E6F9F1", end_color="E6F9F1", fill_type="solid"),
                            "absent": PatternFill(start_color="FDEAEA", end_color="FDEAEA", fill_type="solid"),
                            "excused": PatternFill(start_color="FFF7E6", end_color="FFF7E6", fill_type="solid"),
                        }
                        if a.status in status_fill_map:
                            ws.cell(row=row, column=4).fill = status_fill_map[a.status]
                    for c in range(1, 8):
                        ws.cell(row=row, column=c).border = thin_border
                        ws.cell(row=row, column=c).alignment = Alignment(vertical="center")
                    row += 1
            d += timedelta(days=1)

        ws.column_dimensions["A"].width = 14
        ws.column_dimensions["B"].width = 28
        ws.column_dimensions["C"].width = 18
        ws.column_dimensions["D"].width = 14
        ws.column_dimensions["E"].width = 30
        ws.column_dimensions["F"].width = 22
        ws.column_dimensions["G"].width = 14

        from django.http import HttpResponse
        response = HttpResponse(content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        response["Content-Disposition"] = f'attachment; filename="{group.name}_davomat.xlsx"'
        wb.save(response)
        return response

    combined = []
    for log in student_logs:
        cat, label = CAT_MAP.get(log.action, ("student", "O'quvchi"))
        combined.append({
            "category": cat,
            "category_label": label,
            "description": f"{log.student.first_name} {log.student.last_name}",
            "detail": log.reason or "",
            "student_name": f"{log.student.first_name} {log.student.last_name}",
            "student_phone": log.student.phone or "",
            "group_name": group.name,
            "created_by": "",
            "created_at": log.created_at,
        })
    for log in group_logs:
        cat, label = CAT_MAP.get(log.action, ("edit", "O'zgarish"))
        combined.append({
            "category": cat,
            "category_label": label,
            "description": log.description,
            "detail": "",
            "student_name": "",
            "student_phone": "",
            "group_name": group.name,
            "created_by": log.created_by,
            "created_at": log.created_at,
        })
    combined.sort(key=lambda x: x["created_at"], reverse=True)

    stats = {
        "total": len(combined),
        "added": sum(1 for c in combined if c["category"] == "student"),
        "transferred": sum(1 for c in combined if c["category"] == "transfer"),
        "frozen": sum(1 for c in combined if c["category"] == "freeze"),
        "removed": sum(1 for c in combined if c["category"] == "remove"),
        "edited": sum(1 for c in combined if c["category"] in ("edit", "extend", "create", "archive")),
    }

    try:
        page = int(request.GET.get("page", 1))
    except (ValueError, TypeError):
        page = 1
    try:
        per_page = int(request.GET.get("per_page", 20))
    except (ValueError, TypeError):
        per_page = 20
    if per_page not in (20, 50, 100):
        per_page = 20
    paginator = Paginator(combined, per_page)

    return render(request, "group/history.html", {
        "group": group,
        "logs": paginator.page(page),
        "page_obj": paginator.page(page),
        "stats": stats,
        "employees": Employee.objects.filter(role__name="O'qituvchi").order_by("first_name"),
    })


@login_required(login_url="login")
def group_davom(request, pk):
    employee = getattr(request.user, 'employee_profile', None)
    is_admin = request.user.is_staff or request.user.is_superuser or (employee and employee.role and employee.role.name == "Administrator")

    group = get_object_or_404(
        Group.objects.select_related("course", "room", "teacher").prefetch_related("lesson_times"),
        pk=pk
    )
    students = group.students.all().order_by("first_name")

    # Export to Excel
    if request.GET.get("export"):
        from openpyxl import Workbook
        from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
        wb = Workbook()
        ws = wb.active
        ws.title = "Davomat"

        header_font = Font(name="Calibri", bold=True, color="FFFFFF", size=11)
        header_fill = PatternFill(start_color="2001FF", end_color="2001FF", fill_type="solid")
        header_align = Alignment(horizontal="center", vertical="center")
        thin_border = Border(
            left=Side(style="thin", color="EDEEF5"),
            right=Side(style="thin", color="EDEEF5"),
            top=Side(style="thin", color="EDEEF5"),
            bottom=Side(style="thin", color="EDEEF5"),
        )

        headers = ["Sana", "O'quvchi", "Telefon", "Holati", "Izoh", "O'qituvchi", "Dars vaqti"]
        for col, h in enumerate(headers, 1):
            cell = ws.cell(row=1, column=col, value=h)
            cell.font = header_font
            cell.fill = header_fill
            cell.alignment = header_align
            cell.border = thin_border

        weekday_map_rev = {0:"dushanba",1:"seshanba",2:"chorshanba",3:"payshanba",4:"juma",5:"shanba",6:"yakshanba"}
        lesson_day_numbers = set()
        for lt in group.lesson_times.all():
            for d_name in lt.days.split(","):
                d_name = d_name.strip()
                for num, uz_name in weekday_map_rev.items():
                    if uz_name == d_name:
                        lesson_day_numbers.add(num)
        if not lesson_day_numbers:
            lesson_day_numbers = {0,1,2,3,4,5,6}

        start = group.start_date or date.today() - timedelta(days=30)
        end = date.today()
        students_exp = group.students.all().order_by("first_name")
        attendances = Attendance.objects.filter(group=group, date__gte=start, date__lte=end).select_related("student", "teacher", "lesson_time")
        att_map = {}
        for a in attendances:
            att_map[(a.student_id, a.date)] = a

        row = 2
        d = start
        while d <= end:
            if d.weekday() in lesson_day_numbers:
                day_has = any((s.id, d) in att_map for s in students_exp)
                if not day_has:
                    d += timedelta(days=1)
                    continue
                date_fill = PatternFill(start_color="F8F9FC", end_color="F8F9FC", fill_type="solid")
                date_font = Font(name="Calibri", bold=True, size=11, color="2001FF")
                ws.cell(row=row, column=1, value=d.strftime("%d.%m.%Y")).font = date_font
                ws.cell(row=row, column=1).fill = date_fill
                for c in range(2, 8):
                    ws.cell(row=row, column=c).fill = date_fill
                row += 1
                for s in students_exp:
                    a = att_map.get((s.id, d))
                    ws.cell(row=row, column=2, value=f"{s.first_name} {s.last_name}")
                    ws.cell(row=row, column=3, value=s.phone or "")
                    if a:
                        status_map = {"present": "Keldi", "absent": "Kelmadi", "excused": "Sababli kelmadi"}
                        ws.cell(row=row, column=4, value=status_map.get(a.status, a.status))
                        ws.cell(row=row, column=5, value=a.notes or "")
                        ws.cell(row=row, column=6, value=str(a.teacher) if a.teacher else "")
                        ws.cell(row=row, column=7, value=str(a.lesson_time) if a.lesson_time else "")
                        status_fill_map = {
                            "present": PatternFill(start_color="E6F9F1", end_color="E6F9F1", fill_type="solid"),
                            "absent": PatternFill(start_color="FDEAEA", end_color="FDEAEA", fill_type="solid"),
                            "excused": PatternFill(start_color="FFF7E6", end_color="FFF7E6", fill_type="solid"),
                        }
                        if a.status in status_fill_map:
                            ws.cell(row=row, column=4).fill = status_fill_map[a.status]
                    for c in range(1, 8):
                        ws.cell(row=row, column=c).border = thin_border
                        ws.cell(row=row, column=c).alignment = Alignment(vertical="center")
                    row += 1
            d += timedelta(days=1)

        ws.column_dimensions["A"].width = 14
        ws.column_dimensions["B"].width = 28
        ws.column_dimensions["C"].width = 18
        ws.column_dimensions["D"].width = 14
        ws.column_dimensions["E"].width = 30
        ws.column_dimensions["F"].width = 22
        ws.column_dimensions["G"].width = 14

        from django.http import HttpResponse
        response = HttpResponse(content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        response["Content-Disposition"] = f'attachment; filename="{group.name}_davomat.xlsx"'
        wb.save(response)
        return response

    today = date.today()

    # Specific date override — admin can pick any date
    specific_date = request.GET.get("date", "")
    if specific_date:
        try:
            specific_date = date.fromisoformat(specific_date)
            sel_year = specific_date.year
            sel_month = specific_date.month
        except:
            specific_date = None
    else:
        specific_date = None

    # Month/year from query string, default to current
    sel_year = int(request.GET.get("year", today.year))
    sel_month = int(request.GET.get("month", today.month))
    sel_month = max(1, min(12, sel_month))

    _, last_day = calendar.monthrange(sel_year, sel_month)
    month_start = date(sel_year, sel_month, 1)
    month_end = date(sel_year, sel_month, last_day)

    if specific_date:
        lesson_dates = [specific_date]
    else:
        lesson_dates = generate_lesson_dates(group, month_start, month_end)

    # Build attendance matrix: {student_id: {date_str: status}}
    attendances = Attendance.objects.filter(group=group, date__gte=month_start, date__lte=month_end)
    att_matrix = {}
    att_notes = {}
    for a in attendances:
        sid = a.student_id
        if sid not in att_matrix:
            att_matrix[sid] = {}
        att_matrix[sid][a.date.isoformat()] = a.status
        if a.notes:
            if sid not in att_notes:
                att_notes[sid] = {}
            att_notes[sid][a.date.isoformat()] = a.notes

    if request.method == "POST":
        import json
        try:
            data = json.loads(request.body)
        except:
            return JsonResponse({"error": "Invalid JSON"}, status=400)
        records = data.get("records", [])
        allow_dated = data.get("allow_dated", False)
        employee = getattr(request.user, 'employee_profile', None)
        created_by = "Admin"
        if employee:
            created_by = f"{employee.first_name} {employee.last_name or ''}".strip()
        # Permission check
        if not is_admin:
            if employee is None or group.teacher_id != employee.id:
                return JsonResponse({"error": "Siz o'qituvchi emassiz!"}, status=403)
            # Teacher faqat bugun va dars vaqtida
            weekday_map = {0:"dushanba",1:"seshanba",2:"chorshanba",3:"payshanba",4:"juma",5:"shanba",6:"yakshanba"}
            today_uz = weekday_map[today.weekday()]
            now = datetime.now().time()
            allowed = False
            for lt in group.lesson_times.all():
                for d_name in lt.days.split(","):
                    if d_name.strip() == today_uz:
                        if lt.start_time and lt.end_time:
                            if lt.start_time <= now <= lt.end_time:
                                allowed = True
                                break
                if allowed:
                    break
            if not allowed:
                return JsonResponse({"error": "Dars vaqti ichida bo'lmaganda davomatni o'zgartira olmaysiz!"}, status=403)
        today_for_save = today
        student_ids_in_records = set()
        for rec in records:
            student_id = rec.get("student_id")
            if not student_id:
                continue
            status = rec.get("status", "present")
            notes = rec.get("notes", "") or ""
            rec_date = rec.get("date")
            if allow_dated and rec_date:
                try:
                    rec_date = date.fromisoformat(rec_date)
                except:
                    rec_date = today_for_save
            else:
                rec_date = today_for_save
            # Teacher faqat bugun uchun
            if not is_admin and rec_date != today_for_save:
                return JsonResponse({"error": "Faqat bugungi davomatni o'zgartira olasiz!"}, status=403)
            # Guruh tugash sanasidan keyingi davomatni saqlash mumkin emas
            if group.end_date and rec_date > group.end_date:
                return JsonResponse({"error": "Guruh muddati tugagan, davomatni o'zgartirish mumkin emas"}, status=403)
            if status == "none":
                old_att = Attendance.objects.filter(
                    group=group, student_id=student_id, date=rec_date
                ).first()
                if old_att:
                    try:
                        student_obj = Student.objects.get(pk=student_id)
                        sync_attendance_balance(student_obj, group, old_att, "none", created_by)
                    except Student.DoesNotExist:
                        pass
                    old_att.delete()
                continue
            student_ids_in_records.add(student_id)
            attendance, _ = Attendance.objects.update_or_create(
                group=group,
                student_id=student_id,
                date=rec_date,
                defaults={"status": status, "teacher": employee, "notes": notes, "created_by": created_by}
            )
            # Balansni sinxronlash
            try:
                student_obj = Student.objects.get(pk=student_id)
                sync_attendance_balance(student_obj, group, attendance, status, created_by)
                if status == "absent":
                    date_display = rec_date.strftime("%d.%m.%Y") if hasattr(rec_date, "strftime") else str(rec_date)
                    send_absence_sms(student_obj, group=group, date_str=date_display, created_by=created_by)
            except Student.DoesNotExist:
                pass
        # Tegilmagan o'quvchilarni "Keldi" qilib saqlash (faqat allow_dated=False bo'lsa)
        if not allow_dated:
            for student in group.students.all():
                if student.id not in student_ids_in_records:
                    attendance, _ = Attendance.objects.update_or_create(
                        group=group,
                        student_id=student.id,
                        date=today_for_save,
                        defaults={"status": "present", "teacher": employee, "notes": "", "created_by": created_by}
                    )
                    # Balansni sinxronlash
                    sync_attendance_balance(student, group, attendance, "present", created_by)
        return JsonResponse({"ok": True})

    # Stats for the month
    total = students.count()
    present_count = sum(1 for a in attendances if a.status == "present")
    absent_count = sum(1 for a in attendances if a.status == "absent")
    excused_count = sum(1 for a in attendances if a.status == "excused")
    total_marked = present_count + absent_count + excused_count

    # Month options for selector
    months_uz = ["Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun", "Iyul", "Avgust", "Sentabr", "Oktabr", "Noyabr", "Dekabr"]

    # Check if teacher can edit (only during lesson time)
    can_edit = True if is_admin else False
    if not is_admin:
        weekday_map = {0:"dushanba",1:"seshanba",2:"chorshanba",3:"payshanba",4:"juma",5:"shanba",6:"yakshanba"}
        today_uz = weekday_map[today.weekday()]
        now = datetime.now().time()
        for lt in group.lesson_times.all():
            for d_name in lt.days.split(","):
                if d_name.strip() == today_uz:
                    if lt.start_time and lt.end_time:
                        if lt.start_time <= now <= lt.end_time:
                            can_edit = True
                            break
            if can_edit:
                break

    absence_reasons = AbsenceReason.objects.filter(is_active=True).order_by("order", "name")

    # Today's groups for mobile group picker (admin only)
    today_groups = []
    if is_admin:
        now = datetime.now()
        weekday_map = {0:"dushanba",1:"seshanba",2:"chorshanba",3:"payshanba",4:"juma",5:"shanba",6:"yakshanba"}
        today_uz = weekday_map[now.weekday()]
        qs = Group.objects.filter(status__in=["aktiv","kutilyotgan"], lesson_times__days__contains=today_uz).select_related("course","teacher").annotate(sc=Count("students")).distinct().order_by("name")
        for g in qs:
            today_groups.append({"id":g.id,"name":g.name,"course":g.course.name,"teacher_name":str(g.teacher),"sc":g.sc,"active":g.id==group.id})

    # Per-student latest absence reason
    student_last_reason = {}
    for a in attendances.filter(status__in=['absent', 'excused']).exclude(notes__exact='').order_by('-date'):
        if a.student_id not in student_last_reason:
            student_last_reason[a.student_id] = a.notes

    # Per-student notes list for display after name
    tashkent_tz = dt_timezone(timedelta(hours=5))
    student_notes_list = {}
    for a in attendances.filter(status__in=['absent', 'excused']).exclude(notes__exact='').order_by('-date'):
        sid = a.student_id
        if sid not in student_notes_list:
            student_notes_list[sid] = []
        if len(student_notes_list[sid]) < 3:
            dt_str = ''
            if a.created_at:
                dt_str = a.created_at.astimezone(tashkent_tz).strftime('%d.%m.%Y %H:%M')
            student_notes_list[sid].append({
                'date': a.date.isoformat(),
                'notes': a.notes,
                'datetime': dt_str,
                'teacher': a.created_by or '',
            })

    # Per-student full attendance history (all-time, not limited to selected month)
    all_attendances = Attendance.objects.filter(group=group).select_related("teacher").order_by('-created_at')
    status_labels = {'absent': 'Kelmadi', 'excused': 'Sababli', 'present': 'Keldi'}
    student_att_history = {}
    for a in all_attendances:
        sid = a.student_id
        if sid not in student_att_history:
            student_att_history[sid] = []
        teacher_name = ''
        if a.teacher:
            teacher_name = (a.teacher.first_name or '') + ' ' + (a.teacher.last_name or '')
            teacher_name = teacher_name.strip()
        elif a.created_by:
            teacher_name = a.created_by
        tashkent_tz = dt_timezone(timedelta(hours=5))
        day_names = {0:'Du',1:'Se',2:'Cho',3:'Pay',4:'Ju',5:'Sha',6:'Yak'}
        student_att_history[sid].append({
            'date': a.date.isoformat(),
            'datetime': a.created_at.astimezone(tashkent_tz).strftime('%d.%m.%Y %H:%M'),
            'day_name': day_names[a.date.weekday()],
            'status': status_labels.get(a.status, a.status),
            'notes': a.notes or '',
            'teacher': teacher_name,
        })

    return render(request, "group/davom.html", {
        "group": group,
        "students": students,
        "lesson_dates": lesson_dates,
        "att_matrix": att_matrix,
        "att_notes": att_notes,
        "student_last_reason": student_last_reason,
        "student_att_history": student_att_history,
        "student_notes_list": student_notes_list,
        "absence_reasons": absence_reasons,
        "today": today,
        "specific_date": specific_date,
        "status_labels": status_labels,
        "sel_year": sel_year,
        "sel_month": sel_month,
        "months_uz": months_uz,
        "years": range(2024, 2031),
        "total": total,
        "present_count": present_count,
        "absent_count": absent_count,
        "excused_count": excused_count,
        "total_marked": total_marked,
        "is_admin": is_admin,
        "can_edit": can_edit,
        "today_groups": today_groups,
        "remaining_days": group.remaining_days(),
        "is_ending_soon": group.is_ending_soon(),
        "end_date": group.end_date,
    })


def _add_student_to_group(student, group, reason="Guruh sahifasidan qo'shildi", request=None):
    if group in student.groups.all():
        return False
    student.groups.add(group)
    student.frozen_until = None
    student.status = "kutilyotgan"
    student.save(update_fields=["frozen_until", "status"])
    _log_student_action(student, group, "joined", reason, request=request)
    return True


@login_required(login_url="login")
def add_student_to_group(request, group_pk, student_pk):
    group = get_object_or_404(Group, pk=group_pk)
    student = get_object_or_404(Student, pk=student_pk)
    if not _add_student_to_group(student, group, request=request):
        messages.warning(request, f"{student.first_name} {student.last_name} allaqachon {group.name} guruhiga qo'shilgan!")
        return redirect("group_detail", pk=group_pk)
    lesson_price = request.GET.get("lesson_price")
    if lesson_price:
        try:
            price = Decimal(lesson_price)
            StudentLessonPrice.objects.update_or_create(
                student=student, group=group,
                defaults={"lesson_price": price}
            )
        except:
            pass
    _log_group_action(group, "student_added", f"O'quvchi qo'shildi: {student.first_name} {student.last_name} (+998 {student.phone})", request)
    messages.success(request, f"{student.first_name} {student.last_name} {group.name} guruhiga qo'shildi")
    return redirect("group_detail", pk=group_pk)


@login_required(login_url="login")
def add_pending_to_group(request, group_pk, course_pk):
    group = get_object_or_404(Group, pk=group_pk)
    course = get_object_or_404(Course, pk=course_pk)
    students = Student.objects.filter(groups__isnull=True, status="kutilyotgan", desired_course=course)
    count = 0
    for student in students:
        if _add_student_to_group(student, group, f"{group.name} guruhiga kurs bo'yicha qo'shildi", request=request):
            count += 1
    if count:
        _log_group_action(group, "students_added", f"{count} ta o'quvchi kurs bo'yicha qo'shildi ({course.name})", request)
        messages.success(request, f"{count} ta o'quvchi {group.name} guruhiga qo'shildi")
    else:
        messages.info(request, "Qo'shiladigan o'quvchi topilmadi")
    return redirect("group_detail", pk=group_pk)


@login_required(login_url="login")
def remove_student_from_group(request, group_pk, student_pk):
    group = get_object_or_404(Group, pk=group_pk)
    student = get_object_or_404(Student, pk=student_pk)
    if request.method == "POST":
        reason = request.POST.get("reason", "").strip()
        if not reason:
            messages.error(request, "Chiqarish sababini yozing!")
            return redirect("group_detail", pk=group_pk)
        student.groups.remove(group)
        student.frozen_until = None
        student.status = "chiqarilgan"
        student.save(update_fields=["frozen_until", "status"])
        group_count = student.groups.count()
        if group_count == 0:
            student.status = "chiqarilgan"
            student.save(update_fields=["status"])
        _log_student_action(student, group, "removed", reason, request=request)
        _log_group_action(group, "student_removed", f"O'quvchi chiqarildi: {student.first_name} {student.last_name} (Sabab: {reason})", request)
        messages.success(request, f"{student.first_name} {student.last_name} guruhdan chiqarildi")
        return redirect("group_detail", pk=group_pk)
    return redirect("group_detail", pk=group_pk)


@login_required(login_url="login")
def graduate_student(request, group_pk, student_pk):
    group = get_object_or_404(Group, pk=group_pk)
    student = get_object_or_404(Student, pk=student_pk)
    if group not in student.groups.all():
        messages.warning(request, f"{student.first_name} {student.last_name} bu guruhda emas!")
        return redirect("group_detail", pk=group_pk)
    if group in student.graduated_groups.all():
        messages.warning(request, f"{student.first_name} {student.last_name} allaqachon {group.name} dan bitirilgan!")
        return redirect("group_detail", pk=group_pk)
    student.groups.remove(group)
    student.graduated_groups.add(group)
    if not student.groups.exists():
        student.status = Student.Status.GRADUATED
        student.save(update_fields=["status"])
    _log_student_action(student, group, "graduated", f"{group.name} guruhini bitirdi", request=request)
    _log_group_action(group, "student_graduated", f"O'quvchi bitirdi: {student.first_name} {student.last_name}", request)
    messages.success(request, f"{student.first_name} {student.last_name} {group.name} guruhini bitirdi!")
    return redirect("group_detail", pk=group_pk)


@login_required(login_url="login")
def transfer_student(request, group_pk, student_pk):
    group = get_object_or_404(Group, pk=group_pk)
    student = get_object_or_404(Student, pk=student_pk)
    if group not in student.groups.all():
        messages.warning(request, f"{student.first_name} {student.last_name} bu guruhda emas!")
        return redirect("group_detail", pk=group_pk)

    if request.method == "POST":
        reason = request.POST.get("reason", "").strip()
        new_group_id = request.POST.get("new_group")
        if new_group_id == "pending":
            old_name = group.name
            student.groups.remove(group)
            student.frozen_until = None
            student.status = "kutilyotgan"
            student.save(update_fields=["frozen_until", "status"])
            _log_student_action(student, group, "transferred", reason or f"{old_name} → Kutilyotganlar", request=request)
            _log_group_action(group, "student_transferred", f"O'quvchi kutilyotganlarga o'tkazildi: {student.first_name} {student.last_name}", request)
            messages.success(request, f"{student.first_name} {student.last_name} {old_name} dan kutilyotganlarga o'tkazildi!")
            return redirect("pending_students")
        if not new_group_id:
            messages.error(request, "Yangi guruhni tanlang!")
            return redirect("transfer_student", group_pk=group_pk, student_pk=student_pk)
        new_group = get_object_or_404(Group, pk=new_group_id)
        trans_info = f"{group.name} → {new_group.name}"
        full_reason = f"{reason} | {trans_info}" if reason else trans_info
        student.groups.remove(group)
        student.groups.add(new_group)
        student.frozen_until = None
        student.status = "kutilyotgan"
        student.save(update_fields=["frozen_until", "status"])
        _log_student_action(student, group, "transferred", full_reason, request=request)
        _log_student_action(student, new_group, "joined", f"{group.name} dan ko'chirildi", request=request)
        _log_group_action(group, "student_transferred", f"O'quvchi ko'chirildi: {student.first_name} {student.last_name} ({group.name} → {new_group.name})", request)
        messages.success(request, f"{student.first_name} {student.last_name} {group.name} dan {new_group.name} ga o'tkazildi!")
        return redirect("group_detail", pk=new_group.pk)

    course_id = request.GET.get("course_id")
    teacher_id = request.GET.get("teacher_id")

    courses = Course.objects.all().order_by("name")
    teachers = Employee.objects.none()
    groups = Group.objects.none()

    if course_id:
        teachers = Employee.objects.filter(
            role__name="O'qituvchi",
            teacher_groups__course_id=course_id
        ).exclude(teacher_groups__isnull=True).distinct().order_by("first_name")

    if teacher_id and course_id:
        groups = Group.objects.filter(
            status__in=["aktiv", "kutilyotgan"],
            course_id=course_id,
            teacher_id=teacher_id,
        ).exclude(pk=group.pk).select_related(
            "course", "room", "teacher"
        ).prefetch_related("lesson_times").order_by("name")

    return render(request, "student/transfer.html", {
        "student": student,
        "group": group,
        "courses": courses,
        "teachers": teachers,
        "groups": groups,
        "selected_course_id": course_id,
        "selected_teacher_id": teacher_id,
    })


@login_required(login_url="login")
def transfer_all_students(request, pk):
    group = get_object_or_404(Group, pk=pk)
    students = group.students.all()
    if request.method == "POST":
        reason = request.POST.get("reason", "").strip()
        new_group_id = request.POST.get("new_group")
        if not new_group_id or new_group_id == "pending":
            messages.error(request, "Yangi guruhni tanlang!")
            return redirect("transfer_all_students", pk=pk)
        new_group = get_object_or_404(Group, pk=new_group_id)
        trans_info = f"{group.name} → {new_group.name}"
        full_reason = f"{reason} | {trans_info}" if reason else trans_info
        count = 0
        for student in students:
            student.groups.remove(group)
            student.groups.add(new_group)
            student.frozen_until = None
            student.status = "kutilyotgan"
            student.save(update_fields=["frozen_until", "status"])
            _log_student_action(student, group, "transferred", full_reason, request=request)
            _log_student_action(student, new_group, "joined", f"{group.name} dan ko'chirildi", request=request)
            count += 1
        _log_group_action(group, "all_students_transferred", f"Barcha o'quvchilar ({count} ta) ko'chirildi: {group.name} → {new_group.name}", request)
        messages.success(request, f"{count} ta o'quvchi {group.name} dan {new_group.name} ga o'tkazildi!")
        return redirect("group_detail", pk=new_group.pk)
    course_id = request.GET.get("course_id")
    teacher_id = request.GET.get("teacher_id")
    courses = Course.objects.all().order_by("name")
    teachers = Employee.objects.none()
    groups = Group.objects.none()
    if course_id:
        teachers = Employee.objects.filter(
            role__name="O'qituvchi", teacher_groups__course_id=course_id
        ).exclude(teacher_groups__isnull=True).distinct().order_by("first_name")
    if teacher_id and course_id:
        groups = Group.objects.filter(
            status__in=["aktiv", "kutilyotgan"],
            course_id=course_id, teacher_id=teacher_id,
        ).exclude(pk=group.pk).select_related("course", "room", "teacher"
        ).prefetch_related("lesson_times").annotate(
            student_count=Count("students")
        ).order_by("name")
    return render(request, "group/transfer_all.html", {
        "group": group, "students": students, "courses": courses,
        "teachers": teachers, "groups": groups,
        "selected_course_id": course_id, "selected_teacher_id": teacher_id,
    })


@login_required(login_url="login")
def graduated_students(request):
    students = Student.objects.filter(graduated_groups__isnull=False).prefetch_related(
        "graduated_groups", "groups"
    ).distinct().order_by("-created_at")
    return render(request, "student/graduated.html", {"students": students})


@login_required(login_url="login")
def student_profile(request, pk):
    student = get_object_or_404(Student.objects.prefetch_related("groups", "graduated_groups"), pk=pk)

    if request.method == "POST":
        action = request.POST.get("action", "")

        if action == "edit_profile":
            student.first_name = request.POST.get("first_name", student.first_name)
            student.last_name = request.POST.get("last_name", student.last_name)
            student.phone = request.POST.get("phone", student.phone)
            student.email = request.POST.get("email") or None
            student.father_full_name = request.POST.get("father_full_name") or None
            student.father_phone = request.POST.get("father_phone") or None
            student.father_workplace = request.POST.get("father_workplace") or None
            student.mother_full_name = request.POST.get("mother_full_name") or None
            student.mother_phone = request.POST.get("mother_phone") or None
            student.mother_workplace = request.POST.get("mother_workplace") or None
            student.home_address = request.POST.get("home_address") or None
            student.school = request.POST.get("school") or None
            student.additional_info = request.POST.get("additional_info") or None
            student.education_language = request.POST.get("education_language") or "O'zbekcha"

            birth_date_str = request.POST.get("birth_date")
            if birth_date_str:
                try:
                    student.birth_date = date.fromisoformat(birth_date_str)
                except (ValueError, TypeError):
                    pass

            student.save()
            messages.success(request, "Profil muvaffaqiyatli yangilandi!")
            return redirect("student_profile", pk=student.pk)

        elif action == "save_address":
            country = request.POST.get("address_country")
            country_custom = request.POST.get("address_country_custom")
            student.address_country = country_custom or country or None
            region = request.POST.get("address_region")
            region_custom = request.POST.get("address_region_custom")
            student.address_region = region_custom or region or None
            student.address_district = request.POST.get("address_district") or None
            student.address_mfy = request.POST.get("address_mfy") or None
            student.address_street = request.POST.get("address_street") or None
            student.address_house = request.POST.get("address_house") or None
            student.save()
            messages.success(request, "Manzil muvaffaqiyatli saqlandi!")
            return redirect("student_profile", pk=student.pk)

    logs = list(student.logs.select_related("group").all())
    import re
    for log in logs:
        log.created_by = _resolve_created_by(log.created_by)
        log.target_name = None
        if log.action == "transferred" and log.reason:
            m = re.search(r"→\s*(.+?)$", log.reason)
            if m:
                log.target_name = m.group(1).strip()
            if not log.target_name:
                m = re.search(r"\bdan\b\s+(.+?)\s+ga\s+o'tkazildi", log.reason)
                if m:
                    log.target_name = m.group(1).strip()
            if not log.target_name and re.search(r"\bkutilyotgan", log.reason, re.I):
                log.target_name = "Kutilyotganlar"
    groups = Group.objects.filter(status="aktiv").order_by("name")

    # Education types from student's groups
    edu_types = student.groups.values_list("education_type", flat=True).distinct()
    education_type_map = {"onlayn": "Onlayn", "oflayn": "Oflayn"}
    education_types = [education_type_map.get(t, t) for t in edu_types]

    # Attendance history for this student — paginated
    attendance_all = Attendance.objects.filter(
        student=student
    ).select_related("group", "teacher").prefetch_related("transactions").order_by("-date")
    attendance_paginator = Paginator(attendance_all, 25)
    attendance_page = request.GET.get("attendance_page", 1)
    try:
        attendance_history = attendance_paginator.page(attendance_page)
    except (PageNotAnInteger, EmptyPage):
        attendance_history = attendance_paginator.page(1)

    # Remaining lessons — future scheduled lesson dates this month
    now = timezone.now()
    today = now.date()
    month_start = today.replace(day=1)
    last_day = calendar.monthrange(today.year, today.month)[1]
    month_end = today.replace(day=last_day)
    active_groups = student.groups.filter(status="aktiv")
    remaining_lessons = 0
    for group in active_groups:
        lesson_dates = generate_lesson_dates(group, month_start, month_end)
        future_dates = [d for d in lesson_dates if d >= today]
        remaining_lessons += len(future_dates)

    # Monthly debt breakdown
    monthly_debts, deferred_payments = _calc_monthly_debts(student)
    prev_debt = sum(d["debt"] for d in monthly_debts)
    current_expected = calculate_expected_payment_up_to_today(student)
    balance = get_or_create_balance(student)
    total_owed = calculate_remaining_month_payment(student)

    # Split current month: up-to-today vs remaining
    remaining_cost = Decimal('0.00')
    for group in active_groups:
        price = get_student_lesson_price(student, group)
        if price <= 0:
            continue
        join_date = get_student_join_date(student, group)
        effective_start = month_start
        if join_date:
            effective_start = max(month_start, join_date)
        tomorrow = today + timedelta(days=1)
        remaining_lesson_dates = generate_lesson_dates(group, tomorrow, month_end)
        remaining_cost += len(remaining_lesson_dates) * price
    up_to_today_cost = current_expected - remaining_cost
    shu_kungacha = up_to_today_cost
    oy_oxirigacha = total_owed

    employee = getattr(request.user, 'employee_profile', None)
    admin_name = "Admin"
    if employee:
        admin_name = f"{employee.first_name} {employee.last_name or ''}".strip()

    all_students = Student.objects.exclude(pk=pk).order_by("first_name", "last_name")

    transactions = Transaction.objects.filter(student=student).select_related("group").order_by("-created_at")[:50]

    # SMS history for this student - match by student_name OR by phone numbers
    from django.db.models import Q
    phones = [p for p in [student.phone, student.father_phone, student.mother_phone] if p]
    name_q = Q()
    for phone in phones:
        name_q |= Q(recipient_phone=phone)
    name_q |= Q(student_name__icontains=student.first_name) & Q(student_name__icontains=student.last_name)
    sms_history = list(SmsHistory.objects.filter(name_q).order_by("-created_at")[:100])

    # Also include payment transactions as virtual SMS records
    student_name = f"{student.first_name} {student.last_name}"
    for t in transactions:
        if t.transaction_type == "payment":
            sms_history.append({
                "sms_type": "payment",
                "recipient_name": student_name,
                "recipient_phone": student.phone,
                "student_name": student_name,
                "message": f"{t.amount} so'm to'lov qabul qilindi",
                "status": "yuborildi" if t.created_by else "qayd etildi",
                "created_at": t.created_at,
            })

    # Include absent attendance records as virtual SMS records
    for a in attendance_history:
        if a.status == "absent":
            sms_history.append({
                "sms_type": "absence",
                "recipient_name": student_name,
                "recipient_phone": student.phone,
                "student_name": student_name,
                "message": f"{a.date} kuni darsga kelmadi ({a.group.name})",
                "status": "qayd etildi",
                "created_at": a.created_at,
            })

    # Sort by date descending
    def get_date(obj):
        if hasattr(obj, "created_at"):
            return obj.created_at
        return obj.get("created_at") or ""
    sms_history.sort(key=get_date, reverse=True)
    sms_history = sms_history[:100]

    return render(request, "student/profile.html", {
        "student": student, "logs": logs, "groups": groups,
        "attendance_history": attendance_history,
        "admin_name": admin_name,
        "all_students": all_students,
        "payment_methods": PaymentMethod.objects.filter(is_active=True),
        "transactions": transactions,
        "education_types": education_types,
        "remaining_lessons": remaining_lessons,
        "prev_debt": prev_debt,
        "current_expected": current_expected,
        "total_expected": prev_debt + current_expected,
        "shu_kungacha": shu_kungacha,
        "oy_oxirigacha": oy_oxirigacha,
        "total_owed": total_owed,
        "monthly_debts": monthly_debts,
        "deferred_payments": deferred_payments,
        "sms_history": sms_history,
    })


@login_required(login_url="login")
def student_send_sms(request):
    if request.method != "POST":
        return JsonResponse({"success": False, "error": "Faqat POST so'rov qabul qilinadi"})

    student_id = request.POST.get("student_id")
    recipient_phone = request.POST.get("recipient_phone", "").strip()
    recipient_name = request.POST.get("recipient_name", "").strip()
    message = request.POST.get("message", "").strip()

    if not student_id or not recipient_phone or not message:
        return JsonResponse({"success": False, "error": "Barcha maydonlarni to'ldiring"})

    student = get_object_or_404(Student, pk=student_id)

    from .sms_service import _get_token, _get_credentials, _send_single_sms, _get_sms_signature, _sanitize_signature
    _, _, user_id = _get_credentials()
    if not user_id:
        return JsonResponse({"success": False, "error": "SMS xizmati konfiguratsiyasi topilmadi"})

    token = _get_token()
    if not token:
        return JsonResponse({"success": False, "error": "SMS xizmatiga ulanib bo'lmadi"})

    signature = _get_sms_signature()
    full_message = f"{message} {signature}"

    student_name = f"{student.first_name} {student.last_name}"
    ok = _send_single_sms(full_message, recipient_phone, student_name, user_id, token, f"SMS - {student_name}")

    SmsHistory.objects.create(
        sms_type="debt",
        recipient_name=recipient_name or student_name,
        recipient_phone=recipient_phone,
        student_name=student_name,
        message=full_message,
        status="yuborildi" if ok else "xato",
        sent_by=request.user,
    )

    if ok:
        return JsonResponse({"success": True})
    else:
        return JsonResponse({"success": False, "error": "SMS yuborishda xatolik yuz berdi"})


@login_required(login_url="login")
def student_freeze(request, pk):
    student = get_object_or_404(Student, pk=pk)
    if request.method == "POST":
        form = FreezeForm(request.POST)
        if form.is_valid():
            days = form.cleaned_data["days"]
            reason = form.cleaned_data["reason"]
            frozen_until = date.today() + timedelta(days=days)
            student.frozen_until = frozen_until
            student.save(update_fields=["frozen_until"])
            _log_student_action(
                student, student.groups.first(), "frozen",
                f"{days} kunga muzlatildi. {reason}" if reason else f"{days} kunga muzlatildi",
                request=request,
            )

            # Auto-create absent attendance for future lesson dates
            freez_note = "Muzlatilgan"
            if reason:
                freez_note += f" - {reason}"
            weekday_map = {0:"dushanba",1:"seshanba",2:"chorshanba",3:"payshanba",4:"juma",5:"shanba",6:"yakshanba"}
            today = date.today()
            for group in student.groups.all():
                lesson_day_nums = set()
                for lt in group.lesson_times.all():
                    for d_name in lt.days.split(","):
                        d_name = d_name.strip()
                        for num, uz_name in weekday_map.items():
                            if uz_name == d_name:
                                lesson_day_nums.add(num)
                d = today
                max_date = min(frozen_until, group.end_date) if group.end_date else frozen_until
                while d <= max_date:
                    if d.weekday() in lesson_day_nums:
                        Attendance.objects.update_or_create(
                            group=group,
                            student=student,
                            date=d,
                            defaults={"status": "absent", "notes": freez_note}
                        )
                    d += timedelta(days=1)

            messages.success(request, f"{student.first_name} {student.last_name} {days} kunga muzlatildi")
            return redirect("student_profile", pk=student.pk)
    else:
        form = FreezeForm()
    return render(request, "student/freeze.html", {"form": form, "student": student})


@login_required(login_url="login")
def student_unfreeze(request, pk):
    student = get_object_or_404(Student, pk=pk)
    # Remove auto-created absent records from freezing
    Attendance.objects.filter(
        student=student,
        status="absent",
        notes__startswith="Muzlatilgan"
    ).delete()
    student.frozen_until = None
    student.save(update_fields=["frozen_until"])
    _log_student_action(student, student.groups.first(), "unfrozen", "Muzlatish bekor qilindi", request=request)
    messages.success(request, f"{student.first_name} {student.last_name} muzlatish bekor qilindi")
    return redirect("student_profile", pk=student.pk)


@login_required(login_url="login")
def student_remove_from_group(request, pk):
    student = get_object_or_404(Student, pk=pk)
    if request.method == "POST":
        form = RemoveFromGroupForm(request.POST)
        if form.is_valid():
            reason = form.cleaned_data["reason"]
            group = student.groups.first()
            student.groups.clear()
            student.frozen_until = None
            student.status = "chiqarilgan"
            student.save(update_fields=["frozen_until", "status"])
            _log_student_action(student, group, "removed", reason, request=request)
            messages.success(request, f"{student.first_name} {student.last_name} guruhdan chiqarildi")
            if group:
                return redirect("group_detail", pk=group.pk)
            return redirect("student_profile", pk=student.pk)
    else:
        form = RemoveFromGroupForm()
    return render(request, "student/remove.html", {"form": form, "student": student})


@login_required(login_url="login")
def student_add_to_group(request, pk):
    student = get_object_or_404(Student, pk=pk)
    if request.method == "POST":
        form = AddToGroupForm(request.POST)
        if form.is_valid():
            group = form.cleaned_data["group"]
            if group in student.groups.all():
                messages.warning(request, f"{student.first_name} {student.last_name} allaqachon {group.name} guruhiga qo'shilgan!")
                return redirect("student_profile", pk=student.pk)
            reason = form.cleaned_data["reason"]
            student.groups.add(group)
            student.frozen_until = None
            student.status = "kutilyotgan"
            student.save(update_fields=["frozen_until", "status"])
            _log_student_action(student, group, "joined", reason or "Profil sahifasidan qo'shildi", request=request)
            messages.success(request, f"{student.first_name} {student.last_name} {group.name} guruhiga qo'shildi")
            return redirect("group_detail", pk=group.pk)
    else:
        form = AddToGroupForm()
    return render(request, "student/add_to_group.html", {"form": form, "student": student})


@login_required(login_url="login")
def group_freeze(request, pk):
    group = get_object_or_404(Group, pk=pk)
    if request.method == "POST":
        form = FreezeForm(request.POST)
        if form.is_valid():
            days = form.cleaned_data["days"]
            reason = form.cleaned_data["reason"]
            frozen_until = date.today() + timedelta(days=days)
            students = group.students.filter(
                Q(frozen_until__isnull=True) | Q(frozen_until__lt=date.today())
            )
            for student in students:
                student.frozen_until = frozen_until
                student.save(update_fields=["frozen_until"])
                _log_student_action(
                    student, group, "frozen",
                    f"Guruh bilan {days} kunga muzlatildi. {reason}" if reason else f"Guruh bilan {days} kunga muzlatildi",
                    request=request,
                )
            _log_group_action(group, "frozen", f"Guruh {days} kunga muzlatildi ({students.count()} ta o'quvchi)", request)
            messages.success(request, f"Guruh {days} kunga muzlatildi ({students.count()} ta o'quvchi)")
            return redirect("group_detail", pk=group.pk)
    else:
        form = FreezeForm()
    return render(request, "group/freeze.html", {"form": form, "group": group})


@login_required(login_url="login")
def group_archive(request, pk):
    group = get_object_or_404(Group, pk=pk)
    if request.method == "POST":
        students = group.students.all()
        for student in students:
            student.groups.remove(group)
            student.graduated_groups.add(group)
            student.frozen_until = None
            student.status = Student.Status.GRADUATED
            student.save(update_fields=["frozen_until", "status"])
            _log_student_action(student, group, "graduated", f"{group.name} guruhi arxivlandi", request=request)
        group.status = "arxivlangan"
        group.save()
        _log_group_action(group, "archived", f"Guruh arxivlandi ({students.count()} ta o'quvchi bitirildi)", request)
        messages.success(request, f"Guruh arxivlandi va {students.count()} ta o'quvchi bitirildi")
        return redirect("group_list")
    return render(request, "group/archive.html", {"group": group})


@login_required(login_url="login")
def group_settings(request, pk):
    group = get_object_or_404(Group, pk=pk)
    group_form = GroupForm(instance=group)
    lesson_form = LessonTimeForm(group=group)
    lesson_times = group.lesson_times.all()

    if request.method == "POST":
        if "update_group" in request.POST:
            old_teacher = str(group.teacher) if group.teacher else "-"
            old_room = str(group.room) if group.room else "-"
            old_start = group.start_date
            old_end = group.end_date
            group_form = GroupForm(request.POST, instance=group)
            if group_form.is_valid():
                group_form.save()
                # Agar end_date qisqartirilgan bo'lsa, keyingi davomatlarni o'chirish
                if old_end and group.end_date and group.end_date < old_end:
                    deleted, _ = Attendance.objects.filter(
                        group=group,
                        date__gt=group.end_date,
                    ).delete()
                    if deleted:
                        _log_group_action(group, "attendance_cleaned",
                            f"end_date {old_end} → {group.end_date}, {deleted} ta davomat o'chirildi", request)
                changes = []
                new_teacher = str(group.teacher) if group.teacher else "-"
                new_room = str(group.room) if group.room else "-"
                if old_teacher != new_teacher:
                    changes.append(f"O'qituvchi: {old_teacher} → {new_teacher}")
                if old_room != new_room:
                    changes.append(f"Xona: {old_room} → {new_room}")
                if old_start != group.start_date:
                    changes.append(f"Boshlanish: {old_start} → {group.start_date}")
                if old_end != group.end_date:
                    changes.append(f"Tugash: {old_end} → {group.end_date}")
                desc = "; ".join(changes) if changes else "Sozlamalar yangilandi"
                _log_group_action(group, "settings_updated", desc, request)
                messages.success(request, "Guruh sozlamalari saqlandi")
                return redirect("group_settings", pk=group.pk)
        elif "add_lesson" in request.POST:
            lesson_form = LessonTimeForm(request.POST, group=group)
            if lesson_form.is_valid():
                lesson = lesson_form.save(commit=False)
                lesson.group = group
                lesson.save()
                _log_group_action(group, "lesson_added", f"Dars vaqti qo'shildi: {lesson.days} {lesson.start_time}-{lesson.end_time}", request)
                messages.success(request, "Dars vaqti qo'shildi")
                return redirect("group_settings", pk=group.pk)
        elif "delete_lesson" in request.POST:
            lesson_id = request.POST.get("lesson_id")
            if lesson_id:
                lt = LessonTime.objects.filter(pk=lesson_id, group=group).first()
                if lt:
                    _log_group_action(group, "lesson_deleted", f"Dars vaqti o'chirildi: {lt.days} {lt.start_time}-{lt.end_time}", request)
                LessonTime.objects.filter(pk=lesson_id, group=group).delete()
                messages.success(request, "Dars vaqti o'chirildi")
                return redirect("group_settings", pk=group.pk)

    return render(request, "group/settings.html", {
        "group": group,
        "group_form": group_form,
        "lesson_form": lesson_form,
        "lesson_times": lesson_times,
    })


@login_required(login_url="login")
@login_required(login_url="login")
def employee_list(request):
    employees = Employee.all_objects.filter(is_deleted=False).select_related("position", "role").annotate(
        group_count=Count("teacher_groups")
    ).all().order_by("-is_active", "-created_at")
    return render(request, "employee/list.html", {"employees": employees})


@login_required(login_url="login")
def employee_create(request):
    form = EmployeeForm()
    if request.method == "POST":
        form = EmployeeForm(request.POST, request.FILES)
        if form.is_valid():
            employee = form.save(commit=False)
            password = form.cleaned_data.get("password")
            if password:
                user = User.objects.create_user(
                    username=employee.phone,
                    password=password,
                    first_name=employee.first_name,
                    last_name=employee.last_name,
                )
                employee.user = user
            employee.save()
            form.save_m2m()
            messages.success(request, "Xodim muvaffaqiyatli qo'shildi")
            return redirect("employee_list")
    return render(request, "employee/create.html", {"form": form})


@login_required(login_url="login")
def employee_profile(request, pk):
    employee = get_object_or_404(
        Employee.all_objects.select_related("position", "role", "user").prefetch_related("branches"),
        pk=pk
    )
    groups = employee.teacher_groups.select_related("course", "room").annotate(
        student_count=Count("students")
    ).all().order_by("-created_at")
    receipts = SavedReceipt.objects.none()
    if employee.user:
        receipts = SavedReceipt.objects.filter(created_by=employee.user).order_by("-created_at")[:20]
    return render(request, "employee/profile.html", {
        "employee": employee,
        "groups": groups,
        "receipts": receipts,
    })


@login_required(login_url="login")
def employee_update(request, pk):
    employee = get_object_or_404(Employee.all_objects, pk=pk)
    form = EmployeeForm(instance=employee)
    if request.method == "POST":
        form = EmployeeForm(request.POST, request.FILES, instance=employee)
        if form.is_valid():
            employee = form.save(commit=False)
            password = form.cleaned_data.get("password")
            if password:
                if employee.user:
                    employee.user.set_password(password)
                    employee.user.save()
                else:
                    user = User.objects.create_user(
                        username=employee.phone,
                        password=password,
                        first_name=employee.first_name,
                        last_name=employee.last_name,
                    )
                    employee.user = user
            employee.save()
            form.save_m2m()
            messages.success(request, "Xodim muvaffaqiyatli yangilandi")
            return redirect("employee_profile", pk=employee.pk)
    return render(request, "employee/create.html", {"form": form})


@login_required(login_url="login")
def employee_delete(request, pk):
    employee = get_object_or_404(Employee.all_objects, pk=pk)
    if request.method == "POST":
        if employee.user:
            employee.user.is_active = False
            employee.user.save(update_fields=["is_active"])
        employee.delete()
        messages.success(request, "Xodim muvaffaqiyatli o'chirildi (faolligi bekor qilindi)")
        return redirect("employee_list")
    return render(request, "employee/delete.html", {"object": employee, "title": "Xodimni o'chirish"})


@login_required(login_url="login")
def branch_list(request):
    branches = Branch.objects.filter(is_active=True).order_by("-created_at")
    return render(request, "branch/list.html", {"branches": branches})


@login_required(login_url="login")
def branch_create(request):
    form = BranchForm()
    if request.method == "POST":
        form = BranchForm(request.POST)
        if form.is_valid():
            form.save()
            messages.success(request, "Filial muvaffaqiyatli qo'shildi")
            return redirect("branch_list")
    return render(request, "branch/form.html", {"form": form, "title": "Filial qo'shish"})


@login_required(login_url="login")
def branch_update(request, pk):
    branch = get_object_or_404(Branch, pk=pk)
    form = BranchForm(instance=branch)
    if request.method == "POST":
        form = BranchForm(request.POST, instance=branch)
        if form.is_valid():
            form.save()
            messages.success(request, "Filial muvaffaqiyatli yangilandi")
            return redirect("branch_list")
    return render(request, "branch/form.html", {"form": form, "title": "Filialni tahrirlash"})


@login_required(login_url="login")
def branch_delete(request, pk):
    branch = get_object_or_404(Branch, pk=pk)
    if request.method == "POST":
        branch.delete()
        messages.success(request, "Filial muvaffaqiyatli o'chirildi (faolligi bekor qilindi)")
        return redirect("branch_list")
    return render(request, "branch/delete.html", {"object": branch, "title": "Filialni o'chirish"})


@login_required(login_url="login")
def room_list(request):
    rooms = Room.objects.filter(is_active=True).order_by("-created_at")
    return render(request, "room/list.html", {"rooms": rooms})


@login_required(login_url="login")
def room_create(request):
    form = RoomForm()
    if request.method == "POST":
        form = RoomForm(request.POST)
        if form.is_valid():
            form.save()
            messages.success(request, "Xona muvaffaqiyatli qo'shildi")
            return redirect("room_list")
    return render(request, "room/form.html", {"form": form, "title": "Xona qo'shish"})


@login_required(login_url="login")
def room_update(request, pk):
    room = get_object_or_404(Room, pk=pk)
    form = RoomForm(instance=room)
    if request.method == "POST":
        form = RoomForm(request.POST, instance=room)
        if form.is_valid():
            form.save()
            messages.success(request, "Xona muvaffaqiyatli yangilandi")
            return redirect("room_list")
    return render(request, "room/form.html", {"form": form, "title": "Xonani tahrirlash"})


@login_required(login_url="login")
def room_delete(request, pk):
    room = get_object_or_404(Room, pk=pk)
    if request.method == "POST":
        room.delete()
        messages.success(request, "Xona muvaffaqiyatli o'chirildi (faolligi bekor qilindi)")
        return redirect("room_list")
    return render(request, "room/delete.html", {"object": room, "title": "Xonani o'chirish"})


@login_required(login_url="login")
def position_list(request):
    positions = Position.objects.filter(is_active=True).order_by("-created_at")
    return render(request, "position/list.html", {"positions": positions})


@login_required(login_url="login")
def position_create(request):
    form = PositionForm()
    if request.method == "POST":
        form = PositionForm(request.POST)
        if form.is_valid():
            form.save()
            messages.success(request, "Vazifa muvaffaqiyatli qo'shildi")
            return redirect("position_list")
    return render(request, "position/form.html", {"form": form, "title": "Vazifa qo'shish"})


@login_required(login_url="login")
def position_update(request, pk):
    position = get_object_or_404(Position, pk=pk)
    form = PositionForm(instance=position)
    if request.method == "POST":
        form = PositionForm(request.POST, instance=position)
        if form.is_valid():
            form.save()
            messages.success(request, "Vazifa muvaffaqiyatli yangilandi")
            return redirect("position_list")
    return render(request, "position/form.html", {"form": form, "title": "Vazifani tahrirlash"})


@login_required(login_url="login")
def position_delete(request, pk):
    position = get_object_or_404(Position, pk=pk)
    if request.method == "POST":
        position.delete()
        messages.success(request, "Vazifa muvaffaqiyatli o'chirildi (faolligi bekor qilindi)")
        return redirect("position_list")
    return render(request, "position/delete.html", {"object": position, "title": "Vazifani o'chirish"})


@login_required(login_url="login")
def statistics(request):
    total_courses = Course.objects.count()
    total_groups = Group.objects.count()
    total_students = Student.objects.count()
    total_surveys = MarketingSurvey.objects.count()
    pending_students = Student.objects.filter(groups__isnull=True, status="kutilyotgan").count()
    active_groups = Group.objects.filter(status="aktiv").count()
    pending_groups_count = Group.objects.filter(status="kutilyotgan").count()
    online_groups = Group.objects.filter(education_type="onlayn").count()
    offline_groups = Group.objects.filter(education_type="oflayn").count()
    toq_groups = Group.objects.filter(day_type="toq").count()
    juft_groups = Group.objects.filter(day_type="juft").count()
    har_kun_groups = Group.objects.filter(day_type="har_kun").count()

    group_students = Group.objects.annotate(count=Count("students")).values("name", "count")
    survey_stats = MarketingSurvey.objects.annotate(
        count=Count("students")
    ).order_by("-count")
    total_survey_students = sum(s.count for s in survey_stats)

    recent_students = Student.objects.prefetch_related("groups", "marketing_survey").order_by("-created_at")[:10]

    return render(request, "statistics.html", {
        "total_courses": total_courses,
        "total_groups": total_groups,
        "total_students": total_students,
        "total_surveys": total_surveys,
        "pending_students": pending_students,
        "active_groups": active_groups,
        "pending_groups_count": pending_groups_count,
        "online_groups": online_groups,
        "offline_groups": offline_groups,
        "toq_groups": toq_groups,
        "juft_groups": juft_groups,
        "har_kun_groups": har_kun_groups,
        "group_students": group_students,
        "survey_stats": survey_stats,
        "total_survey_students": total_survey_students,
        "recent_students": recent_students,
    })


@login_required(login_url="login")
def survey_list(request):
    surveys = MarketingSurvey.objects.filter(is_active=True).annotate(
        student_count=Count("students")
    ).order_by("-created_at")
    return render(request, "survey/list.html", {"surveys": surveys})


@login_required(login_url="login")
def survey_create(request):
    form = MarketingSurveyForm()
    if request.method == "POST":
        form = MarketingSurveyForm(request.POST)
        if form.is_valid():
            form.save()
            messages.success(request, "So'rovnoma muvaffaqiyatli qo'shildi")
            return redirect("survey_list")
    return render(request, "survey/form.html", {"form": form, "title": "So'rovnoma qo'shish"})


@login_required(login_url="login")
def survey_update(request, pk):
    survey = get_object_or_404(MarketingSurvey, pk=pk)
    form = MarketingSurveyForm(instance=survey)
    if request.method == "POST":
        form = MarketingSurveyForm(request.POST, instance=survey)
        if form.is_valid():
            form.save()
            messages.success(request, "So'rovnoma muvaffaqiyatli yangilandi")
            return redirect("survey_list")
    return render(request, "survey/form.html", {"form": form, "title": "So'rovnomani tahrirlash"})


@login_required(login_url="login")
def survey_delete(request, pk):
    survey = get_object_or_404(MarketingSurvey, pk=pk)
    if request.method == "POST":
        survey.delete()
        messages.success(request, "So'rovnoma muvaffaqiyatli o'chirildi (faolligi bekor qilindi)")
        return redirect("survey_list")
    return render(request, "survey/delete.html", {"object": survey, "title": "So'rovnomani o'chirish"})


@login_required(login_url="login")
def dismiss_removed_log(request, pk):
    if request.method == "POST":
        log = get_object_or_404(StudentLog, pk=pk)
        log.delete()
        return JsonResponse({"ok": True})
    return JsonResponse({"ok": False}, status=405)


@login_required(login_url="login")
def absence_reason_list(request):
    reasons = AbsenceReason.all_objects.all().order_by("order", "name")
    active_count = reasons.filter(is_active=True).count()
    inactive_count = reasons.filter(is_active=False).count()
    return render(request, "absence_reason/list.html", {
        "reasons": reasons,
        "active_count": active_count,
        "inactive_count": inactive_count,
    })


@login_required(login_url="login")
def absence_reason_create(request):
    if request.method == "POST":
        name = request.POST.get("name", "").strip()
        reason_type = request.POST.get("reason_type", "both")
        is_active = request.POST.get("is_active") == "on"
        order = request.POST.get("order", 0)
        if name:
            AbsenceReason.objects.create(
                name=name,
                reason_type=reason_type,
                is_active=is_active,
                order=int(order) if order else 0,
            )
            messages.success(request, "Davomat sababi qo'shildi")
        else:
            messages.error(request, "Sabab nomini yozing!")
        return redirect("absence_reason_list")
    return redirect("absence_reason_list")


@login_required(login_url="login")
def absence_reason_update(request, pk):
    reason = get_object_or_404(AbsenceReason, pk=pk)
    if request.method == "POST":
        name = request.POST.get("name", "").strip()
        reason_type = request.POST.get("reason_type", "both")
        is_active = request.POST.get("is_active") == "on"
        order = request.POST.get("order", 0)
        if name:
            reason.name = name
            reason.reason_type = reason_type
            reason.is_active = is_active
            reason.order = int(order) if order else 0
            reason.save()
            messages.success(request, "Davomat sababi yangilandi")
        else:
            messages.error(request, "Sabab nomini yozing!")
        return redirect("absence_reason_list")
    return redirect("absence_reason_list")


@login_required(login_url="login")
def absence_reason_delete(request, pk):
    reason = get_object_or_404(AbsenceReason, pk=pk)
    if request.method == "POST":
        reason.delete()
        messages.success(request, "Davomat sababi o'chirildi (faolligi bekor qilindi)")
        return redirect("absence_reason_list")
    return render(request, "absence_reason/delete.html", {"reason": reason})


# ===== BALANCE & PAYMENT VIEWS =====

@login_required(login_url="login")
def payment_create(request):
    if request.method == "POST":
        kassa_id = request.POST.get("kassa_id")
        if kassa_id:
            user_kassa = Kassa.objects.filter(pk=kassa_id, owner=request.user, is_active=True).first()
        else:
            user_kassa = Kassa.objects.filter(owner=request.user, is_active=True).first()
        if not user_kassa:
            return JsonResponse({"success": False, "error": "Sizga kassa biriktirilmagan! To'lov qabul qilish uchun avval kassangiz bo'lishi kerak. Administrator bilan bog'laning."})
        student_id = request.POST.get("student_id")
        amount = request.POST.get("amount", "0")
        description = request.POST.get("description", "").strip()
        payment_method = request.POST.get("payment_method", "").strip()
        paid_months = request.POST.get("paid_months", "")
        deferred_months = request.POST.get("deferred_months", "")
        if not student_id or not amount:
            return JsonResponse({"success": False, "error": "O'quvchi va summani kiriting!"})
        try:
            amount = Decimal(amount)
        except:
            return JsonResponse({"success": False, "error": "Noto'g'ri summa!"})
        if amount <= 0:
            return JsonResponse({"success": False, "error": "Summa musbat bo'lishi kerak!"})
        student = get_object_or_404(Student, pk=student_id)
        employee = getattr(request.user, 'employee_profile', None)
        created_by = "Admin"
        if employee:
            created_by = f"{employee.first_name} {employee.last_name or ''}".strip()
        # Build description: paid months + deferred months with per-month reasons
        parts = ["pt:full"]
        if paid_months:
            parts.append(f"pm:{paid_months}")
        if deferred_months:
            for dm in deferred_months.split(','):
                dm = dm.strip()
                if ':' in dm:
                    m, sabab = dm.split(':', 1)
                    parts.append(f"df:{m}:{sabab}")
                else:
                    parts.append(f"df:{dm}")
        alloc_desc = '|'.join(parts)
        full_desc = alloc_desc
        balance, transaction = process_payment(student, amount, description=full_desc, created_by=created_by, payment_method=payment_method)

        # Create correction for written-off months' debts
        if deferred_months:
            try:
                _, def_list = _calc_monthly_debts(student)
                writeoff_total = Decimal('0.00')
                def_month_list = [dm.split(':')[0].strip() for dm in deferred_months.split(',')]
                for d in def_list:
                    if d["month"] in def_month_list:
                        writeoff_total += Decimal(str(d.get("debt", 0)))
                if writeoff_total > 0:
                    add_balance_transaction(
                        student=student,
                        amount=writeoff_total,
                        transaction_type=Transaction.Type.CORRECTION,
                        description=f"Kechilgan oylar uchun korreksiya: {','.join(def_month_list)}",
                        created_by=created_by,
                    )
            except Exception:
                pass
        sms_sent = False
        sms_note = ""
        try:
            sms_sent = send_payment_received_sms(student, amount)
            sms_note = "SMS yuborildi" if sms_sent else "SMS yuborilmadi — o'quvchi profilidagi 'SMS tarixi' bo'limidan sababni tekshiring"
        except Exception as e:
            logger.exception(f"To'lov SMS xatolik: {e}")
            sms_note = f"SMS xatolik: {e}"
        # Kassaga tolovni qoshish (user_kassa allaqacha tekshirilgan yuqorida)
        try:
            bal_before = user_kassa.balance
            student_info = f"{student.first_name} {student.last_name}"
            KassaTransaction.objects.create(
                kassa=user_kassa,
                transaction_type=KassaTransaction.TransactionType.PAYMENT,
                amount=amount,
                balance_before=bal_before,
                balance_after=bal_before + amount,
                description=description or f"Tolov qabul qilindi — {student_info}",
                student=student,
                payment_method=payment_method,
                created_by=created_by,
                created_by_user=request.user,
            )
        except Exception:
            pass
        pm_obj = PaymentMethod.objects.filter(name__iexact=payment_method).first()
        method_label = pm_obj.name if pm_obj else (payment_method.title() if payment_method else "")
        receipt_settings = ReceiptSettings.get_instance()
        settings = {
            "academy_name": receipt_settings.academy_name,
            "tagline": receipt_settings.tagline,
            "accent_color": receipt_settings.accent_color,
            "receipt_title": receipt_settings.receipt_title,
            "receipt_prefix": receipt_settings.receipt_prefix,
            "receipt_format": receipt_settings.receipt_format,
            "footer_text": receipt_settings.footer_text,
            "thank_you_text": receipt_settings.thank_you_text,
            "payment_text": receipt_settings.payment_text,
            "extra_notes": receipt_settings.extra_notes,
            "message_text": receipt_settings.message_text,
            "qr_link": receipt_settings.qr_link,
            "phone": receipt_settings.phone,
            "telegram": receipt_settings.telegram,
            "instagram": receipt_settings.instagram,
            "website": receipt_settings.website,
            "address": receipt_settings.address,
            "paper_width": receipt_settings.paper_width,
            "paper_height": receipt_settings.paper_height,
            "paper_padding": receipt_settings.paper_padding,
            "font_name": receipt_settings.font_name,
            "font_tagline": receipt_settings.font_tagline,
            "font_title": receipt_settings.font_title,
            "font_row": receipt_settings.font_row,
            "font_amount_label": receipt_settings.font_amount_label,
            "font_amount": receipt_settings.font_amount,
            "font_balance": receipt_settings.font_balance,
            "font_thanks": receipt_settings.font_thanks,
            "font_footer": receipt_settings.font_footer,
            "font_contact": receipt_settings.font_contact,
            "font_notes": receipt_settings.font_notes,
            "logo_url": receipt_settings.logo.url if receipt_settings.logo else "",
        }
        receipt_html = render_to_string("receipt/print.html", {
            "transaction": transaction,
            "settings": settings,
            "inline": True,
        }, request=request)
        SavedReceipt.objects.update_or_create(
            transaction=transaction,
            defaults={
                "receipt_html": receipt_html,
                "settings_snapshot": settings,
                "created_by": request.user if request.user.is_authenticated else None,
                "student_name": f"{student.first_name} {student.last_name}",
                "amount": amount,
            }
        )
        response_data = {
            "success": True,
            "transaction_id": transaction.pk,
            "student_name": f"{student.first_name} {student.last_name}",
            "amount": float(amount),
            "admin_name": created_by,
            "date": timezone.localtime().strftime("%d.%m.%Y %H:%M"),
            "balance": float(balance.balance),
            "payment_method": method_label,
            "qr_link": receipt_settings.qr_link or "",
            "receipt_html": receipt_html,
            "sms_sent": sms_sent,
            "sms_note": sms_note,
        }
        return JsonResponse(response_data)
    user_kassalar = Kassa.objects.filter(owner=request.user, is_active=True)
    if not user_kassalar.exists():
        messages.error(request, "Sizga kassa biriktirilmagan! To'lov qabul qilish uchun avval kassangiz bo'lishi kerak. Administrator bilan bog'laning.")
        return redirect("kassa_dashboard")
    students = Student.objects.all().prefetch_related('groups').order_by("first_name", "last_name").distinct()
    student_data = []
    for s in students:
        try:
            balance = get_or_create_balance(s)
            bal_val = float(balance.balance)
        except Exception:
            bal_val = 0.0
        try:
            remaining = calculate_remaining_month_payment(s)
            rem_val = float(remaining)
        except Exception:
            rem_val = 0.0
        try:
            expected_up_to_today = calculate_expected_payment_up_to_today(s)
            exp_val = float(expected_up_to_today)
        except Exception:
            exp_val = 0.0
        try:
            prev_debt = calculate_previous_debt(s)
            prev_debt_val = float(prev_debt)
        except Exception:
            prev_debt_val = 0.0
        try:
            monthly, deferred = _calc_monthly_debts(s)
            monthly_debts_data = [{"label": m["label"], "debt": float(m["debt"]), "month": m["month_start"].strftime("%Y-%m")} for m in monthly]
        except Exception:
            monthly_debts_data = []
        groups_info = []
        for g in s.groups.filter(status='aktiv'):
            try:
                price = float(get_student_lesson_price(s, g))
            except Exception:
                price = 0.0
            groups_info.append({
                'name': g.name,
                'price': price,
                'id': g.pk,
            })
        total_owed_val = rem_val
        deferred_data = [{"month": d["month"], "reason": d.get("reason", ""), "label": d.get("label", d["month"]), "debt": d.get("debt", 0)} for d in deferred]
        student_data.append({
            'id': s.pk,
            'first_name': s.first_name,
            'last_name': s.last_name,
            'phone': s.phone,
            'balance': bal_val,
            'remaining_month_payment': rem_val,
            'expected_up_to_today': exp_val,
            'total_owed': total_owed_val,
            'oy_oxirigacha': total_owed_val,
            'previous_debt': prev_debt_val,
            'monthly_debts': monthly_debts_data,
            'deferred_payments': deferred_data,
            'groups': groups_info,
        })
    return render(request, "payment/create.html", {
        "students_json": json.dumps(student_data, ensure_ascii=False),
        "student_data": student_data,
        "user_kassalar": user_kassalar,
        "payment_methods": PaymentMethod.objects.filter(is_active=True),
        "paper_width": ReceiptSettings.get_instance().paper_width,
        "paper_height": ReceiptSettings.get_instance().paper_height,
        "paper_padding": ReceiptSettings.get_instance().paper_padding,
        "font_name": ReceiptSettings.get_instance().font_name,
        "font_tagline": ReceiptSettings.get_instance().font_tagline,
        "font_title": ReceiptSettings.get_instance().font_title,
        "font_row": ReceiptSettings.get_instance().font_row,
        "font_amount_label": ReceiptSettings.get_instance().font_amount_label,
        "font_amount": ReceiptSettings.get_instance().font_amount,
        "font_balance": ReceiptSettings.get_instance().font_balance,
        "font_thanks": ReceiptSettings.get_instance().font_thanks,
        "font_footer": ReceiptSettings.get_instance().font_footer,
        "font_contact": ReceiptSettings.get_instance().font_contact,
        "font_notes": ReceiptSettings.get_instance().font_notes,
    })


@login_required(login_url="login")
def payment_history(request):
    search = request.GET.get("search", "").strip()
    page = request.GET.get("page", 1)
    transactions = Transaction.objects.all().select_related("student", "group").order_by("-created_at")
    if search:
        q = Q(student__first_name__icontains=search) | Q(student__last_name__icontains=search)
        digits = "".join(c for c in search if c.isdigit())
        if digits:
            q |= Q(student__phone__icontains=digits)
        transactions = transactions.filter(q)
    paginator = Paginator(transactions, 50)
    page_obj = paginator.get_page(page)
    tx_list = []
    last_date = None
    for t in page_obj:
        d = t.created_at.strftime("%d.%m.%Y")
        show_date = d != last_date
        last_date = d
        tx_list.append({"t": t, "show_date": show_date, "date_str": d})
    return render(request, "payment/history.html", {
        "transactions": tx_list,
        "page_obj": page_obj,
        "search_query": search,
        "students": Student.objects.all().order_by("first_name", "last_name"),
        "payment_methods": PaymentMethod.objects.filter(is_active=True),
    })


@login_required(login_url="login")
def payment_filter(request):
    from django.db.models import Count, Q, Sum, F
    from django.db.models.functions import TruncMonth

    search = request.GET.get("search", "").strip()
    page = request.GET.get("page", 1)
    date_from = request.GET.get("date_from", "")
    date_to = request.GET.get("date_to", "")
    course_id = request.GET.get("course", "")
    group_id = request.GET.get("group", "")
    level_id = request.GET.get("level", "")
    balance_filter = request.GET.get("balance", "")
    moderator = request.GET.get("moderator", "")
    teacher_id = request.GET.get("teacher", "")
    category_id = request.GET.get("category", "")
    source_id = request.GET.get("source", "")
    student_id = request.GET.get("student", "")
    num_groups = request.GET.get("num_groups", "")
    day_filter = request.GET.get("day", "")
    day_type = request.GET.get("day_type", "")
    status_filter = request.GET.get("status", "")
    age_min = request.GET.get("age_min", "")
    age_max = request.GET.get("age_max", "")
    frozen_only = request.GET.get("frozen_only", "")
    tx_type = request.GET.get("tx_type", "")
    payment_method = request.GET.get("payment_method", "")

    students = Student.objects.prefetch_related("groups", "groups__course", "groups__teacher").all()

    if search:
        q = Q(first_name__icontains=search) | Q(last_name__icontains=search)
        digits = "".join(c for c in search if c.isdigit())
        if digits:
            q |= Q(phone__icontains=digits)
        students = students.filter(q)

    if course_id:
        students = students.filter(groups__course__id=course_id)

    if group_id:
        students = students.filter(groups__id=group_id)

    if level_id:
        students = students.filter(groups__level__id=level_id)

    if teacher_id:
        students = students.filter(groups__teacher__id=teacher_id)

    if category_id:
        students = students.filter(desired_course__id=category_id)

    if source_id:
        students = students.filter(marketing_survey__id=source_id)

    if student_id:
        students = students.filter(pk=student_id)

    if status_filter == "aktiv":
        students = students.filter(groups__isnull=False).exclude(status="chiqarilgan").exclude(frozen_until__gte=date.today())
    elif status_filter == "muzlatilgan":
        students = students.filter(frozen_until__gte=date.today())
    elif status_filter == "kutilyotgan":
        students = students.filter(groups__isnull=True, status="kutilyotgan")
    elif status_filter == "chiqarilgan":
        students = students.filter(status="chiqarilgan")

    if frozen_only == "1":
        students = students.filter(frozen_until__gte=date.today())

    if age_min:
        try:
            max_birth = date.today() - timedelta(days=int(age_min) * 365)
            students = students.filter(birth_date__lte=max_birth)
        except (ValueError, TypeError):
            pass

    if age_max:
        try:
            min_birth = date.today() - timedelta(days=(int(age_max) + 1) * 365)
            students = students.filter(birth_date__gte=min_birth)
        except (ValueError, TypeError):
            pass

    if day_filter:
        students = students.filter(groups__lesson_times__days__icontains=day_filter).distinct()

    if day_type:
        students = students.filter(groups__day_type=day_type).distinct()

    if num_groups:
        try:
            n = int(num_groups)
            students = students.annotate(cnt_groups=Count("groups", distinct=True)).filter(cnt_groups=n)
        except (ValueError, TypeError):
            pass

    students = students.distinct()

    student_ids = list(students.values_list("pk", flat=True))

    transactions = Transaction.objects.filter(student_id__in=student_ids).select_related("student", "group").order_by("-created_at")

    if date_from:
        try:
            df = date.fromisoformat(date_from)
            transactions = transactions.filter(created_at__date__gte=df)
        except (ValueError, TypeError):
            pass

    if date_to:
        try:
            dt_d = date.fromisoformat(date_to)
            transactions = transactions.filter(created_at__date__lte=dt_d)
        except (ValueError, TypeError):
            pass

    if tx_type:
        transactions = transactions.filter(transaction_type=tx_type)

    if payment_method:
        transactions = transactions.filter(payment_method=payment_method)

    if moderator:
        transactions = transactions.filter(created_by__icontains=moderator)

    if balance_filter == "debtor":
        debtor_ids = []
        for s in students:
            try:
                b = get_or_create_balance(s)
                if float(b.balance) < 0:
                    debtor_ids.append(s.pk)
            except Exception:
                pass
        transactions = transactions.filter(student_id__in=debtor_ids)
    elif balance_filter == "creditor":
        creditor_ids = []
        for s in students:
            try:
                b = get_or_create_balance(s)
                if float(b.balance) > 0:
                    creditor_ids.append(s.pk)
            except Exception:
                pass
        transactions = transactions.filter(student_id__in=creditor_ids)
    elif balance_filter == "zero":
        zero_ids = []
        for s in students:
            try:
                b = get_or_create_balance(s)
                if float(b.balance) == 0:
                    zero_ids.append(s.pk)
            except Exception:
                pass
        transactions = transactions.filter(student_id__in=zero_ids)
    elif balance_filter == "paid":
        paid_ids = []
        for s in students:
            try:
                rem = calculate_remaining_month_payment(s)
                if float(rem) <= 0:
                    paid_ids.append(s.pk)
            except Exception:
                pass
        transactions = transactions.filter(student_id__in=paid_ids)
    elif balance_filter == "unpaid":
        unpaid_ids = []
        for s in students:
            try:
                rem = calculate_remaining_month_payment(s)
                if float(rem) > 0:
                    unpaid_ids.append(s.pk)
            except Exception:
                pass
        transactions = transactions.filter(student_id__in=unpaid_ids)

    total_count = transactions.count()
    total_payment = transactions.filter(transaction_type="payment").aggregate(s=Sum("amount"))["s"] or 0
    total_lesson = transactions.filter(transaction_type="lesson").aggregate(s=Sum("amount"))["s"] or 0

    debtor_count = 0
    creditor_count = 0
    zero_balance_count = 0
    total_debt_sum = 0
    total_credit_sum = 0
    for s in students:
        try:
            b = get_or_create_balance(s)
            bal = float(b.balance)
            if bal < 0:
                debtor_count += 1
                total_debt_sum += abs(bal)
            elif bal > 0:
                creditor_count += 1
                total_credit_sum += bal
            else:
                zero_balance_count += 1
        except Exception:
            pass

    paginator = Paginator(transactions, 50)
    page_obj = paginator.get_page(page)

    courses = Course.objects.all()
    levels = CourseLevel.objects.all()
    groups = Group.objects.filter(status__in=["aktiv", "kutilyotgan"]).order_by("name")
    teachers = Employee.objects.filter(role__name__icontains="o'qituvchi").order_by("first_name") if Employee.objects.filter(role__name__icontains="o'qituvchi").exists() else Employee.objects.all().order_by("first_name")
    sources = MarketingSurvey.objects.all()
    categories = Course.objects.all()
    moderators_list = (
        Transaction.objects.exclude(created_by="")
        .values_list("created_by", flat=True)
        .distinct()
    )
    student_list = Student.objects.all().order_by("first_name", "last_name")

    active_filters = {
        "search": search, "date_from": date_from, "date_to": date_to,
        "course": course_id, "group": group_id, "level": level_id,
        "balance": balance_filter, "moderator": moderator, "teacher": teacher_id,
        "category": category_id, "source": source_id, "student": student_id,
        "num_groups": num_groups, "day": day_filter, "day_type": day_type,
        "status": status_filter, "age_min": age_min, "age_max": age_max,
        "frozen_only": frozen_only, "tx_type": tx_type, "payment_method": payment_method,
    }

    return render(request, "payment/filter.html", {
        "transactions": page_obj,
        "page_obj": page_obj,
        "total_count": total_count,
        "total_payment": float(total_payment),
        "total_lesson": float(total_lesson),
        "debtor_count": debtor_count,
        "creditor_count": creditor_count,
        "zero_balance_count": zero_balance_count,
        "total_debt_sum": total_debt_sum,
        "total_credit_sum": total_credit_sum,
        "student_count": students.count(),
        "courses": courses,
        "levels": levels,
        "groups": groups,
        "teachers": teachers,
        "sources": sources,
        "categories": categories,
        "moderators_list": moderators_list,
        "student_list": student_list,
        "active_filters": active_filters,
        "payment_methods": PaymentMethod.objects.filter(is_active=True),
    })


@login_required(login_url="login")
def debt_sms_page(request):
    from decimal import Decimal
    from .models import SmsHistory
    from django.db.models import Q

    debtors = Student.objects.filter(
        is_active=True, is_deleted=False,
        balance__balance__lt=Decimal('0.00')
    ).select_related('balance').prefetch_related('groups').order_by('first_name')

    debtor_list = []
    phone_filter = request.GET.get("phone", "")
    for s in debtors:
        has_phone = bool((s.father_phone and s.father_full_name) or (s.mother_phone and s.mother_full_name))
        if phone_filter == "bor" and not has_phone:
            continue
        if phone_filter == "yoq" and has_phone:
            continue
        group = s.groups.first()
        debtor_list.append({
            'id': s.id,
            'first_name': s.first_name,
            'last_name': s.last_name,
            'phone': s.phone,
            'father_phone': s.father_phone or '',
            'father_name': s.father_full_name or '',
            'mother_phone': s.mother_phone or '',
            'mother_name': s.mother_full_name or '',
            'balance': s.balance.balance if s.balance else Decimal('0.00'),
            'group_name': group.name if group else '-',
            'has_phone': has_phone,
        })

    sms_history = SmsHistory.objects.filter(sms_type="debt")

    status_filter = request.GET.get("status", "")
    date_from = request.GET.get("date_from", "")
    date_to = request.GET.get("date_to", "")
    search = request.GET.get("search", "")

    if status_filter in ("yuborildi", "xatolik", "otkazildi"):
        sms_history = sms_history.filter(status=status_filter)

    if date_from:
        sms_history = sms_history.filter(created_at__date__gte=date_from)

    if date_to:
        sms_history = sms_history.filter(created_at__date__lte=date_to)

    if search:
        sms_history = sms_history.filter(
            Q(student_name__icontains=search) |
            Q(recipient_name__icontains=search) |
            Q(recipient_phone__icontains=search)
        )

    sms_history = sms_history[:100]

    return render(request, "payment/debt_sms.html", {
        "debtors": debtor_list,
        "sms_history": sms_history,
        "filter_status": status_filter,
        "filter_date_from": date_from,
        "filter_date_to": date_to,
        "filter_search": search,
        "filter_phone": phone_filter,
        "active_tab": request.GET.get("tab", "debtors"),
    })


@login_required(login_url="login")
def send_debt_reminders_to_all(request):
    if request.method != "POST":
        return JsonResponse({"success": False, "error": "FAQAT POST so'rov qabul qilinadi"})
    if not request.user.is_superuser:
        return JsonResponse({"success": False, "error": "Faqat Super Admin bu amalni bajarishi mumkin!"})
    try:
        result = send_bulk_debt_reminders(user=request.user)
        return JsonResponse({
            "success": True,
            "message": f"SMS yuborildi: {result['sent']} ta yuborildi, {result['failed']} ta xatolik, {result['skipped']} ta o'tkazib yuborildi",
            "total_debtors": result["total_debtors"],
            "sent": result["sent"],
            "failed": result["failed"],
            "skipped": result["skipped"],
        })
    except Exception as e:
        return JsonResponse({"success": False, "error": f"Xatolik: {str(e)}"})


@login_required(login_url="login")
def student_balance_view(request, pk):
    student = get_object_or_404(Student, pk=pk)
    balance = get_or_create_balance(student)
    transactions = Transaction.objects.filter(student=student).select_related("group").order_by("-created_at")
    total_income = sum(t.amount for t in transactions if t.amount > 0)
    total_expense = sum(abs(t.amount) for t in transactions if t.amount < 0)
    return render(request, "student/balance.html", {
        "student": student,
        "balance": balance,
        "transactions": transactions,
        "total_income": total_income,
        "total_expense": total_expense,
    })


@login_required(login_url="login")
def balance_withdraw(request):
    if request.method == "POST":
        student_id = request.POST.get("student_id")
        amount = request.POST.get("amount", "0")
        description = request.POST.get("description", "").strip()
        if not student_id or not amount:
            return JsonResponse({"success": False, "error": "O'quvchi va summani kiriting!"})
        try:
            amount = Decimal(amount)
        except:
            return JsonResponse({"success": False, "error": "Noto'g'ri summa!"})
        if amount <= 0:
            return JsonResponse({"success": False, "error": "Summa musbat bo'lishi kerak!"})
        student = get_object_or_404(Student, pk=student_id)
        balance = get_or_create_balance(student)
        if balance.balance < amount:
            return JsonResponse({"success": False, "error": "Balansda yetarli mablag' mavjud emas!"})
        employee = getattr(request.user, 'employee_profile', None)
        created_by = "Admin"
        if employee:
            created_by = f"{employee.first_name} {employee.last_name or ''}".strip()
        balance.balance -= amount
        balance.save()
        transaction = Transaction.objects.create(
            student=student,
            amount=-amount,
            balance_after=balance.balance,
            transaction_type=Transaction.Type.WITHDRAWAL,
            description=description or "Balansdan pul yechildi",
            created_by=created_by,
        )
        receipt_settings = ReceiptSettings.get_instance()
        settings = {
            "academy_name": receipt_settings.academy_name,
            "tagline": receipt_settings.tagline,
            "accent_color": receipt_settings.accent_color,
            "receipt_title": receipt_settings.receipt_title,
            "receipt_prefix": receipt_settings.receipt_prefix,
            "receipt_format": receipt_settings.receipt_format,
            "footer_text": receipt_settings.footer_text,
            "thank_you_text": receipt_settings.thank_you_text,
            "payment_text": receipt_settings.payment_text,
            "extra_notes": receipt_settings.extra_notes,
            "message_text": receipt_settings.message_text,
            "qr_link": receipt_settings.qr_link,
            "phone": receipt_settings.phone,
            "telegram": receipt_settings.telegram,
            "instagram": receipt_settings.instagram,
            "website": receipt_settings.website,
            "address": receipt_settings.address,
            "paper_width": receipt_settings.paper_width,
            "paper_height": receipt_settings.paper_height,
            "paper_padding": receipt_settings.paper_padding,
            "font_name": receipt_settings.font_name,
            "font_tagline": receipt_settings.font_tagline,
            "font_title": receipt_settings.font_title,
            "font_row": receipt_settings.font_row,
            "font_amount_label": receipt_settings.font_amount_label,
            "font_amount": receipt_settings.font_amount,
            "font_balance": receipt_settings.font_balance,
            "font_thanks": receipt_settings.font_thanks,
            "font_footer": receipt_settings.font_footer,
            "font_contact": receipt_settings.font_contact,
            "font_notes": receipt_settings.font_notes,
            "logo_url": receipt_settings.logo.url if receipt_settings.logo else "",
        }
        receipt_html = render_to_string("receipt/print.html", {
            "transaction": transaction,
            "settings": settings,
            "inline": True,
        }, request=request)
        SavedReceipt.objects.update_or_create(
            transaction=transaction,
            defaults={
                "receipt_html": receipt_html,
                "settings_snapshot": settings,
                "created_by": request.user if request.user.is_authenticated else None,
                "student_name": f"{student.first_name} {student.last_name}",
                "amount": amount,
            }
        )
        response_data = {
            "success": True,
            "transaction_id": transaction.pk,
            "student_name": f"{student.first_name} {student.last_name}",
            "amount": float(amount),
            "admin_name": created_by,
            "date": timezone.localtime().strftime("%d.%m.%Y %H:%M"),
            "balance": float(balance.balance),
            "receipt_html": receipt_html,
        }
        return JsonResponse(response_data)
    return JsonResponse({"error": "POST so'rovi bo'lishi kerak"}, status=405)


@login_required(login_url="login")
def balance_transfer(request):
    if request.method == "POST":
        student_id = request.POST.get("student_id")
        to_student_id = request.POST.get("to_student_id")
        amount = request.POST.get("amount", "0")
        description = request.POST.get("description", "").strip()
        if not student_id or not to_student_id:
            return JsonResponse({"success": False, "error": "Jo'natuvchi va qabul qiluvchi o'quvchini tanlang!"})
        if student_id == to_student_id:
            return JsonResponse({"success": False, "error": "O'zini o'ziga o'tkazib bo'lmaydi!"})
        try:
            amount = Decimal(amount)
        except:
            return JsonResponse({"success": False, "error": "Noto'g'ri summa!"})
        if amount <= 0:
            return JsonResponse({"success": False, "error": "Summa musbat bo'lishi kerak!"})
        from_student = get_object_or_404(Student, pk=student_id)
        to_student = get_object_or_404(Student, pk=to_student_id)
        from_balance = get_or_create_balance(from_student)
        to_balance = get_or_create_balance(to_student)
        if from_balance.balance < amount:
            return JsonResponse({"success": False, "error": "Jo'natuvchi o'quvchining balansida yetarli mablag' mavjud emas!"})
        employee = getattr(request.user, 'employee_profile', None)
        created_by = "Admin"
        if employee:
            created_by = f"{employee.first_name} {employee.last_name or ''}".strip()
        from_balance.balance -= amount
        from_balance.save()
        Transaction.objects.create(
            student=from_student,
            amount=-amount,
            balance_after=from_balance.balance,
            transaction_type=Transaction.Type.WRONG,
            description=f"{to_student.first_name} {to_student.last_name} ga o'tkazildi. {description}".strip(),
            created_by=created_by,
        )
        to_balance.balance += amount
        to_balance.save()
        new_txn = Transaction.objects.create(
            student=to_student,
            amount=amount,
            balance_after=to_balance.balance,
            transaction_type=Transaction.Type.PAYMENT,
            description=f"{from_student.first_name} {from_student.last_name} dan o'tkazildi. {description}".strip(),
            created_by=created_by,
        )
        return JsonResponse({
            "success": True,
            "balance": float(from_balance.balance),
            "new_transaction_id": new_txn.pk,
            "message": "Pul muvaffaqiyatli o'tkazildi!",
        })
    return JsonResponse({"error": "POST so'rovi bo'lishi kerak"}, status=405)


@login_required(login_url="login")
def transfer_wrong_payment(request, pk):
    transaction = get_object_or_404(Transaction, pk=pk)
    if request.method == "POST":
        to_student_id = request.POST.get("to_student_id")
        description = request.POST.get("description", "").strip()
        if not to_student_id:
            return JsonResponse({"success": False, "error": "Qaysi o'quvchiga o'tkazishni tanlang!"})
        if transaction.amount <= 0 or transaction.transaction_type != Transaction.Type.PAYMENT:
            return JsonResponse({"success": False, "error": "Faqat to'lov tranzaksiyalarini o'tkazish mumkin!"})
        to_student = get_object_or_404(Student, pk=to_student_id)
        from_student = transaction.student
        amount = transaction.amount
        employee = getattr(request.user, 'employee_profile', None)
        created_by = "Admin"
        if employee:
            created_by = f"{employee.first_name} {employee.last_name or ''}".strip()
        from_balance = get_or_create_balance(from_student)
        to_balance = get_or_create_balance(to_student)
        if from_balance.balance < amount:
            return JsonResponse({"success": False, "error": "Jo'natuvchi o'quvchining balansida yetarli mablag' mavjud emas!"})
        from_balance.balance -= amount
        from_balance.save()
        Transaction.objects.create(
            student=from_student,
            amount=-amount,
            balance_after=from_balance.balance,
            transaction_type=Transaction.Type.WRONG,
            description=f"Xato to'lov: {to_student.first_name} {to_student.last_name} ga o'tkazildi. {description}",
            created_by=created_by,
        )
        to_balance.balance += amount
        to_balance.save()
        new_transaction = Transaction.objects.create(
            student=to_student,
            amount=amount,
            balance_after=to_balance.balance,
            transaction_type=Transaction.Type.PAYMENT,
            description=f"Xato to'lov: {from_student.first_name} {from_student.last_name} dan o'tkazildi. {description}",
            created_by=created_by,
        )
        messages.success(request, f"Xato to'lov {from_student.first_name} {from_student.last_name} dan {to_student.first_name} {to_student.last_name} ga o'tkazildi!")
        return JsonResponse({
            "success": True,
            "new_transaction_id": new_transaction.pk,
            "message": f"Xato to'lov muvaffaqiyatli o'tkazildi!",
        })
    return render(request, "payment/transfer_wrong.html", {
        "transaction": transaction,
        "students": Student.objects.all().order_by("first_name", "last_name"),
    })


@login_required(login_url="login")
def global_config(request):
    config = GlobalConfig.get_instance()
    if request.method == "POST":
        config.save()
        messages.success(request, "Sozlamalar saqlandi")
        return redirect("global_config")
    return render(request, "settings/global_config.html", {"config": config})


@login_required(login_url="login")
def receipt_settings(request):
    settings = ReceiptSettings.get_instance()
    if request.method == "POST":
        settings.academy_name = request.POST.get("academy_name", settings.academy_name)
        settings.tagline = request.POST.get("tagline", settings.tagline)
        settings.accent_color = request.POST.get("accent_color", settings.accent_color)
        settings.receipt_title = request.POST.get("receipt_title", settings.receipt_title)
        settings.receipt_prefix = request.POST.get("receipt_prefix", settings.receipt_prefix)
        settings.receipt_format = request.POST.get("receipt_format", settings.receipt_format)
        settings.footer_text = request.POST.get("footer_text", settings.footer_text)
        settings.thank_you_text = request.POST.get("thank_you_text", settings.thank_you_text)
        settings.payment_text = request.POST.get("payment_text", settings.payment_text)
        settings.extra_notes = request.POST.get("extra_notes", settings.extra_notes)
        settings.message_text = request.POST.get("message_text", settings.message_text)
        settings.qr_link = request.POST.get("qr_link", settings.qr_link)
        settings.auto_generate_qr = request.POST.get("auto_generate_qr") == "on"
        settings.phone = request.POST.get("phone", settings.phone)
        settings.sms_signature = request.POST.get("sms_signature", settings.sms_signature)
        settings.telegram = request.POST.get("telegram", settings.telegram)
        settings.instagram = request.POST.get("instagram", settings.instagram)
        settings.website = request.POST.get("website", settings.website)
        settings.address = request.POST.get("address", settings.address)
        settings.paper_width = request.POST.get("paper_width", settings.paper_width)
        settings.paper_height = request.POST.get("paper_height", settings.paper_height)
        settings.paper_padding = request.POST.get("paper_padding", settings.paper_padding)
        settings.font_name = request.POST.get("font_name", settings.font_name)
        settings.font_tagline = request.POST.get("font_tagline", settings.font_tagline)
        settings.font_title = request.POST.get("font_title", settings.font_title)
        settings.font_row = request.POST.get("font_row", settings.font_row)
        settings.font_amount_label = request.POST.get("font_amount_label", settings.font_amount_label)
        settings.font_amount = request.POST.get("font_amount", settings.font_amount)
        settings.font_balance = request.POST.get("font_balance", settings.font_balance)
        settings.font_thanks = request.POST.get("font_thanks", settings.font_thanks)
        settings.font_footer = request.POST.get("font_footer", settings.font_footer)
        settings.font_contact = request.POST.get("font_contact", settings.font_contact)
        settings.font_notes = request.POST.get("font_notes", settings.font_notes)
        if request.FILES.get("logo"):
            settings.logo = request.FILES["logo"]
        if request.POST.get("remove_logo") == "1":
            settings.logo.delete(save=False)
            settings.logo = None
        settings.save()
        messages.success(request, "Chek sozlamalari saqlandi")
        return redirect("receipt_settings")
    return render(request, "settings/receipt_settings.html", {"settings": settings})


@login_required(login_url="login")
def sms_settings(request):
    settings = ReceiptSettings.get_instance()
    if request.method == "POST":
        settings.sms_signature = request.POST.get("sms_signature", settings.sms_signature)
        settings.save()
        messages.success(request, "SMS sozlamalari saqlandi")
        return redirect("sms_settings")
    return render(request, "settings/sms_settings.html", {"settings": settings})


@login_required(login_url="login")
def qr_settings(request):
    settings = ReceiptSettings.get_instance()
    if request.method == "POST":
        settings.qr_link = request.POST.get("qr_link", settings.qr_link)
        settings.auto_generate_qr = request.POST.get("auto_generate_qr") == "on"
        settings.save()
        messages.success(request, "QR Code sozlamalari saqlandi")
        return redirect("qr_settings")
    return render(request, "settings/qr_settings.html", {"settings": settings})


@login_required(login_url="login")
def update_student_lesson_price(request, group_pk, student_pk):
    group = get_object_or_404(Group, pk=group_pk)
    student = get_object_or_404(Student, pk=student_pk)
    if request.method == "POST":
        price = request.POST.get("price", "").strip()
        try:
            if price == "":
                StudentLessonPrice.objects.filter(student=student, group=group).delete()
                messages.success(request, f"{student.first_name} uchun shaxsiy narx o'chirildi")
            else:
                price = Decimal(price)
                StudentLessonPrice.objects.update_or_create(
                    student=student, group=group,
                    defaults={"lesson_price": price}
                )
                messages.success(request, f"{student.first_name} uchun shaxsiy narx {price:,.0f} so'm qilib belgilandi")
        except:
            messages.error(request, "Noto'g'ri narx!")
        return redirect("group_detail", pk=group_pk)
    return redirect("group_detail", pk=group_pk)


# ---- Receipt Template Builder ----

@login_required(login_url="login")
def receipt_builder(request, pk=None):
    template = None
    if pk:
        template = get_object_or_404(ReceiptTemplate, pk=pk)
    templates = ReceiptTemplate.objects.all().order_by("-is_default", "-updated_at")
    default_template = ReceiptTemplate.objects.filter(is_default=True).first()
    return render(request, "receipt/builder.html", {
        "template": template,
        "templates": templates,
        "default_template": default_template,
        "templates_json": json.dumps([{
            "id": t.pk, "name": t.name, "is_default": t.is_default,
        } for t in templates], ensure_ascii=False),
    })


@login_required(login_url="login")
def receipt_print_preview(request, pk, transaction_id):
    transaction = get_object_or_404(Transaction, pk=transaction_id)
    receipt_settings = ReceiptSettings.get_instance()
    settings = {
        "academy_name": receipt_settings.academy_name,
        "tagline": receipt_settings.tagline,
        "accent_color": receipt_settings.accent_color,
        "receipt_title": receipt_settings.receipt_title,
        "receipt_prefix": receipt_settings.receipt_prefix,
        "receipt_format": receipt_settings.receipt_format,
        "footer_text": receipt_settings.footer_text,
        "thank_you_text": receipt_settings.thank_you_text,
        "payment_text": receipt_settings.payment_text,
        "extra_notes": receipt_settings.extra_notes,
        "message_text": receipt_settings.message_text,
        "qr_link": receipt_settings.qr_link,
        "phone": receipt_settings.phone,
        "telegram": receipt_settings.telegram,
        "instagram": receipt_settings.instagram,
        "website": receipt_settings.website,
        "address": receipt_settings.address,
        "paper_width": receipt_settings.paper_width,
        "paper_height": receipt_settings.paper_height,
        "paper_padding": receipt_settings.paper_padding,
        "font_name": receipt_settings.font_name,
        "font_tagline": receipt_settings.font_tagline,
        "font_title": receipt_settings.font_title,
        "font_row": receipt_settings.font_row,
        "font_amount_label": receipt_settings.font_amount_label,
        "font_amount": receipt_settings.font_amount,
        "font_balance": receipt_settings.font_balance,
        "font_thanks": receipt_settings.font_thanks,
        "font_footer": receipt_settings.font_footer,
        "font_contact": receipt_settings.font_contact,
        "font_notes": receipt_settings.font_notes,
        "logo_url": receipt_settings.logo.url if receipt_settings.logo else "",
    }
    return render(request, "receipt/print.html", {
        "transaction": transaction,
        "settings": settings,
    })


@login_required(login_url="login")
def receipt_print(request, transaction_id):
    transaction = get_object_or_404(Transaction, pk=transaction_id)
    receipt_settings = ReceiptSettings.get_instance()
    settings = {
        "academy_name": receipt_settings.academy_name,
        "tagline": receipt_settings.tagline,
        "accent_color": receipt_settings.accent_color,
        "receipt_title": receipt_settings.receipt_title,
        "receipt_prefix": receipt_settings.receipt_prefix,
        "receipt_format": receipt_settings.receipt_format,
        "footer_text": receipt_settings.footer_text,
        "thank_you_text": receipt_settings.thank_you_text,
        "payment_text": receipt_settings.payment_text,
        "extra_notes": receipt_settings.extra_notes,
        "message_text": receipt_settings.message_text,
        "qr_link": receipt_settings.qr_link,
        "phone": receipt_settings.phone,
        "telegram": receipt_settings.telegram,
        "instagram": receipt_settings.instagram,
        "website": receipt_settings.website,
        "address": receipt_settings.address,
        "paper_width": receipt_settings.paper_width,
        "paper_height": receipt_settings.paper_height,
        "paper_padding": receipt_settings.paper_padding,
        "font_name": receipt_settings.font_name,
        "font_tagline": receipt_settings.font_tagline,
        "font_title": receipt_settings.font_title,
        "font_row": receipt_settings.font_row,
        "font_amount_label": receipt_settings.font_amount_label,
        "font_amount": receipt_settings.font_amount,
        "font_balance": receipt_settings.font_balance,
        "font_thanks": receipt_settings.font_thanks,
        "font_footer": receipt_settings.font_footer,
        "font_contact": receipt_settings.font_contact,
        "font_notes": receipt_settings.font_notes,
        "logo_url": receipt_settings.logo.url if receipt_settings.logo else "",
    }
    return render(request, "receipt/print.html", {
        "transaction": transaction,
        "settings": settings,
    })


@login_required(login_url="login")
def api_receipt_html(request, transaction_id):
    transaction = get_object_or_404(Transaction, pk=transaction_id)
    receipt_settings = ReceiptSettings.get_instance()
    settings = {
        "academy_name": receipt_settings.academy_name,
        "tagline": receipt_settings.tagline,
        "accent_color": receipt_settings.accent_color,
        "receipt_title": receipt_settings.receipt_title,
        "receipt_prefix": receipt_settings.receipt_prefix,
        "receipt_format": receipt_settings.receipt_format,
        "footer_text": receipt_settings.footer_text,
        "thank_you_text": receipt_settings.thank_you_text,
        "payment_text": receipt_settings.payment_text,
        "extra_notes": receipt_settings.extra_notes,
        "message_text": receipt_settings.message_text,
        "qr_link": receipt_settings.qr_link,
        "phone": receipt_settings.phone,
        "telegram": receipt_settings.telegram,
        "instagram": receipt_settings.instagram,
        "website": receipt_settings.website,
        "address": receipt_settings.address,
        "paper_width": receipt_settings.paper_width,
        "paper_height": receipt_settings.paper_height,
        "paper_padding": receipt_settings.paper_padding,
        "font_name": receipt_settings.font_name,
        "font_tagline": receipt_settings.font_tagline,
        "font_title": receipt_settings.font_title,
        "font_row": receipt_settings.font_row,
        "font_amount_label": receipt_settings.font_amount_label,
        "font_amount": receipt_settings.font_amount,
        "font_balance": receipt_settings.font_balance,
        "font_thanks": receipt_settings.font_thanks,
        "font_footer": receipt_settings.font_footer,
        "font_contact": receipt_settings.font_contact,
        "font_notes": receipt_settings.font_notes,
        "logo_url": receipt_settings.logo.url if receipt_settings.logo else "",
    }
    html = render_to_string("receipt/print.html", {
        "transaction": transaction,
        "settings": settings,
        "inline": False,
    })
    SavedReceipt.objects.update_or_create(
        transaction=transaction,
        defaults={"receipt_html": html, "settings_snapshot": settings}
    )
    return JsonResponse({"html": html})


@login_required(login_url="login")
def receipt_list(request):
    from django.utils.dateparse import parse_date
    q = request.GET.get("q", "").strip()
    period = request.GET.get("period", "today")
    date_from = request.GET.get("date_from", "")
    date_to = request.GET.get("date_to", "")

    receipts = SavedReceipt.objects.select_related("transaction", "transaction__student", "created_by").all()

    if q:
        receipts = receipts.filter(student_name__icontains=q)

    today = date.today()
    if period == "today":
        receipts = receipts.filter(created_at__date=today)
    elif period == "week":
        week_start = today - timedelta(days=today.weekday())
        receipts = receipts.filter(created_at__date__gte=week_start, created_at__date__lte=today)
    elif period == "month":
        receipts = receipts.filter(created_at__year=today.year, created_at__month=today.month)
    elif period == "year":
        receipts = receipts.filter(created_at__year=today.year)
    elif period == "all":
        pass
    elif date_from:
        try:
            df = parse_date(date_from)
            if df:
                receipts = receipts.filter(created_at__date__gte=df)
        except Exception:
            pass
    elif date_to:
        try:
            dt_d = parse_date(date_to)
            if dt_d:
                receipts = receipts.filter(created_at__date__lte=dt_d)
        except Exception:
            pass

    total_count = receipts.count()
    total_amount = sum(float(r.amount) for r in receipts)

    paginator = Paginator(receipts, 50)
    page = request.GET.get("page", 1)
    page_obj = paginator.get_page(page)

    return render(request, "receipt/list.html", {
        "receipts": page_obj,
        "page_obj": page_obj,
        "total_count": total_count,
        "total_amount": total_amount,
        "search_query": q,
        "current_period": period,
        "date_from": date_from,
        "date_to": date_to,
    })


from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods, require_POST
import json as json_lib


@login_required(login_url="login")
@require_http_methods(["GET"])
def api_receipt_templates(request):
    templates = ReceiptTemplate.objects.all().order_by("-is_default", "-updated_at")
    data = []
    for t in templates:
        data.append({
            "id": t.pk, "name": t.name, "is_default": t.is_default,
            "width": t.width, "height_mode": t.height_mode,
            "background_color": t.background_color, "black_white": t.black_white,
            "components": t.components, "updated_at": t.updated_at.isoformat(),
            "thermal_mode": t.thermal_mode, "print_dpi": t.print_dpi,
            "page_padding": t.page_padding, "paper_margin": t.paper_margin,
        })
    return JsonResponse(data, safe=False)


@login_required(login_url="login")
@require_http_methods(["GET", "PUT", "DELETE"])
def api_receipt_template_detail(request, pk):
    template = get_object_or_404(ReceiptTemplate, pk=pk)
    if request.method == "GET":
        return JsonResponse({
            "id": template.pk, "name": template.name, "is_default": template.is_default,
            "width": template.width, "height_mode": template.height_mode,
            "height": template.height, "paper_margin": template.paper_margin,
            "background_color": template.background_color, "print_dpi": template.print_dpi,
            "thermal_mode": template.thermal_mode, "black_white": template.black_white,
            "page_padding": template.page_padding, "components": template.components,
        })
    elif request.method == "PUT":
        try:
            data = json_lib.loads(request.body)
            template.name = data.get("name", template.name)
            template.width = data.get("width", template.width)
            template.height_mode = data.get("height_mode", template.height_mode)
            template.height = data.get("height", template.height)
            template.paper_margin = data.get("paper_margin", template.paper_margin)
            template.background_color = data.get("background_color", template.background_color)
            template.print_dpi = data.get("print_dpi", template.print_dpi)
            template.thermal_mode = data.get("thermal_mode", template.thermal_mode)
            template.black_white = data.get("black_white", template.black_white)
            template.page_padding = data.get("page_padding", template.page_padding)
            template.components = data.get("components", template.components)
            if data.get("is_default"):
                template.is_default = True
            template.save()
            return JsonResponse({"success": True, "id": template.pk})
        except Exception as e:
            return JsonResponse({"success": False, "error": str(e)}, status=400)
    elif request.method == "DELETE":
        template.delete()
        return JsonResponse({"success": True})


@login_required(login_url="login")
@require_http_methods(["POST"])
def api_receipt_template_create(request):
    try:
        data = json_lib.loads(request.body)
        template = ReceiptTemplate.objects.create(
            name=data.get("name", "Yangi shablon"),
            width=data.get("width", "80mm"),
            height_mode=data.get("height_mode", "auto"),
            height=data.get("height", 300),
            paper_margin=data.get("paper_margin", 0),
            background_color=data.get("background_color", "#ffffff"),
            print_dpi=data.get("print_dpi", 203),
            thermal_mode=data.get("thermal_mode", False),
            black_white=data.get("black_white", True),
            page_padding=data.get("page_padding", 10),
            components=data.get("components", []),
        )
        if data.get("is_default"):
            template.is_default = True
            template.save()
        return JsonResponse({"success": True, "id": template.pk})
    except Exception as e:
        return JsonResponse({"success": False, "error": str(e)}, status=400)


@login_required(login_url="login")
@require_http_methods(["POST"])
def api_receipt_template_duplicate(request, pk):
    original = get_object_or_404(ReceiptTemplate, pk=pk)
    try:
        data = json_lib.loads(request.body)
        new_name = data.get("name", original.name + " (nusxa)")
    except:
        new_name = original.name + " (nusxa)"
    template = ReceiptTemplate.objects.create(
        name=new_name,
        width=original.width, height_mode=original.height_mode,
        height=original.height, paper_margin=original.paper_margin,
        background_color=original.background_color, print_dpi=original.print_dpi,
        thermal_mode=original.thermal_mode, black_white=original.black_white,
        page_padding=original.page_padding, components=original.components,
    )
    return JsonResponse({"success": True, "id": template.pk})


@login_required(login_url="login")
@require_http_methods(["POST"])
def api_receipt_template_set_default(request, pk):
    template = get_object_or_404(ReceiptTemplate, pk=pk)
    template.is_default = True
    template.save()
    return JsonResponse({"success": True, "default_id": template.pk})


# ---- Student Web Interface ----


@login_required(login_url="login")
@require_POST
def api_update_deferred_reason(request):
    import json
    data = json.loads(request.body)
    student_id = data.get("student_id")
    month = data.get("month")
    reason = data.get("reason", "").strip()
    if not student_id or not month:
        return JsonResponse({"success": False, "error": "student_id va month talab qilinadi"})
    student = get_object_or_404(Student, pk=student_id)
    tx = Transaction.objects.filter(
        student=student,
        transaction_type=Transaction.Type.PAYMENT,
        description__contains=f"df:{month}"
    ).order_by('-created_at').first()
    if not tx:
        return JsonResponse({"success": False, "error": "To'lov topilmadi"})
    desc = tx.description or ""
    parts = desc.split('|')
    new_parts = []
    global_reason = None
    for p in parts:
        if p.startswith('reason:'):
            global_reason = p
        elif p == f"df:{month}" or p.startswith(f"df:{month}:"):
            if reason:
                new_parts.append(f"df:{month}:{reason}")
            else:
                new_parts.append(f"df:{month}")
        else:
            new_parts.append(p)
    # Keep global reason for backward compatibility
    if global_reason:
        new_parts.append(global_reason)
    tx.description = '|'.join(new_parts)
    tx.save(update_fields=['description'])
    return JsonResponse({"success": True})


