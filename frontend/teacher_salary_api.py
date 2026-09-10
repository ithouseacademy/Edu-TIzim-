import json
import calendar
from functools import wraps
from datetime import date, datetime
from decimal import Decimal
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.db.models import Sum, Count
from django.utils import timezone as tz
from .models import Employee, TeacherBalance, TeacherTransaction, LessonTeacherSalary
from .views import get_or_create_teacher_balance, add_teacher_balance_transaction


def _admin_required(view_func):
    @wraps(view_func)
    def wrapper(request, *args, **kwargs):
        if not request.user.is_authenticated:
            return JsonResponse({"error": "Avtorizatsiya talab qilinadi"}, status=401)
        try:
            emp = request.user.employee_profile
            is_admin = request.user.is_staff or (emp.role and emp.role.name == "Administrator")
        except Exception:
            is_admin = request.user.is_staff
        if not is_admin:
            return JsonResponse({"error": "Faqat adminlar"}, status=403)
        return view_func(request, *args, **kwargs)
    return wrapper


def _employee_login_required(view_func):
    @wraps(view_func)
    def wrapper(request, *args, **kwargs):
        if not request.user.is_authenticated:
            return JsonResponse({"error": "Avtorizatsiya talab qilinadi"}, status=401)
        return view_func(request, *args, **kwargs)
    return wrapper


def _month_range():
    today = tz.localdate()
    last_day = calendar.monthrange(today.year, today.month)[1]
    return date(today.year, today.month, 1), date(today.year, today.month, last_day)


def _salary_stats(employee, include_transactions=False):
    balance, _ = TeacherBalance.objects.get_or_create(employee=employee, defaults={"balance": Decimal('0.00')})
    today = tz.localdate()
    month_start, month_end = _month_range()
    tx = TeacherTransaction.objects.filter(employee=employee)

    # INCOME bo'yicha oy hisobi dars sanasi (salary_date) asosida olib boriladi
    income_month = tx.filter(
        transaction_type=TeacherTransaction.Type.INCOME,
    ).exclude(salary_date__isnull=True).filter(
        salary_date__gte=month_start, salary_date__lte=month_end,
    ).aggregate(total=Sum("amount"))["total"] or Decimal('0.00')
    income_month_no_date = tx.filter(
        transaction_type=TeacherTransaction.Type.INCOME,
        salary_date__isnull=True,
        created_at__date__gte=month_start,
        created_at__date__lte=month_end,
    ).aggregate(total=Sum("amount"))["total"] or Decimal('0.00')

    today_income = tx.filter(
        transaction_type=TeacherTransaction.Type.INCOME,
        salary_date=today,
    ).aggregate(total=Sum("amount"))["total"] or Decimal('0.00')
    if today_income == 0:
        today_income = tx.filter(
            transaction_type=TeacherTransaction.Type.INCOME,
            created_at__date=today,
        ).aggregate(total=Sum("amount"))["total"] or Decimal('0.00')

    month_earned = income_month + income_month_no_date

    paid_total = tx.filter(
        transaction_type__in=[
            TeacherTransaction.Type.PAYOUT,
            TeacherTransaction.Type.ADVANCE,
            TeacherTransaction.Type.ADVANCE_CLOSE,
        ],
    ).aggregate(total=Sum("amount"))["total"] or Decimal('0.00')

    month_paid = tx.filter(
        transaction_type__in=[
            TeacherTransaction.Type.PAYOUT,
            TeacherTransaction.Type.ADVANCE,
            TeacherTransaction.Type.ADVANCE_CLOSE,
        ],
        created_at__date__gte=month_start,
        created_at__date__lte=month_end,
    ).aggregate(total=Sum("amount"))["total"] or Decimal('0.00')

    pending = LessonTeacherSalary.objects.filter(
        teacher=employee, status=LessonTeacherSalary.Status.PENDING
    )
    pending_amount = pending.aggregate(total=Sum("teacher_amount"))["total"] or Decimal('0.00')
    pending_count = pending.count()
    pending_student_count = pending.values("student").distinct().count()
    pending_students = list(
        pending.values("student_id", "student__first_name", "student__last_name")
        .annotate(
            amount=Sum("teacher_amount"),
            lessons=Count("id"),
        )
        .order_by("-amount")
    )
    pending_students = [
        {
            "student_id": p["student_id"],
            "student_name": f"{p['student__first_name']} {p['student__last_name']}".strip(),
            "amount": float(p["amount"] or 0),
            "lessons": p["lessons"],
        }
        for p in pending_students
    ]

    data = {
        "employee_id": employee.id,
        "first_name": employee.first_name,
        "last_name": employee.last_name,
        "salary_type": employee.salary_type,
        "salary_type_display": employee.get_salary_type_display(),
        "percent": float(employee.percent or 0),
        "monthly_salary": float(employee.monthly_salary or 0),
        "salary_enabled": employee.salary_enabled,
        "salary": float(employee.salary) if employee.salary else None,
        "balance": float(balance.balance),
        "avans_balance": float(balance.avans_balance),
        "today_income": float(today_income),
        "month_earned": float(month_earned),
        "paid_total": float(paid_total),
        "month_paid": float(month_paid),
        "pending_amount": float(pending_amount),
        "pending_count": pending_count,
        "pending_student_count": pending_student_count,
        "pending_students": pending_students,
        "unpaid": float(balance.balance),
    }
    if include_transactions:
        data["transactions"] = [
            {
                "id": t.id,
                "amount": float(t.amount),
                "transaction_type": t.transaction_type,
                "transaction_type_display": t.get_transaction_type_display(),
                "salary_type": t.salary_type or "",
                "student_name": f"{t.student.first_name} {t.student.last_name}" if t.student else "",
                "group_name": t.group.name if t.group else "",
                "percent": float(t.percent or 0),
                "payment_method": t.payment_method or "",
                "description": t.description or "",
                "created_by": t.created_by or "",
                "balance_after": float(t.balance_after),
                "prev_balance": float(t.balance_after - t.amount),
                "avans_balance_after": float(t.avans_balance_after) if t.avans_balance_after is not None else None,
                "created_at": tz.localtime(t.created_at).strftime("%d.%m.%Y %H:%M"),
                "date": tz.localtime(t.created_at).strftime("%d.%m.%Y"),
            }
            for t in tx[:200]
        ]
    return data


def _salary_stats_batch(employees):
    """Xodimlar ro'yxati uchun barcha oylik statistikani bitta to'plam so'rovlarda hisoblaydi.

    `_salary_stats` har bir xodim uchun ~12 ta so'rov yuboradi (N+1 muammosi).
    Bu funksiya barcha xodimlar uchun zarur bo'lgan qiymatlarni 4-5 ta
    so'rov bilan hisoblab, {employee_id: stats} lug'atini qaytaradi.
    """
    ids = [e.id for e in employees]
    if not ids:
        return {}

    month_start, month_end = _month_range()
    tx = TeacherTransaction.objects.filter(employee_id__in=ids)

    def _by_employee(qs, fk="employee_id", amount_field="amount"):
        return {
            r[fk]: r["total"] or Decimal('0.00')
            for r in qs.values(fk).annotate(total=Sum(amount_field))
        }

    income_month = _by_employee(
        tx.filter(
            transaction_type=TeacherTransaction.Type.INCOME,
            salary_date__gte=month_start, salary_date__lte=month_end,
        )
    )
    income_month_no_date = _by_employee(
        tx.filter(
            transaction_type=TeacherTransaction.Type.INCOME,
            salary_date__isnull=True,
            created_at__date__gte=month_start, created_at__date__lte=month_end,
        )
    )
    paid_total = _by_employee(
        tx.filter(
            transaction_type__in=[
                TeacherTransaction.Type.PAYOUT,
                TeacherTransaction.Type.ADVANCE,
                TeacherTransaction.Type.ADVANCE_CLOSE,
            ],
        )
    )
    pending_amount = _by_employee(
        LessonTeacherSalary.objects.filter(
            teacher_id__in=ids,
            status=LessonTeacherSalary.Status.PENDING,
        ),
        fk="teacher_id",
        amount_field="teacher_amount",
    )

    balances = {
        b.employee_id: b
        for b in TeacherBalance.objects.filter(employee_id__in=ids)
    }
    for e in employees:
        if e.id not in balances:
            b, _ = TeacherBalance.objects.get_or_create(
                employee=e, defaults={"balance": Decimal('0.00')}
            )
            balances[e.id] = b

    stats = {}
    for e in employees:
        b = balances[e.id]
        stats[e.id] = {
            "employee_id": e.id,
            "first_name": e.first_name,
            "last_name": e.last_name,
            "salary_type": e.salary_type,
            "salary_type_display": e.get_salary_type_display(),
            "percent": float(e.percent or 0),
            "monthly_salary": float(e.monthly_salary or 0),
            "salary_enabled": e.salary_enabled,
            "salary": float(e.salary) if e.salary else None,
            "balance": float(b.balance),
            "avans_balance": float(b.avans_balance),
            "month_earned": float(income_month.get(e.id, 0) + income_month_no_date.get(e.id, 0)),
            "paid_total": float(paid_total.get(e.id, 0)),
            "pending_amount": float(pending_amount.get(e.id, 0)),
            "unpaid": float(b.balance),
        }
    return stats


def _created_by(request):
    employee = getattr(request.user, "employee_profile", None)
    if employee:
        return f"{employee.first_name} {employee.last_name or ''}".strip() or "Administrator"
    return request.user.get_full_name() or request.user.username or "Administrator"


@csrf_exempt
@_admin_required
def teacher_salary_list(request):
    """Barcha o'qituvchilar bo'yicha oylik statistikasi (admin)."""
    employees = Employee.objects.select_related("role").filter(is_deleted=False, is_active=True).order_by("first_name")
    teachers = [
        e for e in employees
        if e.role and e.role.name in ("O'qituvchi", "Support Teacher")
    ]
    return JsonResponse({"teachers": [_salary_stats(e) for e in teachers]})


@csrf_exempt
@_admin_required
def teacher_salary_detail(request, pk):
    """Bitta o'qituvchining oylik ma'lumotlari + tranzaksiyalar tarixi + dars yozuvlari."""
    employee = Employee.objects.filter(pk=pk, is_deleted=False).first()
    if not employee:
        return JsonResponse({"error": "Xodim topilmadi"}, status=404)
    salary = _salary_stats(employee, include_transactions=True)
    salary["lessons"] = [
        {
            "id": s.id,
            "student_name": f"{s.student.first_name} {s.student.last_name}" if s.student else "",
            "group_name": s.group.name if s.group else "",
            "date": s.date.strftime("%d.%m.%Y"),
            "lesson_price": float(s.lesson_price),
            "teacher_percent": float(s.teacher_percent),
            "teacher_amount": float(s.teacher_amount),
            "status": s.status,
            "status_display": s.get_status_display(),
            "payment_date": s.payment_date.strftime("%d.%m.%Y") if s.payment_date else "",
        }
        for s in LessonTeacherSalary.objects.filter(teacher=employee).order_by("-date", "-id")[:300]
    ]
    return JsonResponse({"salary": salary})


@csrf_exempt
@_admin_required
def teacher_salary_pay(request, pk):
    """O'qituvchiga oylik to'lash - balans nolga tushadi, tranzaksiya saqlanadi."""
    if request.method != "POST":
        return JsonResponse({"error": "POST talab qilinadi"}, status=405)
    employee = Employee.objects.filter(pk=pk, is_deleted=False).first()
    if not employee:
        return JsonResponse({"error": "Xodim topilmadi"}, status=404)
    balance = get_or_create_teacher_balance(employee)
    if balance.balance <= 0:
        return JsonResponse({"error": "To'lanadigan summa mavjud emas (balans 0)"}, status=400)
    try:
        data = json.loads(request.body) if request.body else {}
    except json.JSONDecodeError:
        data = {}
    amount = balance.balance
    payment_method = str(data.get("payment_method", "")).strip()
    description = str(data.get("description", "")).strip() or "Oylik berildi"
    add_teacher_balance_transaction(
        employee,
        -amount,
        TeacherTransaction.Type.PAYOUT,
        description=description,
        created_by=_created_by(request),
        payment_method=payment_method,
    )
    # Kassa chiqimi sifatida ham qayd etiladi (agar kassa mavjud bo'lsa).
    # Kassa hech qachon minusga tushmasligi uchun faqat yetarli mablag' bo'lganda qayd etiladi.
    try:
        from .models import Kassa, KassaTransaction
        kassa = Kassa.objects.filter(is_active=True).first()
        if kassa:
            bal_before = kassa.balance
            if bal_before < amount:
                return JsonResponse(
                    {"error": f"Kassada yetarli mablag' yo'q! Balans: {bal_before:,.0f} so'm"},
                    status=400,
                )
            KassaTransaction.objects.create(
                kassa=kassa,
                transaction_type=KassaTransaction.TransactionType.EXPENSE,
                amount=amount,
                balance_before=bal_before,
                balance_after=bal_before - amount,
                expense_category=KassaTransaction.ExpenseCategory.SALARY,
                description=f"Oylik to'lovi: {employee.first_name} {employee.last_name} — {description}",
                payment_method=payment_method,
                created_by=_created_by(request),
                created_by_user=request.user,
            )
    except Exception:
        pass
    return JsonResponse({"success": True, "message": "Oylik muvaffaqiyatli to'landi", "salary": _salary_stats(employee)})


@csrf_exempt
@_admin_required
def teacher_salary_update_percent(request, pk):
    """O'qituvchi oylik turi/foizini tahrirlash."""
    if request.method != "PUT":
        return JsonResponse({"error": "PUT talab qilinadi"}, status=405)
    employee = Employee.objects.filter(pk=pk, is_deleted=False).first()
    if not employee:
        return JsonResponse({"error": "Xodim topilmadi"}, status=404)
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({"error": "Noto'g'ri format"}, status=400)
    salary_type = data.get("salary_type", employee.salary_type)
    if salary_type not in ("monthly", "percent"):
        return JsonResponse({"error": "Noto'g'ri oylik turi"}, status=400)
    if salary_type == "monthly":
        employee.salary_type = salary_type
        employee.percent = Decimal('0.00')
        monthly_salary = data.get("monthly_salary")
        if monthly_salary is not None:
            try:
                employee.monthly_salary = Decimal(str(monthly_salary))
            except Exception:
                return JsonResponse({"error": "Noto'g'ri oylik qiymati"}, status=400)
    else:
        employee.salary_type = salary_type
        employee.monthly_salary = Decimal('0.00')
        percent = data.get("percent")
        if percent is not None:
            try:
                employee.percent = Decimal(str(percent))
            except Exception:
                return JsonResponse({"error": "Noto'g'ri foiz qiymati"}, status=400)
    employee.salary_enabled = True
    employee.save(update_fields=["salary_type", "percent", "monthly_salary", "salary_enabled"])
    return JsonResponse({"success": True, "salary": _salary_stats(employee)})


def _salary_history(employee):
    """O'qituvchi uchun oylik/avans tarixi va oy-yillik jadvali."""
    def _map(t):
        return {
            "id": t.id,
            "amount": float(t.amount),
            "payment_method": t.payment_method or "",
            "description": t.description or "",
            "created_at": tz.localtime(t.created_at).strftime("%d.%m.%Y %H:%M"),
        }

    salary_history = [
        _map(t)
        for t in TeacherTransaction.objects.filter(
            employee=employee, transaction_type=TeacherTransaction.Type.PAYOUT,
        ).order_by("-created_at")[:500]
    ]
    avans_history = [
        {
            **_map(t),
            "transaction_type": t.transaction_type,
            "transaction_type_display": t.get_transaction_type_display(),
        }
        for t in TeacherTransaction.objects.filter(
            employee=employee,
            transaction_type__in=(
                TeacherTransaction.Type.ADVANCE,
                TeacherTransaction.Type.ADVANCE_CLOSE,
            ),
        ).order_by("-created_at")[:500]
    ]
    monthly = {}
    for t in TeacherTransaction.objects.filter(employee=employee).only("amount", "transaction_type", "created_at"):
        key = (t.created_at.year, t.created_at.month)
        m = monthly.setdefault(key, {"received": Decimal('0.00'), "income": Decimal('0.00'), "count": 0})
        if t.transaction_type in (
            TeacherTransaction.Type.PAYOUT,
            TeacherTransaction.Type.ADVANCE,
            TeacherTransaction.Type.ADVANCE_CLOSE,
        ):
            m["received"] += t.amount
        elif t.transaction_type == TeacherTransaction.Type.INCOME:
            m["income"] += t.amount
        m["count"] += 1
    month_names = [
        "", "yanvar", "fevral", "mart", "aprel", "may", "iyun",
        "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr",
    ]
    monthly_summary = [
        {
            "year": y,
            "month": m,
            "month_display": f"{month_names[m]} {y}",
            "received": float(monthly[(y, m)]["received"]),
            "income": float(monthly[(y, m)]["income"]),
            "count": monthly[(y, m)]["count"],
        }
        for y, m in sorted(monthly.keys(), reverse=True)
    ]
    return {
        "salary_history": salary_history,
        "avans_history": avans_history,
        "monthly_summary": monthly_summary,
    }


@csrf_exempt
@_employee_login_required
def my_salary(request):
    """O'qituvchi o'z panelida oylik ma'lumotlarini ko'radi."""
    try:
        emp = request.user.employee_profile
    except Exception:
        return JsonResponse({"error": "Xodim topilmadi"}, status=404)
    data = _salary_stats(emp, include_transactions=True)
    data.update(_salary_history(emp))
    return JsonResponse({"salary": data})
