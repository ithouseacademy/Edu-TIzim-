"""Filial kuzatuvi (super admin va `branch.monitor` ruxsatiga ega adminlar uchun).

Barcha filiallarning kassa balanslari, o'tkazmalari va tasdiqlash kutilayotgan
o'tkazmalar bir sahifada ko'rinadi.
"""

from django.contrib.auth.decorators import login_required
from django.db.models import Count, Q, Sum
from django.shortcuts import redirect, render

from .models import Branch, Kassa, KassaTransfer
from .permissions import has_permission


@login_required(login_url="login")
def branch_monitor(request):
    """Barcha filiallarni kuzatish."""
    user = request.user
    can_all = (
        user.is_superuser
        or has_permission(user, "branch.monitor")
        or has_permission(user, "cashbox.manage_all")
    )
    # Faqat super admin yoki aniq ruxsat (branch.monitor / cashbox.manage_all)
    # bo'lgan foydalanuvchi barcha filiallarni ko'ra oladi.
    if not can_all:
        return redirect("dashboard")

    branches = Branch.objects.filter(is_active=True).annotate(
        kassa_count=Count("kassalar", filter=Q(kassalar__is_active=True),
                          distinct=True),
        pending_in=Count(
            "transfers_in", filter=Q(transfers_in__status="pending"), distinct=True
        ),
        pending_out=Count(
            "transfers_out", filter=Q(transfers_out__status="pending"), distinct=True
        ),
    ).order_by("name")

    rows = []
    total_balance = 0
    for branch in branches:
        kassalar = list(
            Kassa.objects.filter(branch=branch, is_active=True)
            .select_related("owner")
            .order_by("name")
        )
        balance = sum((k.balance for k in kassalar), 0)
        total_balance += balance
        rows.append({
            "branch": branch,
            "kassalar": kassalar,
            "balance": balance,
            "pending_in": branch.pending_in,
            "pending_out": branch.pending_out,
        })

    pending = (
        KassaTransfer.objects.filter(status=KassaTransfer.Status.PENDING)
        .select_related("from_branch", "to_branch", "from_kassa", "to_kassa")
        .order_by("-created_at")[:100]
    )

    recent = (
        KassaTransfer.objects.exclude(status=KassaTransfer.Status.PENDING)
        .select_related("from_branch", "to_branch", "reviewed_by")
        .order_by("-created_at")[:100]
    )

    return render(request, "branch/monitor.html", {
        "rows": rows,
        "pending": pending,
        "recent": recent,
        "total_balance": total_balance,
        "title": "Filial kuzatuvi",
        "can_manage": has_permission(user, "branch.monitor")
        or user.is_superuser,
    })