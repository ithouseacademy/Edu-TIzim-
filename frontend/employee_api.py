import json
from datetime import date, datetime, timedelta
import calendar
from functools import wraps
from datetime import datetime, time, date, timedelta
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.contrib.auth import authenticate, login, logout
from django.db.models import Count, Q
from django.utils import timezone as tz
from decimal import Decimal
from .models import Employee, Group, LessonTime, Attendance, AbsenceReason, Student, StudentBalance, Transaction, StudentLessonPrice, GlobalConfig
from .views import generate_lesson_dates
from .sms_service import send_absence_sms

# ===== BALANCE HELPERS (same logic as views.py) =====

def get_student_lesson_price(student, group):
    try:
        slp = StudentLessonPrice.objects.get(student=student, group=group)
        return slp.lesson_price
    except StudentLessonPrice.DoesNotExist:
        return group.lesson_price or Decimal('0.00')


def should_deduct_for_status(status, group=None):
    """Qoida: faqat 'Keldi' (present) belgilangan dars uchun pul yechiladi.
    Kemagan (absent) va sababli kelmagan (excused) darslardan pul YECHILMAYDI."""
    return status == "present"


def add_balance_transaction(student, amount, transaction_type, group=None, attendance=None, description="", created_by=""):
    balance, _ = StudentBalance.objects.get_or_create(student=student, defaults={"balance": Decimal('0.00')})
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


def sync_attendance_balance(student, group, attendance, new_status, created_by=""):
    price = get_student_lesson_price(student, group)
    existing_charges = Transaction.objects.filter(
        attendance=attendance,
        transaction_type=Transaction.Type.LESSON,
    )
    total_charged = sum(t.amount for t in existing_charges)
    existing_refunds = Transaction.objects.filter(
        attendance=attendance,
        transaction_type=Transaction.Type.CORRECTION,
    )
    total_refunded = sum(t.amount for t in existing_refunds)
    net_deducted = total_charged + total_refunded
    should_deduct_now = should_deduct_for_status(new_status, group)
    if should_deduct_now and net_deducted == 0:
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


def employee_api_required(view_func):
    @wraps(view_func)
    def wrapper(request, *args, **kwargs):
        if not request.user.is_authenticated:
            return JsonResponse({"error": "Avtorizatsiya talab qilinadi"}, status=401)
        return view_func(request, *args, **kwargs)
    return wrapper


def _employee_data(emp):
    return {
        "id": emp.id,
        "first_name": emp.first_name,
        "last_name": emp.last_name,
        "phone": emp.phone,
        "email": emp.email or "",
        "gender": emp.gender or "",
        "gender_display": emp.get_gender_display() if emp.gender else "",
        "birth_date": emp.birth_date.isoformat() if emp.birth_date else None,
        "photo": emp.photo.url if emp.photo else None,
        "position": {"id": emp.position_id, "name": emp.position.name} if emp.position else None,
        "role": {"id": emp.role_id, "name": emp.role.name} if emp.role else None,
        "branches": [{"id": b.id, "name": b.name} for b in emp.branches.all()],
        "salary_enabled": emp.salary_enabled,
        "salary": float(emp.salary) if emp.salary else None,
        "notes": emp.notes or "",
        "has_login": emp.user is not None,
        "group_count": emp.teacher_groups.count(),
        "created_at": emp.created_at.isoformat(),
    }


@csrf_exempt
def employee_login(request):
    if request.method != "POST":
        return JsonResponse({"error": "POST talab qilinadi"}, status=405)
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({"error": "Noto'g'ri format"}, status=400)
    phone = data.get("phone", "").strip()
    password = data.get("password", "")
    user = authenticate(request, username=phone, password=password)
    if not user:
        return JsonResponse({"error": "Telefon yoki parol noto'g'ri"}, status=401)
    try:
        emp = user.employee_profile
    except:
        return JsonResponse({"error": "Siz xodim emassiz"}, status=403)
    login(request, user)
    return JsonResponse({
        "success": True,
        "employee": _employee_data(emp),
        "is_admin": user.is_staff or (emp.role and emp.role.name == "Administrator"),
        "is_teacher": emp.role and emp.role.name == "O'qituvchi",
    })


@csrf_exempt
def employee_logout(request):
    logout(request)
    return JsonResponse({"success": True})


@csrf_exempt
@employee_api_required
def employee_list(request):
    try:
        emp = request.user.employee_profile
        is_admin = request.user.is_staff or (emp.role and emp.role.name == "Administrator")
    except:
        return JsonResponse({"error": "Ruxsat yo'q"}, status=403)
    if not is_admin:
        return JsonResponse({"error": "Faqat adminlar"}, status=403)
    employees = Employee.objects.select_related("position", "role").prefetch_related("branches").annotate(
        group_count=Count("teacher_groups")
    ).all().order_by("-created_at")
    return JsonResponse({"employees": [_employee_data(e) for e in employees]})


@csrf_exempt
@employee_api_required
def employee_detail(request, pk):
    try:
        emp = request.user.employee_profile
        is_admin = request.user.is_staff or (emp.role and emp.role.name == "Administrator")
    except:
        return JsonResponse({"error": "Ruxsat yo'q"}, status=403)
    if not is_admin:
        return JsonResponse({"error": "Faqat adminlar"}, status=403)
    employee = Employee.objects.select_related("position", "role").prefetch_related("branches").filter(pk=pk).first()
    if not employee:
        return JsonResponse({"error": "Xodim topilmadi"}, status=404)
    groups = employee.teacher_groups.select_related("course", "room").annotate(
        student_count=Count("students")
    ).all().order_by("-created_at")
    data = _employee_data(employee)
    data["groups"] = [
        {
            "id": g.id,
            "name": g.name,
            "course": g.course.name if g.course else None,
            "room": g.room.name if g.room else None,
            "status": g.status,
            "status_display": g.get_status_display(),
            "student_count": g.student_count,
            "start_date": g.start_date.isoformat() if g.start_date else None,
        }
        for g in groups
    ]
    return JsonResponse({"employee": data})


@csrf_exempt
@employee_api_required
def employee_create(request):
    try:
        emp = request.user.employee_profile
        is_admin = request.user.is_staff or (emp.role and emp.role.name == "Administrator")
    except:
        return JsonResponse({"error": "Ruxsat yo'q"}, status=403)
    if not is_admin:
        return JsonResponse({"error": "Faqat adminlar"}, status=403)
    if request.method != "POST":
        return JsonResponse({"error": "POST talab qilinadi"}, status=405)
    from django.contrib.auth.models import User
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({"error": "Noto'g'ri format"}, status=400)
    phone = data.get("phone", "").strip()
    if Employee.objects.filter(phone=phone).exists():
        return JsonResponse({"error": "Bu telefon raqam bilan xodim bor"}, status=400)
    employee = Employee(first_name=data["first_name"], last_name=data["last_name"], phone=phone)
    employee.email = data.get("email", "")
    employee.gender = data.get("gender", "")
    from datetime import date
    bd = data.get("birth_date")
    if bd:
        try:
            employee.birth_date = date.fromisoformat(bd)
        except:
            pass
    from .models import Role, Position
    role_id = data.get("role_id")
    if role_id:
        employee.role = Role.objects.filter(pk=role_id).first()
    position_id = data.get("position_id")
    if position_id:
        employee.position = Position.objects.filter(pk=position_id).first()
    employee.salary_enabled = data.get("salary_enabled", False)
    employee.salary = data.get("salary")
    employee.notes = data.get("notes", "")
    password = data.get("password", "")
    if password:
        user = User.objects.create_user(username=phone, password=password, first_name=data["first_name"], last_name=data["last_name"])
        employee.user = user
    employee.save()
    branch_ids = data.get("branch_ids", [])
    if branch_ids:
        from .models import Branch
        employee.branches.set(Branch.objects.filter(pk__in=branch_ids))
    return JsonResponse({"success": True, "employee": _employee_data(employee)})


@csrf_exempt
@employee_api_required
def employee_update(request, pk):
    try:
        emp = request.user.employee_profile
        is_admin = request.user.is_staff or (emp.role and emp.role.name == "Administrator")
    except:
        return JsonResponse({"error": "Ruxsat yo'q"}, status=403)
    if not is_admin:
        return JsonResponse({"error": "Faqat adminlar"}, status=403)
    if request.method != "PUT":
        return JsonResponse({"error": "PUT talab qilinadi"}, status=405)
    employee = Employee.objects.filter(pk=pk).first()
    if not employee:
        return JsonResponse({"error": "Xodim topilmadi"}, status=404)
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({"error": "Noto'g'ri format"}, status=400)
    employee.first_name = data.get("first_name", employee.first_name)
    employee.last_name = data.get("last_name", employee.last_name)
    employee.email = data.get("email", employee.email)
    employee.gender = data.get("gender", employee.gender)
    bd = data.get("birth_date")
    if bd:
        try:
            employee.birth_date = date.fromisoformat(bd)
        except:
            pass
    from .models import Role, Position
    role_id = data.get("role_id")
    if role_id is not None:
        employee.role = Role.objects.filter(pk=role_id).first()
    position_id = data.get("position_id")
    if position_id is not None:
        employee.position = Position.objects.filter(pk=position_id).first()
    employee.salary_enabled = data.get("salary_enabled", employee.salary_enabled)
    employee.salary = data.get("salary", employee.salary)
    employee.notes = data.get("notes", employee.notes)
    password = data.get("password", "")
    if password:
        if employee.user:
            employee.user.set_password(password)
            employee.user.save()
        else:
            from django.contrib.auth.models import User
            user = User.objects.create_user(username=employee.phone, password=password, first_name=employee.first_name, last_name=employee.last_name)
            employee.user = user
    employee.save()
    branch_ids = data.get("branch_ids")
    if branch_ids is not None:
        from .models import Branch
        employee.branches.set(Branch.objects.filter(pk__in=branch_ids))
    return JsonResponse({"success": True, "employee": _employee_data(employee)})


@csrf_exempt
@employee_api_required
def employee_delete(request, pk):
    try:
        emp = request.user.employee_profile
        is_admin = request.user.is_staff or (emp.role and emp.role.name == "Administrator")
    except:
        return JsonResponse({"error": "Ruxsat yo'q"}, status=403)
    if not is_admin:
        return JsonResponse({"error": "Faqat adminlar"}, status=403)
    if request.method != "DELETE":
        return JsonResponse({"error": "DELETE talab qilinadi"}, status=405)
    employee = Employee.objects.filter(pk=pk).first()
    if not employee:
        return JsonResponse({"error": "Xodim topilmadi"}, status=404)
    if employee.user:
        employee.user.is_active = False
        employee.user.save(update_fields=["is_active"])
    employee.delete()
    return JsonResponse({"success": True, "message": "Xodim o'chirildi (faolligi bekor qilindi)"})


@csrf_exempt
@employee_api_required
def my_groups(request):
    try:
        emp = request.user.employee_profile
    except:
        return JsonResponse({"error": "Xodim topilmadi"}, status=404)
    if not emp.role or emp.role.name not in ("O'qituvchi", "Administrator", "Support Teacher"):
        return JsonResponse({"error": "Faqat o'qituvchilar"}, status=403)
    if emp.role.name == "O'qituvchi":
        groups = Group.objects.filter(teacher=emp, status__in=["aktiv", "kutilyotgan"])
    else:
        groups = Group.objects.filter(status__in=["aktiv", "kutilyotgan"])
    groups = groups.select_related("course", "room").prefetch_related("lesson_times").annotate(
        student_count=Count("students")
    ).distinct().order_by("name")
    today_date = tz.localdate()
    weekday_map_rev = {0:"dushanba",1:"seshanba",2:"chorshanba",3:"payshanba",4:"juma",5:"shanba",6:"yakshanba"}
    today_uz = weekday_map_rev[today_date.weekday()]
    current_time = tz.localtime(tz.now()).time()

    def _compute_status(g):
        if g.is_date_overdue():
            return "expired"
        if g.status not in ("aktiv", "kutilyotgan"):
            return "finished"
        lesson_times_list = list(g.lesson_times.all())
        if not lesson_times_list:
            return "upcoming"
        for lt in lesson_times_list:
            days_list = [d.strip().lower() for d in lt.days.split(",") if d.strip()]
            if today_uz in days_list:
                if lt.start_time <= current_time <= lt.end_time:
                    return "active"
                if lt.end_time < current_time:
                    return "finished"
                if lt.start_time > current_time:
                    return "upcoming"
        return "upcoming"

    result = []
    for g in groups:
        computed_status = _compute_status(g)
        lesson_times = [
            {
                "days": lt.days,
                "start_time": lt.start_time.strftime("%H:%M"),
                "end_time": lt.end_time.strftime("%H:%M"),
            }
            for lt in g.lesson_times.all()
        ]
        result.append({
            "id": g.id,
            "name": g.name,
            "course": g.course.name if g.course else None,
            "room": g.room.name if g.room else None,
            "status": computed_status,
            "status_display": g.get_status_display(),
            "student_count": g.student_count,
            "teacher": str(g.teacher) if g.teacher else None,
            "lesson_times": lesson_times,
            "start_date": g.start_date.isoformat() if g.start_date else None,
            "end_date": g.end_date.isoformat() if g.end_date else None,
        })
    return JsonResponse({"groups": result})


@csrf_exempt
@employee_api_required
def group_attendance(request, group_id):
    try:
        emp = request.user.employee_profile
    except:
        return JsonResponse({"error": "Xodim topilmadi"}, status=404)
    is_admin = request.user.is_staff or (emp.role and emp.role.name == "Administrator")
    if emp.role and emp.role.name == "O'qituvchi":
        group = Group.objects.filter(pk=group_id, teacher=emp).first()
    else:
        group = Group.objects.filter(pk=group_id).first()
    if not group:
        return JsonResponse({"error": "Guruh topilmadi"}, status=404)
    today = tz.localdate()
    sel_year = int(request.GET.get("year", today.year))
    sel_month = int(request.GET.get("month", today.month))
    weekday_map_rev = {0: "dushanba", 1: "seshanba", 2: "chorshanba", 3: "payshanba", 4: "juma", 5: "shanba", 6: "yakshanba"}
    _, last_day = calendar.monthrange(sel_year, sel_month)
    month_start = date(sel_year, sel_month, 1)
    month_end = date(sel_year, sel_month, last_day)
    lesson_dates = [d.isoformat() for d in generate_lesson_dates(group, month_start, month_end)]
    students = group.students.all().order_by("first_name")
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
    students_data = []
    for s in students:
        students_data.append({
            "id": s.id,
            "first_name": s.first_name,
            "last_name": s.last_name,
            "phone": s.phone,
        })
    status_labels = {"absent": "Kelmadi", "excused": "Sababli", "present": "Keldi"}
    # All-time attendance history (not limited to selected month)
    all_attendances = Attendance.objects.filter(group=group).select_related("teacher").order_by("-created_at")
    student_att_history = {}
    for a in all_attendances:
        sid = a.student_id
        if sid not in student_att_history:
            student_att_history[sid] = []
        teacher_name = ""
        if a.teacher:
            teacher_name = (a.teacher.first_name or "") + " " + (a.teacher.last_name or "")
            teacher_name = teacher_name.strip()
        elif a.created_by:
            teacher_name = a.created_by
        student_att_history[sid].append({
            "date": a.date.isoformat(),
            "status": status_labels.get(a.status, a.status),
            "notes": a.notes or "",
            "teacher": teacher_name,
        })
    # can_edit: admin always can; teacher only during lesson time today
    can_edit = False
    if is_admin:
        can_edit = True
    else:
        now_time = tz.localtime(tz.now()).time()
        today_uz = weekday_map_rev[today.weekday()]
        for lt in group.lesson_times.all():
            for d_name in lt.days.split(","):
                if d_name.strip() == today_uz and lt.start_time and lt.end_time:
                    if lt.start_time <= now_time <= lt.end_time:
                        can_edit = True
                        break
            if can_edit:
                break
    # Lock attendance if group end date has passed (today or selected month)
    if group.end_date and group.end_date < tz.localdate():
        can_edit = False
    if lesson_dates and group.end_date and group.end_date < month_start:
        can_edit = False
    remaining_days = None
    if group.end_date:
        remaining = (group.end_date - tz.localdate()).days
        remaining_days = remaining if remaining >= 0 else 0
    return JsonResponse({
        "group": {
            "id": group.id,
            "name": group.name,
            "start_date": group.start_date.isoformat() if group.start_date else None,
            "end_date": group.end_date.isoformat() if group.end_date else None,
            "remaining_days": remaining_days,
        },
        "students": students_data,
        "lesson_dates": lesson_dates,
        "att_matrix": {str(k): v for k, v in att_matrix.items()},
        "att_notes": {str(k): v for k, v in att_notes.items()},
        "student_att_history": {str(k): v for k, v in student_att_history.items()},
        "sel_year": sel_year,
        "sel_month": sel_month,
        "is_admin": is_admin,
        "can_edit": can_edit,
    })


def _teacher_group_data(g, emp, day_filter="", date_filter=""):
    now = tz.localtime(tz.now())
    current_time = now.time()
    current_weekday = now.weekday()
    weekday_map = {0: "dushanba", 1: "seshanba", 2: "chorshanba", 3: "payshanba", 4: "juma", 5: "shanba", 6: "yakshanba"}
    weekday_map_uz = {0: "Dushanba", 1: "Seshanba", 2: "Chorshanba", 3: "Payshanba", 4: "Juma", 5: "Shanba", 6: "Yakshanba"}
    months_uz = {1: "Yanvar", 2: "Fevral", 3: "Mart", 4: "Aprel", 5: "May", 6: "Iyun", 7: "Iyul", 8: "Avgust", 9: "Sentabr", 10: "Oktabr", 11: "Noyabr", 12: "Dekabr"}
    today_uz = weekday_map[current_weekday]
    today_date = tz.localdate()

    if g.is_date_overdue():
        return {
            "id": g.id, "name": g.name, "course": g.course.name if g.course else None,
            "student_count": g.student_count,
            "status": "expired", "status_display": "Muddati tugagan",
            "lesson_display": "", "nearest_time": None, "room": g.room.name if g.room else None,
        }

    lesson_times_list = list(g.lesson_times.all())
    status = "kutilmoqda"
    lesson_display = ""
    nearest_time = None
    students_count = g.student_count if hasattr(g, 'student_count') else g.students.count()

    for lt in lesson_times_list:
        days_list = [d.strip().lower() for d in lt.days.split(",") if d.strip()]
        day_matches_for_today = today_uz in days_list

        if nearest_time is None or (lt.start_time and (nearest_time is None or lt.start_time < nearest_time)):
            nearest_time = lt.start_time

        if day_matches_for_today:
            if lt.start_time <= current_time <= lt.end_time:
                status = "active"
            elif lt.end_time < current_time and status != "active":
                status = "finished"
            elif lt.start_time > current_time and status not in ("active", "finished"):
                status = "upcoming"

        f_day = date_filter if date_filter else today_uz
        if day_filter or not date_filter:
            if f_day in days_list or not day_filter:
                lesson_display = f"{lt.get_days_display()} {lt.start_time.strftime('%H:%M')}-{lt.end_time.strftime('%H:%M')}"

    return {
        "id": g.id, "name": g.name, "course": g.course.name if g.course else None,
        "room": g.room.name if g.room else None,
        "student_count": students_count,
        "status": status,
        "status_display": {"active": "Dars bo'lyapti", "upcoming": "Kutilmoqda", "finished": "O'tib ketdi", "expired": "Muddati tugagan"}.get(status, status),
        "lesson_display": lesson_display,
        "nearest_time": nearest_time.strftime("%H:%M") if nearest_time else None,
        "start_date": g.start_date.isoformat() if g.start_date else None,
        "end_date": g.end_date.isoformat() if g.end_date else None,
    }


@csrf_exempt
@employee_api_required
def teacher_dashboard_api(request):
    try:
        emp = request.user.employee_profile
    except:
        return JsonResponse({"error": "Xodim topilmadi"}, status=404)
    if not emp.role or emp.role.name not in ("O'qituvchi", "Administrator", "Support Teacher"):
        return JsonResponse({"error": "Faqat o'qituvchilar"}, status=403)

    now = tz.localtime(tz.now())
    today_date = tz.localdate()
    weekday_map_uz = {0: "Dushanba", 1: "Seshanba", 2: "Chorshanba", 3: "Payshanba", 4: "Juma", 5: "Shanba", 6: "Yakshanba"}
    months_uz = {1: "Yanvar", 2: "Fevral", 3: "Mart", 4: "Aprel", 5: "May", 6: "Iyun", 7: "Iyul", 8: "Avgust", 9: "Sentabr", 10: "Oktabr", 11: "Noyabr", 12: "Dekabr"}
    today_display = f"{weekday_map_uz[today_date.weekday()]}, {today_date.day} {months_uz[today_date.month]} {today_date.year}"

    day_filter = request.GET.get("day", "")
    date_filter = request.GET.get("date", "")

    if emp.role.name == "O'qituvchi":
        all_groups = Group.objects.filter(teacher=emp, status__in=["aktiv", "kutilyotgan"]).select_related("course", "room").prefetch_related("lesson_times").annotate(student_count=Count("students"))
    else:
        all_groups = Group.objects.filter(status__in=["aktiv", "kutilyotgan"]).select_related("course", "room").prefetch_related("lesson_times").annotate(student_count=Count("students"))

    if date_filter:
        try:
            parsed = datetime.strptime(date_filter, "%Y-%m-%d")
            wd = {0: "dushanba", 1: "seshanba", 2: "chorshanba", 3: "payshanba", 4: "juma", 5: "shanba", 6: "yakshanba"}[parsed.weekday()]
            all_groups = all_groups.filter(lesson_times__days__contains=wd)
            day_filter = wd
        except:
            pass
    elif day_filter:
        all_groups = all_groups.filter(lesson_times__days__contains=day_filter)

    groups = all_groups.distinct().order_by("name")
    group_list = [_teacher_group_data(g, emp, day_filter, date_filter) for g in groups]

    total_groups = len(group_list)
    today_count = sum(1 for g in group_list if g["status"] in ("active", "upcoming", "finished"))
    active_count = sum(1 for g in group_list if g["status"] == "active")
    total_students = sum(g["student_count"] or 0 for g in group_list)

    return JsonResponse({
        "groups": group_list,
        "today_display": today_display,
        "total_groups": total_groups,
        "today_count": today_count,
        "active_count": active_count,
        "total_students": total_students,
    })


@csrf_exempt
@employee_api_required
def teacher_group_detail_api(request, pk):
    try:
        emp = request.user.employee_profile
    except:
        return JsonResponse({"error": "Xodim topilmadi"}, status=404)
    if emp.role and emp.role.name == "O'qituvchi":
        group = Group.objects.filter(pk=pk, teacher=emp).select_related("course", "room").prefetch_related("lesson_times", "students").first()
    else:
        group = Group.objects.filter(pk=pk).select_related("course", "room").prefetch_related("lesson_times", "students").first()
    if not group:
        return JsonResponse({"error": "Guruh topilmadi"}, status=404)

    today = tz.localdate()
    students = group.students.all().order_by("first_name")
    today_attendances = Attendance.objects.filter(group=group, date=today)
    att_map = {a.student_id: a.status for a in today_attendances}
    att_notes_map = {a.student_id: a.notes for a in today_attendances if a.notes}

    lesson_times_data = [{
        "days": lt.days,
        "days_display": lt.get_days_display(),
        "start_time": lt.start_time.strftime("%H:%M"),
        "end_time": lt.end_time.strftime("%H:%M"),
    } for lt in group.lesson_times.all()]

    students_data = [{
        "id": s.id,
        "first_name": s.first_name,
        "last_name": s.last_name,
        "phone": s.phone,
        "is_frozen": s.is_frozen,
        "attendance_status": att_map.get(s.id, "present"),
        "attendance_notes": att_notes_map.get(s.id, ""),
    } for s in students]

    from .models import AbsenceReason
    reasons = AbsenceReason.objects.filter(is_active=True).order_by("order", "name")

    return JsonResponse({
        "group": {
            "id": group.id,
            "name": group.name,
            "course": group.course.name if group.course else None,
            "room": group.room.name if group.room else None,
            "education_type": group.education_type or "",
            "education_type_display": group.get_education_type_display() if group.education_type else "",
            "status": group.status,
            "status_display": group.get_status_display(),
            "start_date": group.start_date.isoformat() if group.start_date else None,
            "end_date": group.end_date.isoformat() if group.end_date else None,
            "lesson_times": lesson_times_data,
            "telegram_link": group.telegram_link or "",
            "student_count": students.count(),
        },
        "students": students_data,
        "absence_reasons": [{"id": r.id, "name": r.name} for r in reasons],
    })


@csrf_exempt
@employee_api_required
def take_attendance(request):
    if request.method != "POST":
        return JsonResponse({"error": "POST talab qilinadi"}, status=405)
    try:
        emp = request.user.employee_profile
    except:
        return JsonResponse({"error": "Xodim topilmadi"}, status=404)
    is_admin = request.user.is_staff or (emp.role and emp.role.name == "Administrator")
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({"error": "Noto'g'ri format"}, status=400)
    group_id = data.get("group_id")
    attendance_data = data.get("attendance", [])
    if not group_id or not attendance_data:
        return JsonResponse({"error": "Ma'lumotlar yetarli emas"}, status=400)
    try:
        group = Group.objects.get(pk=group_id)
    except Group.DoesNotExist:
        return JsonResponse({"error": "Guruh topilmadi"}, status=404)
    # Lock attendance if group end date has passed
    if group.end_date and group.end_date < tz.localdate():
        return JsonResponse({"error": "Guruh muddati tugagan, davomatni o'zgartirish mumkin emas"}, status=403)
    # Admin: unrestricted; Teacher: own groups only, today only, within lesson time
    if not is_admin:
        if group.teacher_id != emp.id:
            return JsonResponse({"error": "Siz bu guruhning o'qituvchisi emassiz"}, status=403)
        today = tz.localdate()
        now_time = tz.localtime(tz.now()).time()
        weekday_map_rev = {0: "dushanba", 1: "seshanba", 2: "chorshanba", 3: "payshanba", 4: "juma", 5: "shanba", 6: "yakshanba"}
        today_uz = weekday_map_rev[today.weekday()]
        allowed = False
        for lt in group.lesson_times.all():
            for d_name in lt.days.split(","):
                if d_name.strip() == today_uz and lt.start_time and lt.end_time:
                    if lt.start_time <= now_time <= lt.end_time:
                        allowed = True
                        break
            if allowed:
                break
        if not allowed:
            return JsonResponse({"error": "Dars vaqti ichida bo'lmaganda davomatni o'zgartira olmaysiz!"}, status=403)
        # Teacher can only save for today
        for item in attendance_data:
            item_date_str = item.get("date", "")
            if item_date_str and item_date_str != today.isoformat():
                return JsonResponse({"error": "O'qituvchi faqat bugungi davomatni o'zgartira oladi"}, status=403)
    for item in attendance_data:
        student_id = item.get("student_id")
        date_str = item.get("date")
        status = item.get("status", "absent")
        notes = item.get("notes", "")
        if not student_id or not date_str:
            continue
        try:
            att_date = date.fromisoformat(date_str)
        except:
            continue
        attendance, _ = Attendance.objects.update_or_create(
            group_id=group_id,
            student_id=student_id,
            date=att_date,
            defaults={
                "status": status,
                "notes": notes,
                "teacher": emp,
                "created_by": f"{emp.first_name} {emp.last_name}",
                "lesson_time": group.lesson_times.first(),
            },
        )
        # Balansni sinxronlash
        try:
            student_obj = Student.objects.get(pk=student_id)
            sync_attendance_balance(
                student_obj, group, attendance, status,
                created_by=f"{emp.first_name} {emp.last_name}"
            )
            if status == "absent":
                send_absence_sms(student_obj, group=group, date_str=date_str, created_by=f"{emp.first_name} {emp.last_name}")
        except Student.DoesNotExist:
            pass
    return JsonResponse({"success": True})


@csrf_exempt
@employee_api_required
def me(request):
    try:
        emp = request.user.employee_profile
    except:
        return JsonResponse({"error": "Xodim topilmadi"}, status=404)
    data = _employee_data(emp)
    data["is_admin"] = request.user.is_staff or (emp.role and emp.role.name == "Administrator")
    data["is_teacher"] = emp.role and emp.role.name == "O'qituvchi"
    data["username"] = request.user.username
    return JsonResponse({"employee": data})


@csrf_exempt
@employee_api_required
def roles_list(request):
    from .models import Role
    roles = Role.objects.all().order_by("name")
    return JsonResponse({"roles": [{"id": r.id, "name": r.name} for r in roles]})


@csrf_exempt
@employee_api_required
def positions_list(request):
    from .models import Position
    positions = Position.objects.all().order_by("name")
    return JsonResponse({"positions": [{"id": p.id, "name": p.name} for p in positions]})


@csrf_exempt
@employee_api_required
def branches_list(request):
    from .models import Branch
    branches = Branch.objects.all().order_by("name")
    return JsonResponse({"branches": [{"id": b.id, "name": b.name} for b in branches]})
