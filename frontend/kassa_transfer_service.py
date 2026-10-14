"""Kassa o'tkazmalari: yuborish -> tasdiqlash -> bajarish.

Qoidalar:
  - Bitta filial ichida, qabul qiluvchi kassa egasi (boshqaruvchisi) o'zi
    yoki kassada ega yo'q bo'lsa -> darhol bajariladi.
  - Bitta filial ichida, lekin pul boshqa adminning (filial kassa
    boshqaruvchisining) kassasiga tushsa -> `pending` holatda qoladi va
    o'sha kassa egasi tasdiqlaydi.
  - Filial orasidagi o'tkazma ham `pending` bo'ladi; qabul qiluvchi
    filialning `cashbox.approve` ruxsati bo'lgan admini tasdiqlaydi
    (yoki `cashbox.manage_all` / super admin).
  - Yuboruvchining o'zi tasdiqlash huquqiga ega bo'lsa, tasdiq talab
    qilinmaydi.
  - Tasdiqlashda pul harakatlari `KassaTransaction` yozuvlari bilan
    atomik ravishda qo'yiladi.
"""

from django.core.exceptions import PermissionDenied
from django.db import transaction
from django.db.models import Q, Sum

from .models import KassaTransaction, KassaTransfer
from .permissions import has_permission


def kassa_available_balance(kassa):
    """Balansdan «kutilmoqda» o'tkazmalar minus qilingan.

    Tasdiqlash kutilayotgan o'tkazma balansni darhol kamaytirmaydi, lekin
    bir nechta o'tkazma bir vaqtda yuborilsa kassa «qarzga» kirmasligi uchun
    shu summa hisobga olinadi.
    """
    from decimal import Decimal

    reserved = (
        KassaTransfer.objects.filter(
            from_kassa=kassa, status=KassaTransfer.Status.PENDING
        ).aggregate(total=Sum("amount"))["total"]
        or Decimal("0")
    )
    return kassa.balance - reserved


def can_view_transfer(user, transfer):
    """O'tkazma foydalanuvchiga ko'rinadimi?"""
    if getattr(user, "is_superuser", False):
        return True
    if has_permission(user, "cashbox.manage_all"):
        return True

    is_main_involved = any(
        kassa is not None and kassa.is_main
        for kassa in (transfer.from_kassa, transfer.to_kassa)
    )
    if is_main_involved:
        # Asosiy kassa bilan bog'liq o'tkazma faqat 'cashbox.view_main' egalariga.
        return has_permission(user, "cashbox.view_main")

    ids = _allowed_branch_ids(user)
    if ids is None:
        return True
    if transfer.from_branch_id in ids or transfer.to_branch_id in ids:
        return True
    # Kassaning egasi bo'lsa
    for kassa in (transfer.from_kassa, transfer.to_kassa):
        if kassa is not None and kassa.owner_id == user.pk:
            return True
    return False


def can_approve_transfer(user, transfer):
    """Bu foydalanuvchi shu o'tkazmani tasdiqlay oladimi?"""
    if transfer.status != KassaTransfer.Status.PENDING:
        return False
    if getattr(user, "is_superuser", False):
        return True
    if has_permission(user, "cashbox.manage_all"):
        return True
    # Ruxsat aynan QABUL QILUVCHI filial uchun berilgan bo'lishi kerak
    if not has_permission(user, "cashbox.approve", branch=transfer.to_branch):
        return False
    # ...va foydalanuvchi shu filialga biriktirilgan bo'lishi kerak
    ids = _allowed_branch_ids(user)
    if ids is None:
        return True
    return transfer.to_branch_id in ids


def _allowed_branch_ids(user):
    from . import branch_scope

    return branch_scope.allowed_branch_ids(user)


def scope_transfers(request, queryset=None):
    """O'tkazmalarni filialga qarab cheklaydi."""
    if queryset is None:
        queryset = KassaTransfer.objects.all()
    ids = _allowed_branch_ids(request.user)
    if ids is None:
        return queryset

    can_view_main = has_permission(request.user, "cashbox.view_main")
    if not ids and not can_view_main:
        return queryset.none()

    main_q = Q()
    if can_view_main:
        main_q = Q(from_kassa__is_main=True) | Q(to_kassa__is_main=True)

    return queryset.filter(
        Q(from_branch_id__in=ids)
        | Q(to_branch_id__in=ids)
        | Q(from_kassa__owner=request.user)
        | Q(to_kassa__owner=request.user)
        | main_q
    ).distinct()


@transaction.atomic
def execute_transfer(transfer, user=None, note=""):
    """Tasdiqlangan o'tkazmani bajarish — pul harakatlarini yozish.

    Balans yetarli bo'lmasa `False` qaytaradi (hech narsa o'zgarMAYdi).
    """
    from_kassa = transfer.from_kassa
    to_kassa = transfer.to_kassa
    if from_kassa is None or to_kassa is None:
        return False
    if transfer.status != KassaTransfer.Status.PENDING:
        return False  # faqat bir marta bajariladi

    # Tasdiqlash paytida boshqa o'tkazma balansni sarflagan bo'lishi mumkin
    others = (
        KassaTransfer.objects.filter(
            from_kassa=from_kassa,
            status=KassaTransfer.Status.APPROVED,
        )
        .exclude(pk=transfer.pk)
        .aggregate(total=Sum("amount"))["total"] or 0
    )
    if from_kassa.balance - others < transfer.amount:
        return False

    before_from = from_kassa.balance
    before_to = to_kassa.balance
    created_by = transfer.created_by or (
        user.get_full_name() or user.username if user else ""
    )

    KassaTransaction.objects.create(
        kassa=from_kassa,
        transaction_type=KassaTransaction.TransactionType.TRANSFER_OUT,
        amount=transfer.amount,
        balance_before=before_from,
        balance_after=before_from - transfer.amount,
        description=transfer.description
        or f"Kassa o'tkazma: {from_kassa.name} → {to_kassa.name}",
        payment_method=transfer.payment_method or "",
        created_by=created_by,
        created_by_user=user,
    )
    KassaTransaction.objects.create(
        kassa=to_kassa,
        transaction_type=KassaTransaction.TransactionType.TRANSFER_IN,
        amount=transfer.amount,
        balance_before=before_to,
        balance_after=before_to + transfer.amount,
        description=transfer.description
        or f"Kassa o'tkazma: {from_kassa.name} → {to_kassa.name}",
        payment_method=transfer.to_payment_method or transfer.payment_method or "",
        created_by=created_by,
        created_by_user=user,
    )

    now = timezone_now()
    transfer.status = KassaTransfer.Status.APPROVED
    transfer.reviewed_by = user
    transfer.reviewed_at = now
    transfer.completed_at = now
    if note:
        transfer.review_note = note
    transfer.save(update_fields=[
        "status", "reviewed_by", "reviewed_at", "completed_at", "review_note",
    ])
    return True


def reject_transfer(transfer, user, note=""):
    """O'tkazmani rad etish — pul harakati bo'lmaydi."""
    if transfer.status != KassaTransfer.Status.PENDING:
        return False
    transfer.status = KassaTransfer.Status.REJECTED
    transfer.reviewed_by = user
    transfer.reviewed_at = timezone_now()
    transfer.review_note = note
    transfer.save(update_fields=[
        "status", "reviewed_by", "reviewed_at", "review_note",
    ])
    return True


def create_transfer_request(
    from_kassa, to_kassa, amount, user, description="",
    payment_method="", to_payment_method="",
):
    """Yangi o'tkazma yaratadi.

    Tasdiqlash qachon kerak:
      - Boshqa filialga o'tkazma -> har doim (`pending`).
      - Bitta filial ichida, qabul qiluvchi kassa egasi boshqa odam bo'lsa
        (filial kassa boshqaruvchisi) -> `pending`; o'sha egasi tasdiqlaydi.
      - Aks holda (o'z kassasiga yoki egasiz kassaga) -> darhol bajariladi.
    Yuboruvchining o'zi tasdiqlay oladigan bo'lsa, tasdiq talab qilinmaydi.
    """
    from .branch_scope import allowed_branch_ids
    from .permissions import has_permission

    # Asosiy (bosh) kassa bilan bog'liq o'tkazmalar maxsus ruxsat talab qiladi
    # (view darajasidan tashqari service darajasida ham majburiy).
    from_main = bool(from_kassa is not None and from_kassa.is_main)
    to_main = bool(to_kassa is not None and to_kassa.is_main)
    superuser = bool(getattr(user, "is_superuser", False))
    if from_main and not (superuser or has_permission(user, "cashbox.manage_all")):
        raise PermissionDenied(
            "Asosiy kassadan pul o'tkazish faqat rahbar "
            "(cashbox.manage_all) huquqiga ega xodimlar uchun ochiq."
        )
    if to_main and not (superuser or has_permission(user, "cashbox.transfer_main")):
        raise PermissionDenied(
            "Asosiy kassaga pul o'tkazish huquqi yo'q (cashbox.transfer_main)."
        )

    from_branch = from_kassa.branch
    to_branch = to_kassa.branch
    cross = bool(
        from_branch and to_branch and from_branch.pk != to_branch.pk
    )

    ids = allowed_branch_ids(user)
    can_approve = (
        getattr(user, "is_superuser", False)
        or has_permission(user, "cashbox.manage_all")
        or (
            to_branch is not None
            and has_permission(user, "cashbox.approve", branch=to_branch)
            and (ids is None or to_branch.pk in ids)
        )
    )
    # Ikkala kassa ham bitta ANIQ filialga tegishlimi?
    same_branch = bool(
        from_branch is not None
        and to_branch is not None
        and from_branch.pk == to_branch.pk
    )
    # Bitta filial ichida o'z-o'zidan bajariladigan holat: qabul qiluvchi
    # kassada ega yo'q yoki ega — o'tkazmani yuborayotgan odamning o'zi.
    to_owner_id = to_kassa.owner_id if to_kassa is not None else None
    self_service = (
        to_owner_id is None or to_owner_id == getattr(user, "pk", None)
    )
    # Tasdiqlash BOSHQA filialga o'tkazishda yoki pul bitta filial ichida
    # boshqa boshqaruvchining kassasiga tushganda kerak (yuboruvchi o'zi
    # tasdiqlay olmasa).
    requires_approval = (
        cross or (same_branch and not self_service)
    ) and not can_approve

    transfer = KassaTransfer.objects.create(
        from_kassa=from_kassa,
        to_kassa=to_kassa,
        amount=amount,
        description=description or f"Kassa o'tkazma: {from_kassa.name} → {to_kassa.name}",
        created_by=(user.get_full_name() or user.username) if user else "",
        created_by_user=user,
        from_branch=from_branch,
        to_branch=to_branch,
        requires_approval=requires_approval,
        payment_method=payment_method or "",
        to_payment_method=to_payment_method or "",
        status=KassaTransfer.Status.PENDING if requires_approval
        else KassaTransfer.Status.PENDING,
    )

    if not requires_approval:
        execute_transfer(transfer, user=user)
    return transfer


def timezone_now():
    from django.utils import timezone

    return timezone.now()