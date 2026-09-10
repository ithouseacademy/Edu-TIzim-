import json
import re
from datetime import date, datetime, timedelta
import calendar
from functools import wraps
from datetime import datetime, time, date, timedelta
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
from django.db.models import Count, Q, Sum
from django.utils import timezone as tz
from decimal import Decimal
from .models import Employee, Group, LessonTime, Attendance, AbsenceReason, Student, StudentBalance, Transaction, StudentLessonPrice, GlobalConfig, Task, Reminder, PushSubscription, VerificationCode
from .views import generate_lesson_dates, sync_lesson_teacher_salary, get_or_create_balance, get_student_lesson_price, get_student_join_date, calculate_expected_payment_up_to_today, calculate_remaining_month_payment, _calc_monthly_debts, _log_student_action
from .sms_service import send_absence_sms


def norm_phone(phone):
    return re.sub(r"\D", "", phone or "")


def sync_employee_username(employee):
    """Xodimning User.username ni telefon raqam bilan sinxronlaydi.

    Telefon o'zgartirilganda quyidagilar bo'ladi (akkaunt va ichidagi barcha
    ma'lumotlar O'ZGARMAYDAN, o'sha User qoladi):
      - login uchun username yangi raqamga ko'chadi;
      - barcha qurilmalardagi eski sessiyalar bekor qilinadi (qayta kiring, yangi raqam bilan);
      - eski raqamga chiqarilgan aktiv SMS-kodlar o'chiriladi.
    """
    if not employee or not employee.user:
        return
    new_uname = norm_phone(employee.phone)
    if not new_uname:
        return
    old_uname = employee.user.username
    if old_uname != new_uname:
        if User.objects.exclude(pk=employee.user.pk).filter(username=new_uname).exists():
            raise ValueError("Bu telefon raqam bilan boshqa foydalanuvchi mavjud")
        employee.user.username = new_uname
        employee.user.save(update_fields=["username"])
        VerificationCode.objects.filter(phone=old_uname, is_used=False).delete()
    from django.contrib.sessions.models import Session
    uid = str(employee.user.pk)
    for s in Session.objects.all():
        try:
            if str(s.get_decoded().get("_auth_user_id")) == uid:
                s.delete()
        except Exception:
            continue


# ===== BALANCE HELPERS (same logic as views.py) =====

def get_student_lesson_price(student, group):
    try:
        slp = StudentLessonPrice.objects.get(student=student, group=group)
        return slp.lesson_price
    except StudentLessonPrice.DoesNotExist:
        return group.lesson_price or Decimal('0.00')


def should_deduct_for_status(status, group=None):
    """GlobalConfig sozlamalariga qarab pul yechish kerakmi."""
    from frontend.models import GlobalConfig
    config = GlobalConfig.get_instance()
    if status == "present":
        return config.deduct_present
    if status == "absent":
        return config.deduct_absent
    if status == "excused":
        return config.deduct_excused
    return False


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
    # O'qituvchi oylik yozuvini sinxronlash (faqat present darslar uchun)
    sync_lesson_teacher_salary(student, group, attendance, new_status, created_by=created_by)


def employee_api_required(view_func):
    @wraps(view_func)
    def wrapper(request, *args, **kwargs):
        if not request.user.is_authenticated:
            return JsonResponse({"error": "Avtorizatsiya talab qilinadi"}, status=401)
        return view_func(request, *args, **kwargs)
    return wrapper


def _employee_data(emp):
    from .models import TeacherBalance
    balance = TeacherBalance.objects.filter(employee=emp).first()
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
        "salary_type": emp.salary_type,
        "salary_type_display": emp.get_salary_type_display(),
        "percent": float(emp.percent) if emp.percent else 0,
        "monthly_salary": float(emp.monthly_salary) if emp.monthly_salary else 0,
        "salary": float(emp.salary) if emp.salary else None,
        "teacher_balance": float(balance.balance) if balance else 0.0,
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
    # Raqamni normallash: '+998 20 006 45 81' -> '998200064581' kabi.
    login_username = norm_phone(phone)
    user = authenticate(request, username=login_username, password=password)
    if not user:
        # username eski/noto'g'ri formatda saqlangan bo'lsa ham topamiz:
        from .student_api import find_employee_by_phone
        emp_match = find_employee_by_phone(phone)
        if emp_match and emp_match.user:
            user = authenticate(request, username=emp_match.user.username, password=password)
    if not user:
        return JsonResponse({"error": "Telefon yoki parol noto'g'ri"}, status=401)
    try:
        emp = user.employee_profile
    except:
        return JsonResponse({"error": "Siz xodim emassiz"}, status=403)
    login(request, user)
    from .permissions import get_permissions, is_super_admin, all_codenames
    permissions = sorted(all_codenames()) if is_super_admin(user) else sorted(get_permissions(user))
    return JsonResponse({
        "success": True,
        "employee": _employee_data(emp),
        "is_admin": user.is_staff or (emp.role and emp.role.name == "Administrator"),
        "is_teacher": emp.role and emp.role.name == "O'qituvchi",
        "is_super_admin": user.is_superuser,
        "permissions": permissions,
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
    st = data.get("salary_type")
    if st in ("monthly", "percent"):
        employee.salary_type = st
    pct = data.get("percent")
    if pct is not None:
        try:
            employee.percent = Decimal(str(pct))
        except Exception:
            pass
    ms = data.get("monthly_salary")
    if ms is not None:
        try:
            employee.monthly_salary = Decimal(str(ms))
        except Exception:
            pass
    employee.notes = data.get("notes", "")
    password = data.get("password", "")
    if password:
        user = User.objects.create_user(username=norm_phone(phone), password=password, first_name=data["first_name"], last_name=data["last_name"])
        employee.user = user
    employee.save()
    if employee.user:
        sync_employee_username(employee)
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
    st = data.get("salary_type")
    if st in ("monthly", "percent"):
        employee.salary_type = st
    pct = data.get("percent")
    if pct is not None:
        try:
            employee.percent = Decimal(str(pct))
        except Exception:
            pass
    ms = data.get("monthly_salary")
    if ms is not None:
        try:
            employee.monthly_salary = Decimal(str(ms))
        except Exception:
            pass
    employee.notes = data.get("notes", employee.notes)
    password = data.get("password", "")
    if password:
        if employee.user:
            employee.user.set_password(password)
            employee.user.save()
        else:
            user = User.objects.create_user(username=norm_phone(employee.phone), password=password, first_name=employee.first_name, last_name=employee.last_name)
            employee.user = user
    employee.save()
    if employee.user:
        sync_employee_username(employee)
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
        groups = Group.objects.all()
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
        bal = 0
        try:
            sb = StudentBalance.objects.filter(student=s).first()
            if sb:
                bal = float(sb.balance)
        except Exception:
            bal = 0
        students_data.append({
            "id": s.id,
            "first_name": s.first_name,
            "last_name": s.last_name,
            "phone": s.phone,
            "balance": bal,
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
    absence_reasons = [{"id": r.id, "name": r.name} for r in AbsenceReason.objects.filter(is_active=True).order_by("order", "name")]
    return JsonResponse({
        "group": {
            "id": group.id,
            "name": group.name,
            "course": group.course.name if group.course else None,
            "room": group.room.name if group.room else None,
            "teacher": (group.teacher.first_name + " " + group.teacher.last_name).strip() if group.teacher else None,
            "lesson_time": _group_lesson_time_str(group),
            "start_date": group.start_date.isoformat() if group.start_date else None,
            "end_date": group.end_date.isoformat() if group.end_date else None,
            "remaining_days": remaining_days,
        },
        "students": students_data,
        "lesson_dates": lesson_dates,
        "att_matrix": {str(k): v for k, v in att_matrix.items()},
        "att_notes": {str(k): v for k, v in att_notes.items()},
        "student_att_history": {str(k): v for k, v in student_att_history.items()},
        "absence_reasons": absence_reasons,
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

        if day_filter:
            if day_filter in days_list:
                lesson_display = f"{lt.start_time.strftime('%H:%M')} - {lt.end_time.strftime('%H:%M')}"
        else:
            f_day = today_uz
            if f_day in days_list:
                lesson_display = f"{lt.start_time.strftime('%H:%M')} - {lt.end_time.strftime('%H:%M')}"

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


def _group_lesson_time_str(g):
    try:
        lts = list(g.lesson_times.all())
    except Exception:
        lts = []
    if not lts:
        return ""
    parts = []
    for lt in lts:
        days_display = lt.get_days_display() if hasattr(lt, "get_days_display") else lt.days
        t = f"{lt.start_time.strftime('%H:%M')} - {lt.end_time.strftime('%H:%M')}"
        parts.append(f"{days_display} {t}")
    return " · ".join(parts)


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

    balances = {
        b.student_id: float(b.balance)
        for b in StudentBalance.objects.filter(student_id__in=[s.id for s in students])
    }

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
        "balance": balances.get(s.id, 0.0),
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
def teacher_group_update_api(request, pk):
    if request.method != "POST":
        return JsonResponse({"error": "POST talab qilinadi"}, status=405)
    try:
        emp = request.user.employee_profile
    except Exception:
        return JsonResponse({"error": "Xodim topilmadi"}, status=404)
    is_admin = request.user.is_staff or (emp.role and emp.role.name == "Administrator")
    if emp.role and emp.role.name == "O'qituvchi":
        group = Group.objects.filter(pk=pk, teacher=emp).first()
    else:
        group = Group.objects.filter(pk=pk).first()
    if not group:
        return JsonResponse({"error": "Guruh topilmadi"}, status=404)

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({"error": "Noto'g'ri format"}, status=400)

    name = (data.get("name") or "").strip()
    if not name:
        return JsonResponse({"error": "Guruh nomi kiritilishi shart"}, status=400)

    lesson_times_raw = data.get("lesson_times")
    if not isinstance(lesson_times_raw, list):
        return JsonResponse({"error": "Dars vaqtlari noto'g'ri formatda"}, status=400)

    valid_days = {d[0] for d in LessonTime.DAY_CHOICES}
    parsed_lts = []
    for i, lt in enumerate(lesson_times_raw):
        if not isinstance(lt, dict):
            return JsonResponse({"error": "Dars vaqti noto'g'ri formatda"}, status=400)
        day_list = [d.strip().lower() for d in (lt.get("days") or "").split(",") if d.strip()]
        if not day_list:
            return JsonResponse({"error": f"{i+1}-dars vaqtiga kamida 1 kun tanlang"}, status=400)
        bad = [d for d in day_list if d not in valid_days]
        if bad:
            return JsonResponse({"error": f"Noto'g'ri kun: {', '.join(bad)}"}, status=400)
        day_list = sorted(set(day_list), key=lambda d: LessonTime.DAY_ORDER.get(d, 99))
        start_t = (lt.get("start_time") or "").strip()
        end_t = (lt.get("end_time") or "").strip()
        for t, label in ((start_t, "boshlanish"), (end_t, "tugash")):
            try:
                datetime.strptime(t, "%H:%M")
            except ValueError:
                return JsonResponse({"error": f"{i+1}-dars vaqti {label} vaqti noto'g'ri"}, status=400)
        parsed_lts.append({
            "days": ",".join(day_list),
            "start_time": start_t,
            "end_time": end_t,
        })

    group.name = name
    telegram_link = (data.get("telegram_link") or "").strip()
    if telegram_link:
        group.telegram_link = telegram_link
    group.save(update_fields=["name", "telegram_link"])

    group.lesson_times.all().delete()
    for lt in parsed_lts:
        LessonTime.objects.create(
            group=group,
            days=lt["days"],
            start_time=time.fromisoformat(lt["start_time"]),
            end_time=time.fromisoformat(lt["end_time"]),
        )

    return JsonResponse({"success": True, "message": "Guruh yangilandi"})


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
def my_tasks(request):
    """Joriy xodimga biriktirilgan topshiriqlar (o'qituvchi paneli uchun)."""
    try:
        emp = request.user.employee_profile
    except:
        return JsonResponse({"error": "Xodim topilmadi"}, status=404)
    status_filter = request.GET.get("status", "")
    tasks = Task.objects.filter(assigned_to=emp).select_related("assigned_to").order_by("-created_at")
    if status_filter:
        tasks = tasks.filter(status=status_filter)
    result = []
    for t in tasks:
        result.append({
            "id": t.id,
            "title": t.title,
            "description": t.description,
            "reminder": t.reminder,
            "status": t.status,
            "status_display": t.get_status_display(),
            "deadline": t.deadline.isoformat() if t.deadline else None,
            "created_by": t.created_by,
            "created_at": t.created_at.isoformat(),
            "updated_at": t.updated_at.isoformat(),
        })
    counts = {
        "all": Task.objects.filter(assigned_to=emp).count(),
        "yangi": Task.objects.filter(assigned_to=emp, status="yangi").count(),
        "jarayonda": Task.objects.filter(assigned_to=emp, status="jarayonda").count(),
        "bajarildi": Task.objects.filter(assigned_to=emp, status="bajarildi").count(),
        "bajarilmadi": Task.objects.filter(assigned_to=emp, status="bajarilmadi").count(),
        "bekor_qilindi": Task.objects.filter(assigned_to=emp, status="bekor_qilindi").count(),
    }
    return JsonResponse({"tasks": result, "counts": counts})


@csrf_exempt
@employee_api_required
def task_status(request):
    """Xodim o'z topshirig'i holatini yangilaydi (POST)."""
    if request.method != "POST":
        return JsonResponse({"error": "POST talab qilinadi"}, status=405)
    try:
        emp = request.user.employee_profile
    except:
        return JsonResponse({"error": "Xodim topilmadi"}, status=404)
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({"error": "Noto'g'ri format"}, status=400)
    task = Task.objects.filter(pk=data.get("task_id")).first()
    if not task:
        return JsonResponse({"error": "Topshiriq topilmadi"}, status=404)
    if task.assigned_to_id != emp.id:
        return JsonResponse({"error": "Bu topshiriq sizga biriktirilmagan"}, status=403)
    if task.status not in (Task.Status.NEW, Task.Status.IN_PROGRESS):
        return JsonResponse({"error": "Bu topshiriq yopilgan, holatni faqat admin o'zgartira oladi."}, status=403)
    new_status = data.get("status", "")
    valid = {s for s, _ in Task.Status.choices if s != Task.Status.CANCELLED}
    if new_status not in valid:
        return JsonResponse({"error": "Noto'g'ri holat"}, status=400)
    old_status = task.get_status_display()
    task.status = new_status
    task.save(update_fields=["status", "updated_at"])
    return JsonResponse({
        "success": True,
        "status": task.status,
        "status_display": task.get_status_display(),
        "old_status": old_status,
    })


@csrf_exempt
@employee_api_required
def my_reminders(request):
    """Joriy xodimga yuborilgan eslatmalar (o'quvchi/o'qituvchi paneli uchun)."""
    try:
        emp = request.user.employee_profile
    except:
        return JsonResponse({"error": "Xodim topilmadi"}, status=404)
    reminders = Reminder.objects.filter(Q(employee=emp) | Q(employee__isnull=True)).order_by("-created_at")
    from .reminder_state import general_read_ids_for, reader_count
    read_ids = general_read_ids_for(getattr(emp, "user", None), emp)
    data = []
    for r in reminders:
        is_read = (r.id in read_ids) if r.employee_id is None else r.is_read
        data.append({
            "id": r.id,
            "message": r.message,
            "priority": r.priority,
            "priority_display": r.get_priority_display(),
            "is_read": is_read,
            "read_at": r.read_at.isoformat() if r.read_at else None,
            "created_by": r.created_by,
            "send_to_all": r.send_to_all,
            "reader_count": reader_count(r) if r.employee_id is None else 0,
            "created_at": r.created_at.isoformat(),
        })
    return JsonResponse({
        "reminders": data,
        "unread": sum(1 for r in data if not r["is_read"]),
    })


@csrf_exempt
@employee_api_required
def reminder_read(request):
    """Xodim eslatmani «O'qidim» deb belgilaydi (POST)."""
    if request.method != "POST":
        return JsonResponse({"error": "POST talab qilinadi"}, status=405)
    try:
        emp = request.user.employee_profile
    except:
        return JsonResponse({"error": "Xodim topilmadi"}, status=404)
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({"error": "Noto'g'ri format"}, status=400)
    reminder = Reminder.objects.filter(pk=data.get("reminder_id")).first()
    if not reminder:
        return JsonResponse({"error": "Eslatma topilmadi"}, status=404)
    if reminder.employee_id is not None and reminder.employee_id != emp.id:
        return JsonResponse({"error": "Bu eslatma sizga yuborilmagan"}, status=403)
    from .reminder_state import mark_read_for
    if not mark_read_for(getattr(emp, "user", None), emp, reminder):
        return JsonResponse({"error": "Xodim topilmadi"}, status=404)
    return JsonResponse({"success": True, "is_read": True})


@csrf_exempt
@employee_api_required
def notifications(request):
    """Xodim uchun bildirishnoma (ogohlantirish) hisobi.

    Faqat "yangi" sanalganlar hisoblanadi: xodim bildirishnomalarni ko'rmagan
    (notifications_seen_at) vaqtdan keyin kelgan topshiriqlar hamda hali
    o'qilmagan eslatmalar. Topshiriqlar sahifasiga kirganda ko'rish vaqti
    yangilanadi (mark_notifications_seen), shuning uchun qizil badge yo'qoladi.
    """
    try:
        emp = request.user.employee_profile
    except:
        return JsonResponse({"error": "Xodim topilmadi"}, status=404)
    from django.utils import timezone
    from .reminder_state import unread_count_for
    seen = emp.notifications_seen_at
    active = 0
    if seen is None:
        seen = timezone.now() - timezone.timedelta(days=3650)
    active = Task.objects.filter(
        assigned_to=emp, created_at__gte=seen
    ).exclude(status__in=["bajarildi", "bekor_qilindi"]).count()
    unread = unread_count_for(getattr(emp, "user", None), emp)
    return JsonResponse({
        "unread_reminders": unread,
        "active_tasks": active,
        "total": unread + active,
        "seen_at": emp.notifications_seen_at.isoformat() if emp.notifications_seen_at else None,
    })


@csrf_exempt
@employee_api_required
def mark_notifications_seen(request):
    """Topshiriqlar sahifasiga kirganda chaqiriladi — badge yo'qolishi uchun."""
    if request.method != "POST":
        return JsonResponse({"error": "POST talab qilinadi"}, status=405)
    try:
        emp = request.user.employee_profile
    except:
        return JsonResponse({"error": "Xodim topilmadi"}, status=404)
    from django.utils import timezone
    now = timezone.now()
    emp.notifications_seen_at = now
    emp.save(update_fields=["notifications_seen_at"])
    return JsonResponse({"success": True, "seen_at": now.isoformat()})


@csrf_exempt
@employee_api_required
def push_vapid_public(request):
    """Frontend push-obuna yaratishi uchun VAPID ochiq kaliti."""
    from .webpush_utils import VAPID_PUBLIC_KEY
    return JsonResponse({"public_key": VAPID_PUBLIC_KEY})


@csrf_exempt
@employee_api_required
def push_subscribe(request):
    """Brauzer push-obunasini saqlaydi (sayt yopiq bo'lsa ham bildirishnoma uchun)."""
    if request.method != "POST":
        return JsonResponse({"error": "POST talab qilinadi"}, status=405)
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({"error": "Noto'g'ri format"}, status=400)
    endpoint = (data.get("endpoint") or "").strip()
    keys = data.get("keys") or {}
    p256dh = (keys.get("p256dh") or "").strip()
    auth = (keys.get("auth") or "").strip()
    if not endpoint or not p256dh or not auth:
        return JsonResponse({"error": "endpoint, p256dh va auth talab qilinadi"}, status=400)
    PushSubscription.objects.update_or_create(
        endpoint=endpoint,
        defaults={"user": request.user, "p256dh": p256dh, "auth": auth},
    )
    return JsonResponse({"success": True})


@csrf_exempt
@employee_api_required
def push_unsubscribe(request):
    """Brauzer push-obunasini o'chiradi."""
    if request.method != "POST":
        return JsonResponse({"error": "POST talab qilinadi"}, status=405)
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({"error": "Noto'g'ri format"}, status=400)
    endpoint = (data.get("endpoint") or "").strip()
    if endpoint:
        PushSubscription.objects.filter(endpoint=endpoint).delete()
    return JsonResponse({"success": True})


@csrf_exempt
@employee_api_required
def me(request):
    try:
        emp = request.user.employee_profile
    except:
        return JsonResponse({"error": "Xodim topilmadi"}, status=404)
    data = _employee_data(emp)
    data["is_teacher"] = emp.role and emp.role.name == "O'qituvchi"
    data["username"] = request.user.username
    data["is_super_admin"] = request.user.is_superuser
    from .permissions import get_permissions, is_super_admin, all_codenames
    if is_super_admin(request.user):
        data["permissions"] = sorted(all_codenames())
    else:
        data["permissions"] = sorted(get_permissions(request.user))
    return JsonResponse({"employee": data})


@csrf_exempt
@employee_api_required
def upload_photo(request):
    """Xodim profil rasmini yuklaydi (POST, multipart/form-data)."""
    if request.method != "POST":
        return JsonResponse({"error": "POST talab qilinadi"}, status=405)
    try:
        emp = request.user.employee_profile
    except:
        return JsonResponse({"error": "Xodim topilmadi"}, status=404)
    photo = request.FILES.get("photo")
    if not photo:
        return JsonResponse({"error": "Rasm topilmadi"}, status=400)
    emp.photo = photo
    emp.save(update_fields=["photo"])
    return JsonResponse({"success": True, "photo": emp.photo.url if emp.photo else None})


@csrf_exempt
@employee_api_required
def change_password(request):
    """Xodim o'z parolini o'zgartiradi (eski parolni tasdiqlash shart)."""
    if request.method != "POST":
        return JsonResponse({"error": "POST talab qilinadi"}, status=405)
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({"error": "Noto'g'ri format"}, status=400)
    old_password = data.get("old_password", "")
    new_password = data.get("new_password", "")
    if not new_password or len(new_password) < 4:
        return JsonResponse({"error": "Yangi parol kamida 4 ta belgidan iborat bo'lishi kerak"}, status=400)
    user = request.user
    if not user.check_password(old_password):
        return JsonResponse({"error": "Joriy parol noto'g'ri"}, status=400)
    user.set_password(new_password)
    user.save()
    from django.contrib.auth import update_session_auth_hash
    update_session_auth_hash(request, user)
    return JsonResponse({"success": True, "message": "Parol muvaffaqiyatli yangilandi"})


@csrf_exempt
@employee_api_required
def change_phone(request):
    """Xodim o'z telefon raqamini o'zgartiradi (eski parolni tasdiqlash shart)."""
    if request.method != "POST":
        return JsonResponse({"error": "POST talab qilinadi"}, status=405)
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({"error": "Noto'g'ri format"}, status=400)
    old_password = data.get("old_password", "")
    new_phone = norm_phone(data.get("new_phone", ""))
    if not new_phone or not new_phone.isdigit() or not (9 <= len(new_phone) <= 13):
        return JsonResponse({"error": "Telefon raqam noto'g'ri"}, status=400)
    try:
        emp = request.user.employee_profile
    except Exception:
        return JsonResponse({"error": "Xodim topilmadi"}, status=404)
    if not request.user.check_password(old_password):
        return JsonResponse({"error": "Joriy parol noto'g'ri"}, status=400)
    if new_phone == norm_phone(emp.phone):
        return JsonResponse({"error": "Yangi raqam joriy raqam bilan bir xil"}, status=400)
    if Employee.objects.filter(phone=new_phone).exclude(pk=emp.pk).exists():
        return JsonResponse({"error": "Bu telefon raqam boshqa xodimda mavjud"}, status=400)
    if request.user and User.objects.exclude(pk=request.user.pk).filter(username=new_phone).exists():
        return JsonResponse({"error": "Bu telefon raqam bilan boshqa foydalanuvchi mavjud"}, status=400)
    old_phone = emp.phone
    emp.phone = new_phone
    emp.save(update_fields=["phone"])
    try:
        sync_employee_username(emp)
    except ValueError as ex:
        emp.phone = old_phone
        emp.save(update_fields=["phone"])
        return JsonResponse({"error": str(ex)}, status=400)
    return JsonResponse({"success": True, "message": "Telefon raqam yangilandi. Yangi raqam bilan qayta kiring."})


@csrf_exempt
@employee_api_required
def admin_transactions(request):
    """So'nggi to'lov tranzaksiyalari (faqat adminlar uchun).

    Har bir administrator faqat O'ZINI qilgan operatsiyalarini va o'z
    kassasidagi balansini ko'radi.
    """
    emp = None
    try:
        emp = request.user.employee_profile
        is_admin = request.user.is_staff or (emp.role and emp.role.name == "Administrator")
    except Exception:
        is_admin = request.user.is_staff
    if not is_admin:
        return JsonResponse({"error": "Faqat adminlar"}, status=403)
    limit = min(int(request.GET.get("limit", 50)), 200)
    emp_name = f"{(getattr(emp, 'first_name', '') or '').strip()} {(getattr(emp, 'last_name', '') or '').strip()}".strip() if emp else request.user.get_full_name().strip()
    base_qs = Transaction.objects.select_related("student", "group").filter(created_by=emp_name)

    def _tot(qs_):
        inc = qs_.filter(amount__gt=0).aggregate(s=Sum("amount"))["s"] or Decimal("0.00")
        exp = qs_.filter(amount__lt=0).aggregate(s=Sum("amount"))["s"] or Decimal("0.00")
        return float(inc), float(exp)

    today = tz.localdate()
    month_start = today.replace(day=1)
    today_income, today_expense = _tot(base_qs.filter(created_at__date=today))
    month_income, month_expense = _tot(base_qs.filter(created_at__date__gte=month_start))
    total_income, total_expense = _tot(base_qs)

    txs = base_qs.order_by("-created_at")[:limit]
    data = []
    for t in txs:
        loc = t.created_at.astimezone(tz.get_current_timezone())
        data.append({
            "id": t.id,
            "amount": float(t.amount),
            "amount_str": f"{'+' if t.amount >= 0 else ''}{t.amount:,.0f} so'm",
            "balance_after": float(t.balance_after),
            "balance_after_str": f"{t.balance_after:,.0f} so'm",
            "type": t.transaction_type,
            "type_display": t.get_transaction_type_display(),
            "student_name": str(t.student) if t.student else "",
            "group": t.group.name if t.group else "",
            "description": t.description or "",
            "created_by": t.created_by or "",
            "created_at": loc.strftime("%d.%m.%Y %H:%M"),
            "date": loc.date().isoformat(),
        })
    from .models import Kassa
    own_kassa = Kassa.all_objects.filter(owner=request.user).first()
    kassa_balance = float(own_kassa.balance) if own_kassa else 0.0
    return JsonResponse({
        "transactions": data,
        "kassa_balance": kassa_balance,
        "kassa_name": own_kassa.name if own_kassa else "",
        "today_income": today_income,
        "today_expense": today_expense,
        "month_income": month_income,
        "month_expense": month_expense,
        "total_income": total_income,
        "total_expense": total_expense,
    })


@csrf_exempt
@employee_api_required
def student_list(request):
    from .models import Student, StudentBalance

    search = request.GET.get("search", "").strip()
    students = Student.objects.filter(is_deleted=False).prefetch_related("groups", "groups__course").order_by("first_name", "last_name")
    if search:
        from django.db.models import Q
        q = Q(first_name__icontains=search) | Q(last_name__icontains=search)
        digits = "".join(c for c in search if c.isdigit())
        if digits:
            q |= Q(phone__icontains=digits)
        students = students.filter(q)
    data = []
    for s in students[:500]:
        bal_qs = StudentBalance.objects.filter(student=s)
        balance = bal_qs.first().balance if bal_qs.exists() else 0.0
        groups = [g.name for g in s.groups.all()[:3]]
        data.append({
            "id": s.id,
            "first_name": s.first_name,
            "last_name": s.last_name,
            "phone": s.phone,
            "balance": balance,
            "balance_str": f"{balance:,.0f} so'm",
            "status": s.status,
            "status_display": s.get_status_display(),
            "groups": groups,
            "groups_str": ", ".join(groups),
            "created_at": s.created_at.strftime("%d.%m.%Y") if s.created_at else "",
        })
    return JsonResponse({"students": data, "count": len(data)})


@csrf_exempt
@employee_api_required
def student_detail(request, pk):
    from .models import Student, StudentBalance, Transaction, Attendance, Group

    student = Student.objects.filter(pk=pk, is_deleted=False).prefetch_related("groups", "graduated_groups", "desired_course").first()
    if not student:
        return JsonResponse({"error": "O'quvchi topilmadi"}, status=404)

    bal_qs = StudentBalance.objects.filter(student=student)
    balance = float(bal_qs.first().balance) if bal_qs.exists() else 0.0

    group_list = []
    seen = set()
    for g in student.groups.all():
        if g.id in seen:
            continue
        seen.add(g.id)
        group_list.append({
            "id": g.id,
            "name": g.name,
            "status": g.status,
            "status_display": g.get_status_display() if hasattr(g, "get_status_display") else g.status,
            "graduated": g.id in student.graduated_groups.all().values_list("id", flat=True),
        })
    for g in student.graduated_groups.all():
        if g.id in seen:
            continue
        seen.add(g.id)
        group_list.append({
            "id": g.id,
            "name": g.name,
            "status": g.status,
            "status_display": g.get_status_display() if hasattr(g, "get_status_display") else g.status,
            "graduated": True,
        })

    txs = Transaction.objects.filter(student=student).select_related("group").order_by("-created_at")[:50]
    tx_list = []
    for t in txs:
        loc = t.created_at.astimezone(tz.get_current_timezone()) if t.created_at else t.created_at
        tx_list.append({
            "id": t.id,
            "amount": float(t.amount),
            "amount_str": f"{'+' if t.amount >= 0 else ''}{t.amount:,.0f} so'm",
            "type": t.transaction_type,
            "type_display": t.get_transaction_type_display(),
            "group": t.group.name if t.group else "",
            "description": t.description or "",
            "created_by": t.created_by or "",
            "created_at": loc.strftime("%d.%m.%Y %H:%M") if loc else "",
        })

    atts = Attendance.objects.filter(student=student).select_related("group", "teacher").order_by("-date")
    att_count = atts.count()
    att_absent = atts.filter(status="yo'q").count()
    att_present = atts.filter(status="bor").count()
    atts = atts[:100]
    att_list = []
    for a in atts:
        loc = a.created_at.astimezone(tz.get_current_timezone()) if a.created_at else a.created_at
        att_list.append({
            "id": a.id,
            "date": a.date.strftime("%d.%m.%Y") if a.date else "",
            "status": a.status,
            "status_display": a.get_status_display() if hasattr(a, "get_status_display") else a.status,
            "group": a.group.name if a.group else "",
            "teacher": f"{a.teacher.first_name} {a.teacher.last_name or ''}".strip() if a.teacher else "",
            "created_at": loc.strftime("%d.%m.%Y %H:%M") if loc else "",
        })

    from .models import SmsHistory, StudentLog
    from django.db.models import Q as Q_
    phones = [p for p in [student.phone, student.father_phone, student.mother_phone] if p]
    name_q = Q_()
    for phone in phones:
        name_q |= Q_(recipient_phone=phone)
    name_q |= Q_(student_name__icontains=student.first_name) & Q_(student_name__icontains=student.last_name)
    sms_history = list(SmsHistory.objects.filter(name_q).order_by("-created_at")[:100])
    student_name = f"{student.first_name} {student.last_name}"
    merged_sms = []
    for s in sms_history:
        sc = s.created_at.astimezone(tz.get_current_timezone()) if s.created_at else s.created_at
        merged_sms.append({
            "sms_type": s.sms_type,
            "message": s.message or "",
            "recipient_name": s.recipient_name or "",
            "recipient_phone": s.recipient_phone or "",
            "status": s.status,
            "created_at": sc.strftime("%d.%m.%Y %H:%M") if sc else "",
        })
    for t in txs:
        if t.transaction_type == "payment":
            tc = t.created_at.astimezone(tz.get_current_timezone()) if t.created_at else t.created_at
            merged_sms.append({
                "sms_type": "payment",
                "message": f"{t.amount} so'm to'lov qabul qilindi",
                "recipient_name": student_name,
                "recipient_phone": student.phone,
                "status": "yuborildi" if t.created_by else "qayd etildi",
                "created_at": tc.strftime("%d.%m.%Y %H:%M") if tc else "",
            })
    for a in atts:
        if a.status == "yo'q":
            ac = a.created_at.astimezone(tz.get_current_timezone()) if a.created_at else None
            merged_sms.append({
                "sms_type": "absence",
                "message": f"{a.date} kuni darsga kelmadi ({a.group.name if a.group else ''})",
                "recipient_name": student_name,
                "recipient_phone": student.phone,
                "status": "qayd etildi",
                "created_at": ac.strftime("%d.%m.%Y %H:%M") if ac else "",
            })
    merged_sms.sort(key=lambda x: x["created_at"], reverse=True)

    log_list = []
    for log in student.logs.select_related("group").all().order_by("-created_at")[:100]:
        lc = log.created_at.astimezone(tz.get_current_timezone()) if log.created_at else log.created_at
        log_list.append({
            "id": log.id,
            "action": log.action,
            "action_display": log.get_action_display() if hasattr(log, "get_action_display") else log.action,
            "reason": log.reason or "",
            "group": log.group.name if log.group else "",
            "created_by": log.created_by or "",
            "created_at": lc.strftime("%d.%m.%Y %H:%M") if lc else "",
        })

    monthly_debts, deferred_payments = _calc_monthly_debts(student)
    prev_debt = float(sum(d["debt"] for d in monthly_debts))
    current_expected = float(calculate_expected_payment_up_to_today(student))
    total_owed = float(calculate_remaining_month_payment(student))

    active_groups = student.groups.filter(status="aktiv")
    now_date = date.today()
    month_start = now_date.replace(day=1)
    last_day = calendar.monthrange(now_date.year, now_date.month)[1]
    month_end = now_date.replace(day=last_day)
    remaining_lessons = 0
    remaining_cost = 0.0
    for group in active_groups:
        price = get_student_lesson_price(student, group)
        lesson_dates = generate_lesson_dates(group, month_start, month_end)
        future_dates = [d for d in lesson_dates if d >= now_date]
        remaining_lessons += len(future_dates)
        if price > 0:
            tomorrow = now_date + timedelta(days=1)
            remaining_lesson_dates = generate_lesson_dates(group, tomorrow, month_end)
            remaining_cost += len(remaining_lesson_dates) * float(price)

    monthly_debt_list = [{"label": d["label"], "debt": float(d["debt"])} for d in monthly_debts]
    deferred_list = [{"month": d.get("month", ""), "reason": d.get("reason", ""), "label": d.get("label", ""), "debt": float(d.get("debt") or 0)} for d in deferred_payments]

    up_to_today_cost = current_expected - remaining_cost
    shu_kungacha = up_to_today_cost
    oy_oxirigacha = total_owed

    return JsonResponse({
        "student": {
            "id": student.id,
            "first_name": student.first_name,
            "last_name": student.last_name,
            "phone": student.phone,
            "email": student.email or "",
            "birth_date": student.birth_date.strftime("%d.%m.%Y") if student.birth_date else "",
            "status": student.status,
            "status_display": student.get_status_display(),
            "created_at": student.created_at.strftime("%d.%m.%Y") if student.created_at else "",
            "school": student.school or "",
            "father_full_name": student.father_full_name or "",
            "father_phone": student.father_phone or "",
            "father_workplace": student.father_workplace or "",
            "mother_full_name": student.mother_full_name or "",
            "mother_phone": student.mother_phone or "",
            "mother_workplace": student.mother_workplace or "",
            "home_address": student.home_address or "",
            "additional_info": student.additional_info or "",
            "education_language": student.education_language or "",
            "education_types": [],
            "balance": balance,
            "balance_str": f"{balance:,.0f} so'm",
        },
        "groups": group_list,
        "debt": {
            "monthly_debts": monthly_debt_list,
            "deferred_payments": deferred_list,
            "prev_debt": prev_debt,
            "current_expected": current_expected,
            "total_owed": total_owed,
            "remaining_lessons": remaining_lessons,
            "shu_kungacha": shu_kungacha,
            "oy_oxirigacha": oy_oxirigacha,
        },
        "transactions": tx_list,
        "attendance_stats": {
            "total": att_count,
            "present": att_present,
            "absent": att_absent,
        },
        "attendance_history": att_list,
        "sms_history": merged_sms,
        "logs": log_list,
    })


@csrf_exempt
@employee_api_required
def student_remove_group(request, pk):
    from .models import Student, Group

    if request.method != "POST":
        return JsonResponse({"error": "Faqat POST so'rov qabul qilinadi"}, status=405)

    student = Student.objects.filter(pk=pk, is_deleted=False).first()
    if not student:
        return JsonResponse({"error": "O'quvchi topilmadi"}, status=404)

    try:
        body = json.loads(request.body or b"{}")
    except Exception:
        body = {}

    group_id = body.get("group_id")
    reason = (body.get("reason") or "").strip()

    group = Group.objects.filter(pk=group_id).first() if group_id else None

    if group and group in student.groups.all():
        student.groups.remove(group)
        student.graduated_groups.remove(group)
        _log_student_action(student, group, "removed", reason or "Guruhdan chiqarildi", request=request)
        remaining = student.groups.count()
        if remaining == 0:
            student.frozen_until = None
            student.status = "chiqarilgan"
            student.save(update_fields=["frozen_until", "status"])
    elif group and group in student.graduated_groups.all():
        student.graduated_groups.remove(group)
        _log_student_action(student, group, "removed", reason or "Bitirgan guruhdan chiqarildi", request=request)
    else:
        return JsonResponse({"error": "O'quvchi bu guruhda emas"}, status=400)

    return JsonResponse({"success": True, "message": f"{student.first_name} {student.last_name} guruhdan chiqarildi"})


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
