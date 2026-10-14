"""Coin tizimining asosiy business logic'ini markazlashtiruvchi xizmat moduli.

Barcha coin o'zgarishlari faqat shu modul orqali amalga oshiriladi:
  - add_coin / remove_coin
  - apply_teacher_coin
  - process_attendance_coin
  - reverse_transaction
  - purchase_product
  - hisobotlar, leaderboard, statistikalar

Qoida: hech qanday coin harakati tarixsiz amalga oshmaydi. CoinTransaction
hech qachon hard-delete qilinmaydi — xato bo'lsa REVERSAL yaratiladi.
Coin sababi (CoinReason) o'chirilsa ham tarix snapshot (reason_name) orqali saqlanadi.
"""

from __future__ import annotations

from datetime import date
from decimal import Decimal

from django.db import transaction
from django.db.models import Q, Sum
from django.utils import timezone as tz
from django.utils import timezone

from .models import (
    CoinAuditLog,
    CoinBalance,
    CoinConfig,
    CoinNotification,
    CoinReason,
    CoinTransaction,
    ShopOrder,
    ShopProduct,
    TeacherCoinLimit,
)

# Transaksiya turlari bo'yicha gunoh-guruhlash uchun yordamchi to'plamlar
BONUS_TYPES = ("BONUS", "ATTENDANCE")
PENALTY_TYPES = ("PENALTY",)


# ============================================================
# KONFIG
# ============================================================

def get_config() -> CoinConfig:
    return CoinConfig.get_instance()


# ============================================================
# BALANS
# ============================================================

def get_or_create_balance(student) -> CoinBalance:
    obj, _ = CoinBalance.objects.get_or_create(student=student, defaults={"balance": 0})
    return obj


def recompute_balance(student) -> int:
    """Balansni CoinTransactionlar summasidan qayta hisoblaydi (asosiy manba)."""
    total = CoinTransaction.objects.filter(student=student).aggregate(s=Sum("amount"))["s"] or 0
    balance, _ = CoinBalance.objects.get_or_create(student=student, defaults={"balance": total})
    balance.balance = total
    balance.save(update_fields=["balance", "updated_at"])
    return total


def student_balance(student) -> int:
    try:
        return student.coin_balance.balance
    except CoinBalance.DoesNotExist:
        return 0


# ============================================================
# AUDIT + BILDIRISHNOMA
# ============================================================

def _audit(*, action, student=None, coin_transaction=None, actor_user=None, actor_name="", details=""):
    try:
        CoinAuditLog.objects.create(
            student=student,
            action=action,
            coin_transaction=coin_transaction,
            actor_user=actor_user,
            actor_name=actor_name,
            details=details,
        )
    except Exception:
        pass  # audit log hech qachon asosiy oqimni buzmasligi kerak


def _notify(student, text, kind="", coin_transaction=None):
    try:
        CoinNotification.objects.create(
            student=student, text=text, kind=kind, transaction=coin_transaction
        )
    except Exception:
        pass
    try:
        telegram_chat_id = getattr(student, "telegram_chat_id", "") or ""
        if telegram_chat_id:
            from frontend import student_api
            student_api.send_telegram_message(str(telegram_chat_id), text)
    except Exception:
        pass


def _notify_for_tx(tx: CoinTransaction):
    amount = tx.amount
    if tx.transaction_type == CoinTransaction.Type.SHOP:
        text = (f"🛍️ {abs(amount)} Coin sarflandi.\n"
                f"Mahsulot: {tx.reason_name or 'Shop xaridi'}")
        _notify(tx.student, text, "shop", tx)
    elif amount > 0:
        sabab = tx.reason_name or "Bonus"
        text = f"🎉 Sizga {amount} Coin berildi!\nSabab: {sabab}."
        _notify(tx.student, text, "bonus", tx)
    else:
        sabab = tx.reason_name or "Penalty"
        text = f"⚠️ Sizdan {abs(amount)} Coin olib tashlandi.\nSabab: {sabab}."
        _notify(tx.student, text, "penalty", tx)


# ============================================================
# TRANSAKSIYA YARATISH (yagona asosiy funksiya)
# ============================================================

def create_transaction(
    *,
    student,
    amount,
    transaction_type,
    reason=None,
    reason_name="",
    description="",
    created_by="",
    created_by_user=None,
    created_by_employee=None,
    attendance=None,
    group=None,
    group_name="",
    shop_order=None,
    reversal_of=None,
    idempotency_key=None,
    attendance_status="",
    notify=True,
    audit=True,
):
    """CoinTransaction yaratadi va balansni atomik yangilaydi.

    - Bir xil idempotency_key bilan takror chaqiruv o'sha tranzaksiyani qaytaradi (dublikatdan himoya).
    - Ko'rsatilgan amount balansga qo'shiladi (manfiy — ayriladi).
    """
    if idempotency_key:
        existing = CoinTransaction.objects.filter(idempotency_key=idempotency_key).first()
        if existing:
            return existing

    if reason is not None:
        reason_name = reason_name or reason.name
    if not group_name and group is not None:
        group_name = group.name if hasattr(group, "name") else str(group)
    if not created_by:
        if created_by_employee is not None:
            created_by = f"{created_by_employee.first_name} {created_by_employee.last_name}".strip()
        elif created_by_user is not None:
            created_by = created_by_user.get_full_name() or created_by_user.username

    with transaction.atomic():
        tx = CoinTransaction.objects.create(
            student=student,
            group=group,
            group_name=group_name,
            amount=amount,
            transaction_type=transaction_type,
            reason=reason,
            reason_name=reason_name,
            reason_amount=reason.amount if reason else None,
            description=description,
            created_by=created_by,
            created_by_user=created_by_user,
            created_by_employee=created_by_employee,
            attendance=attendance,
            attendance_status=attendance_status,
            shop_order=shop_order,
            reversal_of=reversal_of,
            idempotency_key=idempotency_key,
        )
        balance, _ = CoinBalance.objects.select_for_update().get_or_create(
            student=student, defaults={"balance": 0}
        )
        balance.balance += amount
        balance.save(update_fields=["balance", "updated_at"])

    if notify:
        _notify_for_tx(tx)
    if audit:
        actor_name = created_by or "System"
        action = {
            CoinTransaction.Type.BONUS: "coin.give",
            CoinTransaction.Type.PENALTY: "coin.give",
            CoinTransaction.Type.ADJUSTMENT: "coin.adjust",
            CoinTransaction.Type.SHOP: "shop.purchase",
            CoinTransaction.Type.REVERSAL: "coin.reversal",
            CoinTransaction.Type.ATTENDANCE: "attendance.coin",
        }.get(tx.transaction_type, "coin.tx")
        if transaction_type != CoinTransaction.Type.ATTENDANCE or created_by_user is not None:
            _audit(
                action=action,
                student=student,
                coin_transaction=tx,
                actor_user=created_by_user,
                actor_name=actor_name,
                details=f"{reason_name} ({tx.amount:+})",
            )
    return tx


def reverse_transaction(tx: CoinTransaction, *, description="", created_by="", created_by_user=None, created_by_employee=None):
    """CoinTransactionni o'chirmasdan REVERSAL yaratadi (xato tuzatish usuli).

    Asl tranzaksiya 'reversed' holatiga o'tadi, lekin tarixda qoladi.
    """
    if tx.status == CoinTransaction.Status.REVERSED:
        return CoinTransaction.objects.filter(reversal_of=tx).first()
    reversal = create_transaction(
        student=tx.student,
        amount=-tx.amount,
        transaction_type=CoinTransaction.Type.REVERSAL,
        reason=None,
        reason_name=tx.reason_name,
        description=description or f"{tx.reason_name} qaytarildi",
        created_by=created_by,
        created_by_user=created_by_user,
        created_by_employee=created_by_employee,
        group=tx.group,
        attendance=tx.attendance,
        shop_order=tx.shop_order,
        reversal_of=tx,
        idempotency_key=f"rev:{tx.id}",
    )
    tx.mark_reversed()
    return reversal


# ============================================================
# QO'LD BERISH / MANUAL ADJUSTMENT
# ============================================================

def add_coin_manual(*, student, amount, reason=None, description="", created_by_user=None, created_by_employee=None):
    """Manual adjustment (faqat super admin yoki manual_coin_adjustment huquqi)."""
    return create_transaction(
        student=student,
        amount=int(amount),
        transaction_type=CoinTransaction.Type.ADJUSTMENT,
        reason=reason,
        reason_name=f"Tuzatish: {reason.name}" if reason else "Manual adjustment",
        description=description,
        created_by_user=created_by_user,
        created_by_employee=created_by_employee,
    )


# ============================================================
# O'QITUVCHI COIN BERISHI
# ============================================================

class CoinLimitError(Exception):
    pass


class CoinReasonInactiveError(Exception):
    pass


def teacher_daily_used(teacher, day=None) -> int:
    day = day or tz.localdate()
    used = CoinTransaction.objects.filter(
        created_by_employee=teacher,
        transaction_type__in=[CoinTransaction.Type.BONUS, CoinTransaction.Type.PENALTY],
        created_at__date=day,
    ).aggregate(s=Sum("amount"))["s"] or 0
    return used


def teacher_allowed_daily(teacher) -> int:
    limit = TeacherCoinLimit.get_for(teacher)
    if not limit.is_enabled:
        return None  # cheklov yo'q
    if limit.daily_limit is not None:
        return limit.daily_limit
    return get_config().teacher_daily_limit


def apply_teacher_coin(*, teacher, student, reason, description="", created_by_user=None):
    """O'qituvchi o'z o'quvchisiga reason asosida coin bera oladi.

    - reason faol bo'lishi shart;
    - o'qituvchi kunlik limiti tekshiriladi;
    - to'g'ridan-to'g'ri balans tahrirlash yo'q — faqat reason orqali.
    """
    if not reason.is_active:
        raise CoinReasonInactiveError("Inaktiv sababdan foydalanish mumkin emas")
    amount = reason.amount
    allowed = teacher_allowed_daily(teacher)
    if allowed is not None:
        used = teacher_daily_used(teacher)
        # originallar yig'indisi (penalty manfiy, abs olib hisoblanadi)
        used_abs = abs(used) if used is not None else 0
        if abs(used_abs) + abs(amount) > allowed:
            raise CoinLimitError(
                f"Kunlik limit tugadi ({allowed} Coin). Hozirgi ishlatilgan: {abs(used_abs)} Coin."
            )
    tx_type = CoinTransaction.Type.BONUS if amount > 0 else CoinTransaction.Type.PENALTY
    return create_transaction(
        student=student,
        amount=amount,
        transaction_type=tx_type,
        reason=reason,
        description=description,
        created_by_user=created_by_user,
        created_by_employee=teacher,
    )


# ============================================================
# DAVOMAT BILAN BOG'LASH (avtomatik)
# ============================================================

ATTENDANCE_REASON_NAMES = {
    "present": "Darsga qatnashgani uchun",
    "absent": "Darsga kelmagani uchun",
    "excused": "Sababli darsga kelmagan",
}


def _attendance_spec(attendance):
    config = get_config()
    status = attendance.status
    if status == "present":
        return {
            "amount": config.attendance_present_amount,
            "enabled": config.attendance_present_enabled,
            "reason_name": ATTENDANCE_REASON_NAMES["present"],
        }
    if status == "absent":
        return {
            "amount": config.attendance_absent_amount,
            "enabled": config.attendance_absent_enabled,
            "reason_name": ATTENDANCE_REASON_NAMES["absent"],
        }
    return {
        "amount": config.attendance_excused_amount,
        "enabled": config.attendance_excused_enabled,
        "reason_name": ATTENDANCE_REASON_NAMES["excused"],
    }


def process_attendance_coin(attendance, old_status=None):
    """Yagona va idempotent davomat-coin sinhroni.

    Qoida:
      - KELDI (present)  -> +5
      - KELMADI (absent) -> -20
      - SABABLI          -> 0 (default; konfig orqali o'zgarishi mumkin)
      - O'zgarish bo'lsa oldingi active coin REVERSAL qilinadi, keyingi yangi status bo'yicha
        avtomatik coin yaratiladi. Oldingi transaction o'chirilmaydi.
    """
    try:
        if attendance is None or attendance.student_id is None:
            return None
        new_status = attendance.status
        if old_status == new_status:
            return None

        spec = _attendance_spec(attendance)
        student = attendance.student

        created = []
        with transaction.atomic():
            active_txs = list(
                CoinTransaction.objects.filter(
                    attendance=attendance,
                    transaction_type=CoinTransaction.Type.ATTENDANCE,
                    status=CoinTransaction.Status.ACTIVE,
                ).select_for_update()
            )
            for tx in active_txs:
                reverse_transaction(
                    tx,
                    description="Davomat o'zgarganligi sabab avvalgi coin qaytarildi",
                    created_by="System",
                )
            if spec["enabled"] and spec["amount"] != 0:
                created.append(
                    create_transaction(
                        student=student,
                        amount=spec["amount"],
                        transaction_type=CoinTransaction.Type.ATTENDANCE,
                        reason=None,
                        reason_name=spec["reason_name"],
                        description=f"Davomat: {attendance.get_status_display()}",
                        created_by="System",
                        attendance=attendance,
                        attendance_status=new_status,
                        group=attendance.group,
                        idempotency_key=f"att:{attendance.id}",
                        audit=False,
                    )
                )
        return created
    except Exception:
        # Davomat oqimini hech qachon buzmaslik kerak
        return None


# ============================================================
# SHOP
# ============================================================

class InsufficientCoinsError(Exception):
    pass


class ProductUnavailableError(Exception):
    pass


@transaction.atomic
def purchase_product(*, student, product: ShopProduct, quantity: int = 1, created_by="", idempotency_key=None):
    """O'quvchi mahsulotni coin bilan sotib oladi (atomic).

    - Balans yetarli bo'lmasa xato — order yaratilmaydi, coin yechilmaydi.
    - select_for_update orqali ikki marta bosish/xarid dublikatidan himoya.
    """
    if idempotency_key:
        existing_shop_tx = CoinTransaction.objects.filter(
            idempotency_key=idempotency_key, transaction_type=CoinTransaction.Type.SHOP
        ).first()
        if existing_shop_tx and existing_shop_tx.shop_order_id:
            return existing_shop_tx.shop_order, existing_shop_tx

    config = get_config()
    if not config.shop_enabled:
        raise ProductUnavailableError("Shop vaqtincha yoqilmagan")
    if not product.is_visible or not product.is_active:
        raise ProductUnavailableError("Mahsulot sotuvda yo'q")
    if quantity < 1:
        raise ProductUnavailableError("Soni noto'g'ri")

    product = ShopProduct.objects.select_for_update().get(pk=product.pk)
    if product.stock < quantity:
        raise ProductUnavailableError("Qoldiq yetarli emas")

    balance, _ = CoinBalance.objects.select_for_update().get_or_create(
        student=student, defaults={"balance": 0}
    )
    total = product.coin_price * quantity
    if balance.balance < total:
        raise InsufficientCoinsError("Sizda yetarli Coin mavjud emas.")

    order = ShopOrder.objects.create(
        student=student,
        product=product,
        product_name=product.name,
        product_price=product.coin_price,
        quantity=quantity,
        created_by=created_by,
    )
    product.stock -= quantity
    product.save(update_fields=["stock"])

    tx = create_transaction(
        student=student,
        amount=-total,
        transaction_type=CoinTransaction.Type.SHOP,
        reason=None,
        reason_name=f"Shop — {product.name} sotib olindi",
        description=f"Order #{order.id} — {product.name} x {quantity}",
        created_by=created_by,
        shop_order=order,
        idempotency_key=idempotency_key or f"shop:{order.id}",
    )
    return order, tx


@transaction.atomic
def set_order_status(
    *,
    order: ShopOrder,
    new_status: str,
    created_by="",
    created_by_user=None,
    created_by_employee=None,
):
    """Shop order holatini o'zgartiradi.

    Bekor qilinsa (cancelled): coin REVERSAL orqali qaytariladi va stock tiklanadi.
    Berilgan bo'lsa (given): given_at belgilanadi.
    """
    if new_status not in dict(ShopOrder.Status.choices):
        raise ValueError("Noto'g'ri holat")

    old_status = order.status
    if old_status == new_status:
        return order

    order.status = new_status
    if new_status == ShopOrder.Status.GIVEN:
        order.given_at = timezone.now()
    order.save()

    if new_status == ShopOrder.Status.CANCELLED and old_status != ShopOrder.Status.CANCELLED:
        shop_tx = (
            CoinTransaction.objects.filter(
                shop_order=order, transaction_type=CoinTransaction.Type.SHOP
            )
            .order_by("id")
            .first()
        )
        if shop_tx and shop_tx.status == CoinTransaction.Status.ACTIVE:
            reverse_transaction(
                shop_tx,
                description="Order bekor qilingani uchun coin qaytarildi",
                created_by=created_by,
                created_by_user=created_by_user,
                created_by_employee=created_by_employee,
            )
        if order.product_id:
            product = ShopProduct.objects.select_for_update().filter(pk=order.product_id).first()
            if product:
                product.stock += order.quantity
                product.save(update_fields=["stock"])
    return order


def publish_product_news(product, created_by=""):
    """Yangi mahsulot qo'shilganda o'quvchilar ilovasidagi «Barcha Yangiliklar»ga e'lon chiqaradi.

    Faqat o'quvchiga ko'rinadigan (is_visible) mahsulot uchun yaratiladi —
    «Kutayotgan» (draft) mahsulotlar e'lon qilinmaydi.
    """
    if not product.pk or not product.is_visible:
        return None
    from frontend.models import News

    prefix = f"Yangi mahsulot qo'shildi: {product.name}"[:255]
    if News.objects.filter(title__startswith=prefix).exists():
        return None
    body = (product.description or "").strip()
    detail = [f"Narxi: {product.coin_price} coin"]
    if product.stock is not None:
        detail.append(f"Qoldiq: {product.stock} ta")
    body = "\n".join(part for part in (body, ", ".join(detail)) if part)
    return News.objects.create(
        title=prefix,
        body=body,
        category="yangilik",
        audience="barcha",
        is_published=True,
        created_by=created_by or "",
    )


# ============================================================
# HISOBOTLAR / STATISTIKA
# ============================================================

def _month_range(year: int, month: int):
    import calendar as _cal
    last = _cal.monthrange(year, month)[1]
    return date(year, month, 1), date(year, month, last)


def monthly_report(year: int, month: int):
    start, end = _month_range(year, month)
    qs = CoinTransaction.objects.filter(created_at__date__gte=start, created_at__date__lte=end)
    bonus = qs.filter(transaction_type=CoinTransaction.Type.BONUS).aggregate(s=Sum("amount"))["s"] or 0
    penalty = qs.filter(transaction_type=CoinTransaction.Type.PENALTY).aggregate(s=Sum("amount"))["s"] or 0
    attendance = qs.filter(transaction_type=CoinTransaction.Type.ATTENDANCE).aggregate(s=Sum("amount"))["s"] or 0
    shop = qs.filter(transaction_type=CoinTransaction.Type.SHOP).aggregate(s=Sum("amount"))["s"] or 0
    adjustment = qs.filter(transaction_type=CoinTransaction.Type.ADJUSTMENT).aggregate(s=Sum("amount"))["s"] or 0
    total_students = qs.values("student").distinct().count()
    active_students = qs.filter(~Q(amount=0)).values("student").distinct().count()
    return {
        "year": year,
        "month": month,
        "bonus": bonus,
        "penalty": penalty,
        "attendance": attendance,
        "shop": shop,
        "adjustment": adjustment,
        "total_students": total_students,
        "active_students": active_students,
        "net": bonus + attendance + penalty + shop + adjustment,
    }


def student_monthly_report(year: int, month: int, student_id=None, group_id=None, teacher_id=None, search=""):
    start, end = _month_range(year, month)
    qs = CoinTransaction.objects.filter(created_at__date__gte=start, created_at__date__lte=end)
    rows = []
    qs = qs.order_by("student_id")
    for student_id_val, s_queryset in _groupby_student(qs):
        student = s_queryset[0].student
        if student_id and student.id != student_id:
            continue
        if group_id and student.id not in _student_ids_in_group(group_id):
            continue
        if search and search.lower() not in f"{student.first_name} {student.last_name}".lower():
            continue
        bonus = sum(t.amount for t in s_queryset if t.transaction_type == CoinTransaction.Type.BONUS)
        penalty = sum(t.amount for t in s_queryset if t.transaction_type == CoinTransaction.Type.PENALTY)
        attendance = sum(t.amount for t in s_queryset if t.transaction_type == CoinTransaction.Type.ATTENDANCE)
        shop = sum(t.amount for t in s_queryset if t.transaction_type == CoinTransaction.Type.SHOP)
        adjustment = sum(t.amount for t in s_queryset if t.transaction_type == CoinTransaction.Type.ADJUSTMENT)
        rows.append({
            "student_id": student.id,
            "student_name": f"{student.first_name} {student.last_name}",
            "phone": student.phone,
            "bonus": bonus,
            "penalty": penalty,
            "attendance": attendance,
            "shop": shop,
            "adjustment": adjustment,
            "month_delta": bonus + attendance + penalty + shop + adjustment,
            "balance": student_balance(student),
        })
    rows.sort(key=lambda r: r["month_delta"], reverse=True)
    return rows


def _groupby_student(qs):
    """qs ni student bo'yicha guruhlaydi (connecting_rows uchun oddiy yondashuv)."""
    groups = {}
    for t in qs.select_related("student", "group"):
        groups.setdefault(t.student_id, []).append(t)
    return groups.items()


def _student_ids_in_group(group_id):
    from frontend.models import Student
    return set(Student.objects.filter(groups__id=group_id).values_list("id", flat=True))


def _scope_scores(period="all", group_id=None):
    """Scope'dagi BARCHA o'quvchilar uchun ballar (koin yo'q bo'lsa 0).

    period: all (umumiy balans) yoki monthly (shu oy yig'indisi).
    """
    from frontend.models import Student
    qs = Student.objects.filter(is_active=True, is_deleted=False)
    if group_id:
        ids = _student_ids_in_group(group_id)
        qs = qs.filter(id__in=ids)
    student_ids = list(qs.values_list("id", flat=True))
    if period == "monthly":
        today = tz.localdate()
        start, end = _month_range(today.year, today.month)
        sums = {}
        for t in CoinTransaction.objects.filter(created_at__date__gte=start, created_at__date__lte=end):
            sums[t.student_id] = sums.get(t.student_id, 0) + t.amount
        return {sid: sums.get(sid, 0) for sid in student_ids}
    balances = {b.student_id: b.balance for b in CoinBalance.objects.all()}
    return {sid: balances.get(sid, 0) for sid in student_ids}


def leaderboard(period="all", limit=50, group_id=None):
    """period: all (umumiy balans) yoki monthly (shu oy yig'indisi)."""
    scores = _scope_scores(period, group_id)
    items = sorted(scores.items(), key=lambda kv: (-kv[1], kv[0]))[:limit]
    from frontend.models import Student
    students = {
        s.id: s for s in Student.objects.filter(id__in=[k for k, _ in items])
    }
    result = []
    for rank, (sid, score) in enumerate(items, start=1):
        s = students.get(sid)
        if s is None:
            continue
        result.append({
            "rank": rank,
            "student_id": sid,
            "student_name": f"{s.first_name} {s.last_name}",
            "phone": s.phone,
            "score": score,
        })
    return result


def student_rank(student, period="all", group_id=None):
    """Talabaning berilgan scope'dagi o'rni (1-based) va balans koinlari."""
    scores = _scope_scores(period, group_id)
    mine = scores.get(student.id)
    if mine is None:
        return None, 0
    rank = 1 + sum(1 for v in scores.values() if v > mine)
    return rank, mine


def dashboard_stats():
    config = get_config()
    today = tz.localdate()
    qs = CoinTransaction.objects.filter(created_at__date=today)
    total_balance = CoinBalance.objects.aggregate(s=Sum("balance"))["s"] or 0
    today_given = (
        qs.filter(amount__gt=0, transaction_type__in=[CoinTransaction.Type.BONUS, CoinTransaction.Type.ATTENDANCE])
        .aggregate(s=Sum("amount"))["s"] or 0
    )
    today_penalty = (
        qs.filter(transaction_type=CoinTransaction.Type.PENALTY).aggregate(s=Sum("amount"))["s"] or 0
    )
    today_shop = qs.filter(transaction_type=CoinTransaction.Type.SHOP).aggregate(s=Sum("amount"))["s"] or 0
    today_students = qs.filter(amount__gt=0).values("student").distinct().count()
    today_shop_students = qs.filter(transaction_type=CoinTransaction.Type.SHOP).values("student").distinct().count()
    return {
        "total_balance": total_balance,
        "today_given": today_given,
        "today_penalty": today_penalty,
        "today_shop": today_shop,
        "today_students": today_students,
        "today_shop_students": today_shop_students,
        "leaderboard_enabled": config.leaderboard_enabled,
        "shop_enabled": config.shop_enabled,
    }


# ============================================================
# SERIALIZER
# ============================================================

def tx_to_dict(tx: CoinTransaction, request=None):
    return {
        "id": tx.id,
        "student_id": tx.student_id,
        "student_name": f"{tx.student.first_name} {tx.student.last_name}" if tx.student_id else "",
        "amount": tx.amount,
        "transaction_type": tx.transaction_type,
        "transaction_type_display": tx.get_transaction_type_display(),
        "reason_name": tx.reason_name,
        "reason_id": tx.reason_id,
        "reason_type": getattr(tx.reason, "reason_type", ""),
        "description": tx.description,
        "created_by": tx.created_by,
        "created_at": tx.created_at.isoformat(),
        "date": tx.created_at.date().isoformat(),
        "time": tx.created_at.strftime("%H:%M"),
        "group_name": tx.group_name,
        "attendance_id": tx.attendance_id,
        "attendance_status": tx.attendance_status,
        "shop_order_id": tx.shop_order_id,
        "reversal_of": tx.reversal_of_id,
        "status": tx.status,
    }


def student_coin_summary(student):
    qs = CoinTransaction.objects.filter(student=student)
    today = tz.localdate()
    month_start = today.replace(day=1)

    def _sum(filter_qs):
        return filter_qs.aggregate(s=Sum("amount"))["s"] or 0

    return {
        "balance": student_balance(student),
        "today": _sum(qs.filter(created_at__date=today)),
        "today_coins": _sum(qs.filter(created_at__date=today, amount__gt=0)),
        "month_earned": _sum(qs.filter(created_at__date__gte=month_start, amount__gt=0)),
        "month_spent": _sum(qs.filter(created_at__date__gte=month_start, amount__lt=0)),
        "bonus": _sum(qs.filter(transaction_type=CoinTransaction.Type.BONUS)),
        "penalty": _sum(qs.filter(transaction_type=CoinTransaction.Type.PENALTY)),
        "attendance": _sum(qs.filter(transaction_type=CoinTransaction.Type.ATTENDANCE)),
        "shop": _sum(qs.filter(transaction_type=CoinTransaction.Type.SHOP)),
    }