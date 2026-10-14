"""Coin tizimi uchun API (admin + o'qituvchi: session-auth; o'quvchi: token-auth)."""

import json
from datetime import date, datetime, timedelta
from functools import wraps

from django.contrib.auth.decorators import login_required
from django.db import models
from django.db.models import Q, Sum
from django.http import JsonResponse
from django.utils import timezone as tz
from django.views.decorators.csrf import csrf_exempt

from frontend.models import Employee, Group, Student
from frontend.permissions import has_permission, is_super_admin
from frontend.branch_scope import (
    allowed_branch_ids,
    get_current_branch,
    has_branch_access,
    scope_shop,
)
from frontend.student_api import student_required

from .models import (
    CoinAuditLog,
    CoinBalance,
    CoinConfig,
    CoinReason,
    CoinTransaction,
    ShopCategory,
    ShopOrder,
    ShopProduct,
    TeacherCoinLimit,
)
from .services import (
    CoinLimitError,
    CoinReasonInactiveError,
    InsufficientCoinsError,
    ProductUnavailableError,
    add_coin_manual,
    apply_teacher_coin,
    dashboard_stats,
    get_config,
    leaderboard,
    monthly_report,
    purchase_product,
    recompute_balance,
    student_balance,
    student_coin_summary,
    student_monthly_report,
    student_rank,
    teacher_allowed_daily,
    teacher_daily_used,
    tx_to_dict,
)


# ============================================================
# YORDAMCHILAR
# ============================================================

def _scope_shop(request, queryset, prefix=""):
    """Shop/coin yozuvlarini joriy/filial chegarasiga ko'ra filtrlash."""
    return scope_shop(request, queryset, prefix=prefix)


def _branch_id(request, data=None):
    """JSON body dagi `branch_id` (yoki joriy filial) — yangi yozuv uchun."""
    raw = ""
    if isinstance(data, dict):
        raw = str(data.get("branch_id") or "")
    raw = raw or str(request.GET.get("branch_id") or "")
    if raw.isdigit():
        return int(raw)
    current = get_current_branch(request)
    return current.pk if current is not None else None


def _has(user, codename):
    return is_super_admin(user) or has_permission(user, codename)


def _branch_ok(request, obj):
    """Obyekt boshqa filialga tegishli bo'lsa `False` (403).

    `branch` bo'sh (umumiy) yozuvlar hamma uchun ochiq — ular ro'yxatda ham
    ko'rinadi, shuning uchun tahrirlash ham mumkin.
    """
    branch = getattr(obj, "branch", None)
    if branch is None:
        return True
    if not has_branch_access(request.user, branch):
        return False
    current = get_current_branch(request)
    return current is None or current.pk == branch.pk


def _emp(request):
    try:
        return request.user.employee_profile
    except Exception:
        return None


def _is_admin(request):
    emp = _emp(request)
    return request.user.is_staff or (emp and emp.role and emp.role.name == "Administrator")


def _is_teacher(request):
    emp = _emp(request)
    return bool(emp and emp.role and emp.role.name in ("O'qituvchi", "Support Teacher"))


def _teacher_group_ids(emp):
    """O'qituvchiga tegishli guruhlar (teacher FK + sana bo'yicha biriktiruvalar)."""
    from frontend.models import GroupTeacherAssignment
    direct = Group.objects.filter(teacher=emp).distinct()
    today = tz.localdate()
    assigned = GroupTeacherAssignment.objects.filter(
        teacher=emp, start_date__lte=today
    ).filter(models.Q(end_date__isnull=True) | models.Q(end_date__gte=today))
    via_assignments = Group.objects.filter(pk__in=assigned.values("group_id")).distinct()
    return set(direct.values_list("id", flat=True)) | set(via_assignments.values_list("id", flat=True))


def coin_emp_required(view_func):
    @wraps(view_func)
    def wrapper(request, *args, **kwargs):
        if not request.user.is_authenticated:
            return JsonResponse({"error": "Avtorizatsiya talab qilinadi"}, status=401)
        return view_func(request, *args, **kwargs)
    return wrapper


def _fn(emp):
    return f"{emp.first_name} {emp.last_name}".strip() if emp else ""


def _parse_date(value):
    try:
        return date.fromisoformat(str(value))
    except (ValueError, TypeError):
        return None


def _student_filter(search):
    qs = Student.objects.select_related("user")
    search = (search or "").strip()
    if search:
        digits = "".join(c for c in search if c.isdigit())
        from django.db.models import Q
        qs = qs.filter(
            Q(first_name__icontains=search) |
            Q(last_name__icontains=search) |
            Q(phone__icontains=search) |
            (Q(phone__icontains=digits) if digits else Q())
        )
    return qs


def _can_give_bonus(request):
    if is_super_admin(request.user):
        return True
    if _is_admin(request):
        return _has(request.user, "coin.add")
    return True  # o'qituvchi bonus bera oladi (default)


def _can_give_penalty(request):
    if is_super_admin(request.user):
        return True
    return _has(request.user, "coin.remove")


# ============================================================
# DASHBOARD / SUMMARY
# ============================================================

@csrf_exempt
@coin_emp_required
def coin_summary(request):
    if not (_has(request.user, "coin.view") or _is_admin(request) or _is_teacher(request)):
        return JsonResponse({"error": "Ruxsat yo'q"}, status=403)
    data = dashboard_stats()
    if _is_teacher(request) and not _is_admin(request):
        data["teacher_daily_limit"] = teacher_allowed_daily(_emp(request))
        data["teacher_daily_used"] = teacher_daily_used(_emp(request))
    return JsonResponse(data)


# ============================================================
# SETTINGSLAR
# ============================================================

@csrf_exempt
@coin_emp_required
def coin_settings(request):
    if not _has(request.user, "coin.settings") and not is_super_admin(request.user):
        return JsonResponse({"error": "Ruxsat yo'q"}, status=403)
    config = get_config()
    if request.method == "POST":
        try:
            data = json.loads(request.body)
        except json.JSONDecodeError:
            return JsonResponse({"error": "Noto'g'ri format"}, status=400)
        for field, default in (
            ("attendance_present_amount", config.attendance_present_amount),
            ("attendance_absent_amount", config.attendance_absent_amount),
            ("attendance_excused_amount", config.attendance_excused_amount),
            ("teacher_daily_limit", config.teacher_daily_limit),
        ):
            if field in data:
                try:
                    setattr(config, field, int(data[field]))
                except (TypeError, ValueError):
                    pass
        for field in (
            "attendance_present_enabled",
            "attendance_absent_enabled",
            "attendance_excused_enabled",
            "leaderboard_enabled",
            "shop_enabled",
        ):
            if field in data:
                setattr(config, field, bool(data[field]))
        config.save()
        return JsonResponse({"success": True, "settings": {
            "attendance_present_amount": config.attendance_present_amount,
            "attendance_absent_amount": config.attendance_absent_amount,
            "attendance_excused_amount": config.attendance_excused_amount,
            "attendance_present_enabled": config.attendance_present_enabled,
            "attendance_absent_enabled": config.attendance_absent_enabled,
            "attendance_excused_enabled": config.attendance_excused_enabled,
            "teacher_daily_limit": config.teacher_daily_limit,
            "leaderboard_enabled": config.leaderboard_enabled,
            "shop_enabled": config.shop_enabled,
        }})
    return JsonResponse({"settings": {
        "attendance_present_amount": config.attendance_present_amount,
        "attendance_absent_amount": config.attendance_absent_amount,
        "attendance_excused_amount": config.attendance_excused_amount,
        "attendance_present_enabled": config.attendance_present_enabled,
        "attendance_absent_enabled": config.attendance_absent_enabled,
        "attendance_excused_enabled": config.attendance_excused_enabled,
        "teacher_daily_limit": config.teacher_daily_limit,
        "leaderboard_enabled": config.leaderboard_enabled,
        "shop_enabled": config.shop_enabled,
    }})


# O'qituvchi limiti (super admin / coin.manage_teacher)
@csrf_exempt
@coin_emp_required
def coin_teacher_limits(request, pk=None):
    if not (_has(request.user, "coin.manage_teacher") or is_super_admin(request.user)):
        return JsonResponse({"error": "Ruxsat yo'q"}, status=403)
    if request.method == "POST":
        if pk is None:
            return JsonResponse({"error": "Xodim id si kerak"}, status=400)
        employee = Employee.objects.filter(pk=pk).first()
        if not employee:
            return JsonResponse({"error": "Xodim topilmadi"}, status=404)
        try:
            data = json.loads(request.body)
        except json.JSONDecodeError:
            return JsonResponse({"error": "Noto'g'ri format"}, status=400)
        limit = TeacherCoinLimit.get_for(employee)
        if "daily_limit" in data:
            if data.get("daily_limit") in (None, "", "null"):
                limit.daily_limit = None
            else:
                try:
                    limit.daily_limit = int(data["daily_limit"])
                except (TypeError, ValueError):
                    return JsonResponse({"error": "Limit noto'g'ri"}, status=400)
        if "is_enabled" in data:
            limit.is_enabled = bool(data["is_enabled"])
        limit.save()
        return JsonResponse({"success": True, "limit": {
            "employee_id": employee.id,
            "teacher_name": _fn(employee),
            "daily_limit": limit.daily_limit,
            "is_enabled": limit.is_enabled,
        }})
    limits = []
    for employee in Employee.objects.filter(role__name="O'qituvchi", is_active=True):
        limit = TeacherCoinLimit.get_for(employee)
        limits.append({
            "employee_id": employee.id,
            "teacher_name": _fn(employee),
            "daily_limit": limit.daily_limit,
            "is_enabled": limit.is_enabled,
        })
    return JsonResponse({"limits": limits})


# ============================================================
# COIN SABABLARI
# ============================================================

@csrf_exempt
@coin_emp_required
def coin_reasons(request):
    if not (_has(request.user, "coin.view") or _is_teacher(request)):
        return JsonResponse({"error": "Ruxsat yo'q"}, status=403)
    show_all = request.GET.get("all") == "1" and _has(request.user, "coin.manage_reasons")
    reasons = _scope_shop(
        request,
        CoinReason.objects.all() if show_all else CoinReason.active.all(),
    )
    if request.method == "POST":
        if not _has(request.user, "coin.manage_reasons"):
            return JsonResponse({"error": "Ruxsat yo'q"}, status=403)
        try:
            data = json.loads(request.body)
        except json.JSONDecodeError:
            return JsonResponse({"error": "Noto'g'ri format"}, status=400)
        name = (data.get("name") or "").strip()
        reason_type = data.get("reason_type", "")
        if not name or reason_type not in ("BONUS", "PENALTY"):
            return JsonResponse({"error": "Nom va tur to'g'ri kiritilishi kerak"}, status=400)
        try:
            amount = int(data.get("amount", 0))
        except (TypeError, ValueError):
            return JsonResponse({"error": "Coin miqdori noto'g'ri"}, status=400)
        if reason_type == "PENALTY":
            amount = -abs(amount)
        else:
            amount = abs(amount)
        reason = CoinReason.objects.create(
            name=name, reason_type=reason_type, amount=amount, branch_id=_branch_id(request, data)
        )
        return JsonResponse({"success": True, "reason": {
            "id": reason.id, "name": reason.name, "reason_type": reason.reason_type,
            "amount": reason.amount, "is_active": reason.is_active,
        }})
    return JsonResponse({"reasons": [
        {
            "id": r.id, "name": r.name, "reason_type": r.reason_type,
            "amount": r.amount, "is_active": r.is_active,
        } for r in reasons
    ]})


@csrf_exempt
@coin_emp_required
def coin_reason_detail(request, pk):
    if request.method not in ("PUT", "POST"):
        return JsonResponse({"error": "Method not allowed"}, status=405)
    if not _has(request.user, "coin.manage_reasons"):
        return JsonResponse({"error": "Ruxsat yo'q"}, status=403)
    reason = CoinReason.objects.filter(pk=pk).first()
    if not reason:
        return JsonResponse({"error": "Sabab topilmadi"}, status=404)
    if not _branch_ok(request, reason):
        return JsonResponse({"error": "Ruxsat yo'q"}, status=403)
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({"error": "Noto'g'ri format"}, status=400)
    if data.get("name"):
        reason.name = str(data["name"]).strip()
    if data.get("reason_type") in ("BONUS", "PENALTY"):
        reason.reason_type = data["reason_type"]
    if "amount" in data:
        try:
            amount = int(data["amount"])
        except (TypeError, ValueError):
            return JsonResponse({"error": "Coin miqdori noto'g'ri"}, status=400)
        reason.amount = -abs(amount) if reason.reason_type == "PENALTY" else abs(amount)
    if "is_active" in data:
        reason.is_active = bool(data["is_active"])
    reason.save()
    return JsonResponse({"success": True, "reason": {
        "id": reason.id, "name": reason.name, "reason_type": reason.reason_type,
        "amount": reason.amount, "is_active": reason.is_active,
    }})


@csrf_exempt
@coin_emp_required
def coin_reason_toggle(request, pk):
    """Soft-delete: is_active ni False qiladi. Eski transactionlar o'zgarmaydi."""
    if request.method != "POST":
        return JsonResponse({"error": "POST talab qilinadi"}, status=405)
    if not _has(request.user, "coin.manage_reasons"):
        return JsonResponse({"error": "Ruxsat yo'q"}, status=403)
    reason = CoinReason.objects.filter(pk=pk).first()
    if not reason:
        return JsonResponse({"error": "Sabab topilmadi"}, status=404)
    if not _branch_ok(request, reason):
        return JsonResponse({"error": "Ruxsat yo'q"}, status=403)
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({"error": "Noto'g'ri format"}, status=400)
    reason.is_active = bool(data.get("is_active", False))
    reason.save(update_fields=["is_active"])
    return JsonResponse({"success": True, "is_active": reason.is_active})


# ============================================================
# TRANSAKSIYALAR / TARIX
# ============================================================

@csrf_exempt
@coin_emp_required
def coin_transactions(request):
    if not (_has(request.user, "coin.view_history") or _is_admin(request) or _is_teacher(request)):
        return JsonResponse({"error": "Ruxsat yo'q"}, status=403)
    qs = _scope_shop(
        request,
        CoinTransaction.objects.select_related("student"),
        prefix="student__",
    ).order_by("-created_at")
    today = tz.localdate()

    emp = _emp(request)
    is_teacher = _is_teacher(request) and not _is_admin(request)
    if is_teacher:
        group_ids = _teacher_group_ids(emp)
        qs = qs.filter(student__groups__id__in=group_ids).distinct()

    period = request.GET.get("period", "")
    start = _parse_date(request.GET.get("start"))
    end = _parse_date(request.GET.get("end"))
    if start or end:
        if start:
            qs = qs.filter(created_at__date__gte=start)
        if end:
            qs = qs.filter(created_at__date__lte=end)
    elif period == "today":
        qs = qs.filter(created_at__date=today)
    elif period == "yesterday":
        qs = qs.filter(created_at__date=today - timedelta(days=1))
    elif period == "week":
        qs = qs.filter(created_at__date__gte=today - timedelta(days=today.weekday()))
    elif period == "month":
        qs = qs.filter(created_at__date__gte=today.replace(day=1))

    tx_type = request.GET.get("type", "")
    if tx_type and tx_type in dict(CoinTransaction.Type.choices):
        qs = qs.filter(transaction_type=tx_type)

    source = request.GET.get("source", "")
    if source == "system":
        qs = qs.filter(created_by_employee__isnull=True, created_by_user__isnull=True)
    elif source == "teacher":
        qs = qs.filter(created_by_employee__isnull=False, created_by_employee__role__name="O'qituvchi")
    elif source == "administrator":
        qs = qs.filter(
            Q(created_by_employee__role__name__in=["Administrator", "Support Teacher"]) |
            Q(created_by_employee__isnull=False, created_by_employee__role__isnull=True)
        )

    student_id = request.GET.get("student_id")
    if student_id:
        qs = qs.filter(student_id=student_id)
    else:
        search = request.GET.get("search", "")
        if search:
            qs = qs.filter(student__in=_student_filter(search))

    limit = int(request.GET.get("limit", 100))
    offset = int(request.GET.get("offset", 0))
    total = qs.count()
    items = [tx_to_dict(t, request) for t in qs[offset:offset + limit]]
    return JsonResponse({"transactions": items, "total": total})


@csrf_exempt
@coin_emp_required
def coin_students(request):
    if not (_has(request.user, "coin.view") or _is_admin(request) or _is_teacher(request)):
        return JsonResponse({"error": "Ruxsat yo'q"}, status=403)
    search = request.GET.get("search", "")
    qs = _student_filter(search).order_by("first_name", "last_name")
    emp = _emp(request)
    if _is_teacher(request) and not _is_admin(request):
        group_ids = _teacher_group_ids(emp)
        qs = qs.filter(groups__id__in=group_ids).distinct()
    students = []
    for s in qs[:500]:
        summary = student_coin_summary(s)
        students.append({
            "student_id": s.id,
            "student_name": f"{s.first_name} {s.last_name}",
            "phone": s.phone,
            "balance": summary["balance"],
            "bonus": summary["bonus"],
            "penalty": summary["penalty"],
            "attendance": summary["attendance"],
            "shop": summary["shop"],
            "month_spent": summary["month_spent"],
        })
    students.sort(key=lambda x: x["balance"], reverse=True)
    return JsonResponse({"students": students, "count": len(students)})


@csrf_exempt
@coin_emp_required
def coin_student_detail(request, pk):
    student = Student.objects.filter(pk=pk).first()
    if not student:
        return JsonResponse({"error": "O'quvchi topilmadi"}, status=404)
    emp = _emp(request)
    is_teacher = _is_teacher(request) and not _is_admin(request)
    if is_teacher:
        own_groups = _teacher_group_ids(emp)
        if not student.groups.filter(id__in=own_groups).exists():
            return JsonResponse({"error": "Ruxsat yo'q"}, status=403)
    if not (_has(request.user, "coin.view_history") or _is_admin(request) or is_teacher):
        return JsonResponse({"error": "Ruxsat yo'q"}, status=403)
    summary = student_coin_summary(student)
    txs = CoinTransaction.objects.filter(student=student).order_by("-created_at")[:200]
    return JsonResponse({
        "student": {
            "student_id": student.id,
            "student_name": f"{student.first_name} {student.last_name}",
            "phone": student.phone,
        },
        "summary": summary,
        "transactions": [tx_to_dict(t, request) for t in txs],
    })


# ============================================================
# COIN BERISH (o'qituvchi / admin)
# ============================================================

@csrf_exempt
@coin_emp_required
def coin_give(request):
    """O'qituvchi/admin o'quvchiga reason asosida coin beradi / oladi."""
    if request.method != "POST":
        return JsonResponse({"error": "POST talab qilinadi"}, status=405)
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({"error": "Noto'g'ri format"}, status=400)
    student_id = data.get("student_id")
    reason_id = data.get("reason_id")
    description = (data.get("description") or "").strip()
    student = Student.objects.filter(pk=student_id).first()
    reason = CoinReason.objects.filter(pk=reason_id).first()
    if not student or not reason:
        return JsonResponse({"error": "O'quvchi yoki sabab topilmadi"}, status=404)
    emp = _emp(request)

    # Huquq tekshiruvi
    is_teacher = _is_teacher(request) and not _is_admin(request)
    if is_teacher:
        own_groups = _teacher_group_ids(emp)
        if not student.groups.filter(id__in=own_groups).exists():
            return JsonResponse({"error": "Bu o'quvchi sizning guruhingizga tegishli emas"}, status=403)
        if reason.amount < 0 and not _can_give_penalty(request):
            return JsonResponse({"error": "Penalty berish huquqi cheklangan"}, status=403)
    else:
        if reason.amount >= 0 and not _can_give_bonus(request):
            return JsonResponse({"error": "Bonus berish huquqi yo'q"}, status=403)
        if reason.amount < 0 and not _can_give_penalty(request):
            return JsonResponse({"error": "Penalty berish huquqi yo'q"}, status=403)

    try:
        tx = apply_teacher_coin(
            teacher=emp,
            student=student,
            reason=reason,
            description=description,
            created_by_user=request.user,
        )
    except CoinReasonInactiveError as e:
        return JsonResponse({"error": str(e)}, status=400)
    except CoinLimitError as e:
        return JsonResponse({"error": str(e)}, status=400)
    return JsonResponse({"success": True, "transaction": tx_to_dict(tx, request)})


@csrf_exempt
@coin_emp_required
def coin_adjust(request):
    """Manual adjustment — faqat super admin / manual_coin_adjustment huquqi."""
    if request.method != "POST":
        return JsonResponse({"error": "POST talab qilinadi"}, status=405)
    if not (_has(request.user, "coin.adjust") or is_super_admin(request.user)):
        return JsonResponse({"error": "Ruxsat yo'q"}, status=403)
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({"error": "Noto'g'ri format"}, status=400)
    student = Student.objects.filter(pk=data.get("student_id")).first()
    if not student:
        return JsonResponse({"error": "O'quvchi topilmadi"}, status=404)
    try:
        amount = int(data.get("amount", 0))
    except (TypeError, ValueError):
        return JsonResponse({"error": "Miqdor noto'g'ri"}, status=400)
    if amount == 0:
        return JsonResponse({"error": "Miqdor 0 bo'lishi mumkin emas"}, status=400)
    description = (data.get("description") or "").strip()
    tx = add_coin_manual(
        student=student,
        amount=amount,
        reason=None,
        description=description,
        created_by_user=request.user,
        created_by_employee=_emp(request),
    )
    return JsonResponse({"success": True, "transaction": tx_to_dict(tx, request)})


# ============================================================
# O'QITUVCHI FAOLIYATI
# ============================================================

@csrf_exempt
@coin_emp_required
def coin_teachers(request):
    if not (_has(request.user, "coin.view_history") or _is_admin(request)):
        return JsonResponse({"error": "Ruxsat yo'q"}, status=403)
    teacher_id = request.GET.get("teacher_id")
    txs = CoinTransaction.objects.select_related("student").filter(
        created_by_employee__isnull=False,
        transaction_type__in=["BONUS", "PENALTY"],
    ).order_by("-created_at")
    if teacher_id:
        txs = txs.filter(created_by_employee_id=teacher_id)
    items = []
    for t in txs[:500]:
        items.append(tx_to_dict(t, request))
    teachers = []
    for e in Employee.objects.filter(is_active=True, role__name="O'qituvchi").order_by("first_name"):
        given = CoinTransaction.objects.filter(
            created_by_employee=e, created_at__date=tz.localdate()
        ).aggregate(s=Sum("amount"))["s"] or 0
        teachers.append({
            "employee_id": e.id,
            "teacher_name": _fn(e),
            "today_given": given,
        })
    return JsonResponse({"transactions": items, "teachers": teachers})


@csrf_exempt
@coin_emp_required
def coin_my_transactions(request):
    """O'qituvchi o'zi bergan coinlar tarixi."""
    emp = _emp(request)
    if not _is_teacher(request) and not _is_admin(request):
        return JsonResponse({"error": "Ruxsat yo'q"}, status=403)
    txs = CoinTransaction.objects.filter(
        created_by_employee=emp, transaction_type__in=["BONUS", "PENALTY"]
    ).select_related("student").order_by("-created_at")[:200]
    items = [tx_to_dict(t, request) for t in txs]
    return JsonResponse({"transactions": items})


# ============================================================
# HISOBOTLAR / LEADERBOARD
# ============================================================

@csrf_exempt
@coin_emp_required
def coin_reports(request):
    if not (_has(request.user, "coin.reports") or is_super_admin(request.user)):
        return JsonResponse({"error": "Ruxsat yo'q"}, status=403)
    now = tz.localdate()
    year = int(request.GET.get("year", now.year))
    month = int(request.GET.get("month", now.month))
    report = monthly_report(year, month)
    return JsonResponse(report)


@csrf_exempt
@coin_emp_required
def coin_report_students(request):
    if not (_has(request.user, "coin.reports") or is_super_admin(request.user)):
        return JsonResponse({"error": "Ruxsat yo'q"}, status=403)
    now = tz.localdate()
    year = int(request.GET.get("year", now.year))
    month = int(request.GET.get("month", now.month))
    group_id = request.GET.get("group_id")
    search = request.GET.get("search", "")
    rows = student_monthly_report(year, month, group_id=group_id, search=search)
    return JsonResponse({"rows": rows, "count": len(rows)})


@csrf_exempt
@coin_emp_required
def coin_leaderboard(request):
    config = get_config()
    if not config.leaderboard_enabled and not is_super_admin(request.user):
        return JsonResponse({"error": "Leaderboard o'chirilgan"}, status=403)
    period = request.GET.get("period", "all")
    group_id = request.GET.get("group_id")
    limit = int(request.GET.get("limit", 50))
    items = leaderboard(period=period, limit=limit, group_id=group_id)
    return JsonResponse({"leaderboard": items, "enabled": config.leaderboard_enabled})


@csrf_exempt
@coin_emp_required
def coin_audit(request):
    if not (_has(request.user, "coin.view_history") or is_super_admin(request.user)):
        return JsonResponse({"error": "Ruxsat yo'q"}, status=403)
    logs = CoinAuditLog.objects.select_related("student").order_by("-created_at")[:200]
    items = [{
        "id": l.id,
        "student_name": f"{l.student.first_name} {l.student.last_name}" if l.student_id else "",
        "student_id": l.student_id,
        "action": l.action,
        "details": l.details,
        "actor_name": l.actor_name,
        "created_at": l.created_at.isoformat(),
    } for l in logs]
    return JsonResponse({"logs": items})


# ============================================================
# SHOP — ADMIN
# ============================================================

def _product_dict(p, request=None):
    image_url = None
    if p.image:
        image_url = p.image.url
        if request and image_url and not image_url.startswith("http"):
            image_url = request.build_absolute_uri(image_url)
    return {
        "id": p.id,
        "name": p.name,
        "description": p.description,
        "category_id": p.category_id,
        "category_name": p.category.name if p.category else "",
        "coin_price": p.coin_price,
        "stock": p.stock,
        "is_active": p.is_active,
        "is_visible": p.is_visible,
        "show_price": p.show_price,
        "image": image_url,
        "created_at": p.created_at.isoformat(),
    }


@csrf_exempt
@coin_emp_required
def shop_categories(request):
    if not _has(request.user, "shop.view"):
        return JsonResponse({"error": "Ruxsat yo'q"}, status=403)
    if request.method == "POST":
        if not _has(request.user, "shop.product_create"):
            return JsonResponse({"error": "Ruxsat yo'q"}, status=403)
        try:
            data = json.loads(request.body)
        except json.JSONDecodeError:
            return JsonResponse({"error": "Noto'g'ri format"}, status=400)
        name = (data.get("name") or "").strip()
        if not name:
            return JsonResponse({"error": "Nomi kiritilishi kerak"}, status=400)
        cat = ShopCategory.objects.create(name=name, branch_id=_branch_id(request, data))
        return JsonResponse({"success": True, "category": {"id": cat.id, "name": cat.name}})
    cats = _scope_shop(request, ShopCategory.objects.all()).order_by("name")
    return JsonResponse({"categories": [
        {
            "id": c.id, "name": c.name, "is_active": c.is_active,
            "products_count": c.products.filter(is_active=True).count(),
        } for c in cats
    ]})


@csrf_exempt
@coin_emp_required
def shop_category_toggle(request, pk):
    if request.method != "POST" or not _has(request.user, "shop.product_delete"):
        return JsonResponse({"error": "Ruxsat yo'q"}, status=403)
    cat = ShopCategory.objects.filter(pk=pk).first()
    if not cat:
        return JsonResponse({"error": "Kategoriya topilmadi"}, status=404)
    if not _branch_ok(request, cat):
        return JsonResponse({"error": "Ruxsat yo'q"}, status=403)
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({"error": "Noto'g'ri format"}, status=400)
    cat.is_active = bool(data.get("is_active", False))
    cat.save(update_fields=["is_active"])
    return JsonResponse({"success": True, "is_active": cat.is_active})


@csrf_exempt
@coin_emp_required
def shop_products(request):
    if not _has(request.user, "shop.view"):
        return JsonResponse({"error": "Ruxsat yo'q"}, status=403)
    if request.method == "POST":
        if not _has(request.user, "shop.product_create"):
            return JsonResponse({"error": "Ruxsat yo'q"}, status=403)
        # multipart/form-data (rasm bilan) yoki JSON bo'lishi mumkin
        data = None
        if request.content_type and request.content_type.startswith("application/json"):
            try:
                data = json.loads(request.body)
            except json.JSONDecodeError:
                return JsonResponse({"error": "Noto'g'ri format"}, status=400)
        else:
            data = {
                "name": request.POST.get("name"),
                "coin_price": request.POST.get("coin_price", 0),
                "stock": request.POST.get("stock", 0),
                "description": request.POST.get("description", ""),
                "is_active": request.POST.get("is_active", "1"),
                "category_id": request.POST.get("category_id"),
            }
        name = str(data.get("name") or "").strip()
        if not name:
            return JsonResponse({"error": "Mahsulot nomi kerak"}, status=400)
        try:
            price = int(data.get("coin_price") or 0)
            stock = int(data.get("stock") or 0)
        except (TypeError, ValueError):
            return JsonResponse({"error": "Narx/soni noto'g'ri"}, status=400)
        product = ShopProduct.objects.create(
            name=name,
            coin_price=max(price, 0),
            stock=max(stock, 0),
            description=str(data.get("description") or ""),
            is_active=str(data.get("is_active")) not in ("0", "False", "false"),
        )
        category_id = data.get("category_id")
        if category_id:
            cat = ShopCategory.objects.filter(pk=category_id).first()
            if cat:
                product.category = cat
        if request.FILES.get("image"):
            product.image = request.FILES["image"]
        product.save()
        from .services import publish_product_news
        publish_product_news(product, created_by=_fn(_emp(request)))
        return JsonResponse({"success": True, "product": _product_dict(product, request)})
    qs = _scope_shop(request, ShopProduct.objects.all()).order_by("-created_at")
    return JsonResponse({"products": [_product_dict(p, request) for p in qs]})


@csrf_exempt
@coin_emp_required
def shop_product_detail(request, pk):
    product = ShopProduct.objects.filter(pk=pk).first()
    if not product:
        return JsonResponse({"error": "Mahsulot topilmadi"}, status=404)
    if not _branch_ok(request, product):
        return JsonResponse({"error": "Ruxsat yo'q"}, status=403)
    if request.method == "PUT":
        if not _has(request.user, "shop.product_edit"):
            return JsonResponse({"error": "Ruxsat yo'q"}, status=403)
        try:
            data = json.loads(request.body)
        except json.JSONDecodeError:
            return JsonResponse({"error": "Noto'g'ri format"}, status=400)
        if data.get("name"):
            product.name = str(data["name"]).strip()
        if "description" in data:
            product.description = data.get("description", "")
        if "coin_price" in data:
            try:
                product.coin_price = max(int(data["coin_price"]), 0)
            except (TypeError, ValueError):
                return JsonResponse({"error": "Narx noto'g'ri"}, status=400)
        if "stock" in data:
            try:
                product.stock = max(int(data["stock"]), 0)
            except (TypeError, ValueError):
                return JsonResponse({"error": "Qoldiq noto'g'ri"}, status=400)
        if "is_active" in data:
            product.set_state("sale" if bool(data["is_active"]) else product.state)
        if "is_visible" in data:
            product.is_visible = bool(data["is_visible"])
            if not product.is_visible:
                product.is_active = False
        if "show_price" in data:
            product.show_price = bool(data["show_price"])
        category_id = data.get("category_id")
        if category_id:
            cat = ShopCategory.objects.filter(pk=category_id).first()
            product.category = cat
        elif "category_id" in data and not category_id:
            product.category = None
        product.save()
        return JsonResponse({"success": True, "product": _product_dict(product, request)})
    if request.method == "POST" and request.GET.get("action") == "toggle":
        if not _has(request.user, "shop.product_delete"):
            return JsonResponse({"error": "Ruxsat yo'q"}, status=403)
        try:
            data = json.loads(request.body)
        except json.JSONDecodeError:
            return JsonResponse({"error": "Noto'g'ri format"}, status=400)
        product.is_active = bool(data.get("is_active", False))
        if not product.is_active:
            product.is_visible = False
        else:
            product.is_visible = True
        product.save(update_fields=["is_active", "is_visible"])
        return JsonResponse({"success": True, "is_active": product.is_active})
    return JsonResponse({"product": _product_dict(product, request)})


def _order_dict(o, request=None):
    return {
        "id": o.id,
        "student_id": o.student_id,
        "student_name": f"{o.student.first_name} {o.student.last_name}" if o.student_id else "",
        "product_id": o.product_id,
        "product_name": o.product_name,
        "product_price": o.product_price,
        "quantity": o.quantity,
        "total": o.product_price * o.quantity,
        "status": o.status,
        "status_display": o.get_status_display(),
        "created_by": o.created_by,
        "given_at": o.given_at.isoformat() if o.given_at else None,
        "created_at": o.created_at.isoformat(),
    }


@csrf_exempt
@coin_emp_required
def shop_orders(request):
    if not _has(request.user, "shop.view"):
        return JsonResponse({"error": "Ruxsat yo'q"}, status=403)
    qs = _scope_shop(
        request,
        ShopOrder.objects.select_related("student", "product"),
        prefix="student__",
    ).order_by("-created_at")
    status = request.GET.get("status", "")
    if status in dict(ShopOrder.Status.choices):
        qs = qs.filter(status=status)
    search = request.GET.get("search", "")
    if search:
        qs = qs.filter(student__in=_student_filter(search))
    items = [_order_dict(o, request) for o in qs[:300]]
    return JsonResponse({"orders": items})


@csrf_exempt
@coin_emp_required
def shop_order_status(request, pk):
    if request.method != "POST":
        return JsonResponse({"error": "POST talab qilinadi"}, status=405)
    if not _has(request.user, "shop.order_approve"):
        return JsonResponse({"error": "Ruxsat yo'q"}, status=403)
    order = ShopOrder.objects.filter(pk=pk).first()
    if not order:
        return JsonResponse({"error": "Order topilmadi"}, status=404)
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({"error": "Noto'g'ri format"}, status=400)
    new_status = data.get("status", "")
    if new_status not in dict(ShopOrder.Status.choices):
        return JsonResponse({"error": "Noto'g'ri holat"}, status=400)
    # Holat o'zgarishi + bekor qilinsa coin REVERSAL va stock tiklash (services orqali)
    from .services import set_order_status
    set_order_status(
        order=order,
        new_status=new_status,
        created_by=_fn(_emp(request)),
        created_by_user=request.user,
        created_by_employee=_emp(request),
    )
    return JsonResponse({"success": True, "order": _order_dict(order, request)})


# ============================================================
# O'QUVCHI API (token)
# ============================================================

@csrf_exempt
@student_required
def student_coin_summary_api(request):
    student = request.student
    summary = student_coin_summary(student)
    return JsonResponse({"summary": summary})


@csrf_exempt
@student_required
def student_coin_history_api(request):
    student = request.student
    txs = CoinTransaction.objects.filter(student=student).order_by("-created_at")[:200]
    return JsonResponse({"transactions": [tx_to_dict(t, request) for t in txs]})


@csrf_exempt
@student_required
def student_shop_products(request):
    config = get_config()
    products = ShopProduct.objects.filter(is_visible=True)
    student = getattr(request, "student", None)
    if student is not None and student.branch_id:
        # O'quvchi faqat o'z filialining mahsulotlarini + barcha filiallar uchunlarni ko'radi
        products = products.filter(Q(branch__isnull=True) | Q(branch_id=student.branch_id))
    products = products.order_by("category_id", "name")
    return JsonResponse({
        "products": [_product_dict(p, request) for p in products],
        "balance": student_balance(request.student),
        "shop_enabled": config.shop_enabled,
    })


@csrf_exempt
@student_required
def student_shop_buy(request):
    if request.method != "POST":
        return JsonResponse({"error": "POST talab qilinadi"}, status=405)
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({"error": "Noto'g'ri format"}, status=400)
    product = ShopProduct.objects.filter(pk=data.get("product_id")).first()
    if not product:
        return JsonResponse({"error": "Mahsulot topilmadi"}, status=404)
    quantity = int(data.get("quantity", 1) or 1)
    if quantity < 1:
        quantity = 1
    try:
        order, tx = purchase_product(
            student=request.student,
            product=product,
            quantity=quantity,
            created_by=request.student.phone,
            idempotency_key=str(data.get("request_id") or "") or None,
        )
    except InsufficientCoinsError as e:
        return JsonResponse({"error": str(e)}, status=400)
    except ProductUnavailableError as e:
        return JsonResponse({"error": str(e)}, status=400)
    return JsonResponse({"success": True, "order": _order_dict(order, request)})


@csrf_exempt
@student_required
def student_shop_orders(request):
    orders = ShopOrder.objects.filter(student=request.student).select_related("product").order_by("-created_at")[:100]
    return JsonResponse({"orders": [_order_dict(o, request) for o in orders]})


@csrf_exempt
@student_required
def student_leaderboard(request):
    config = get_config()
    if not config.leaderboard_enabled:
        return JsonResponse({"error": "Leaderboard o'chirilgan"}, status=403)
    period = request.GET.get("period", "all")
    group_id = request.GET.get("group_id")
    if group_id:
        try:
            group_id = int(group_id)
        except (TypeError, ValueError):
            group_id = None
        if group_id and not request.student.groups.filter(id=group_id).exists():
            group_id = None
    items = leaderboard(period=period, limit=20, group_id=group_id)
    rank, score = student_rank(request.student, period=period, group_id=group_id)
    return JsonResponse({"leaderboard": items, "my_rank": rank, "my_score": score})