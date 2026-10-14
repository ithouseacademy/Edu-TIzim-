"""Filial va xodim bo'yicha to'lov usullarini aniqlash.

Qoidalar:
  - Global `PaymentMethod` katalogi yagona — bir xil usul har bir filial uchun
    qaytadan yaratilmaydi.
  - Filialga yoqilgan usullar `Branch.payment_methods` da saqlanadi. Bo'sh
    bo'lsa (hali sozlanmagan) — barcha faol usullar ishlatiladi (eski tartib).
  - Xodimga ruxsat etilgan usullar `Employee.payment_methods` da saqlanadi.
    Bo'sh bo'lsa — xodim filialning barcha yoqilgan usullaridan foydalanadi.
  - Xodimning individual usullari hech qachon filial usullaridan tashqariga
    chiqmaydi: natija har doim filial usullari bilan kesishadi.
"""

from .models import PaymentMethod


def _active_methods():
    return PaymentMethod.objects.filter(is_active=True)


def branch_methods(branch):
    """Filial uchun yoqilgan to'lov usullari (sozlanmagan bo'lsa — barcha faol)."""
    active = _active_methods()
    if branch is None:
        return active
    qs = branch.payment_methods.filter(is_active=True)
    if qs.exists():
        return qs
    return active


def employee_methods(employee, branch=None):
    """Xodim ishlata oladigan to'lov usullari (filial bilan cheklangan)."""
    base = branch_methods(branch)
    if employee is None:
        return base
    qs = employee.payment_methods.filter(is_active=True)
    if qs.exists():
        base = base.filter(pk__in=qs.values_list("pk", flat=True))
    return base


def effective_branch_for(user, branch=None):
    """Usullarni aniqlash uchun filial: berilgani ustuvor, aks holda xodim filiali."""
    if branch is not None:
        return branch
    employee = getattr(user, "employee_profile", None)
    if employee is not None:
        return employee.branches.filter(is_active=True).order_by("name").first()
    return None


def allowed_payment_methods(user, branch=None, kassa=None):
    """Foydalanuvchi shu filial/kassa kontekstida ishlata oladigan usullar."""
    if kassa is not None and getattr(kassa, "branch", None) is not None:
        branch = kassa.branch
    branch = effective_branch_for(user, branch)
    employee = getattr(user, "employee_profile", None)
    if employee is None:
        return branch_methods(branch)
    return employee_methods(employee, branch)


def allowed_method_names(user, branch=None, kassa=None):
    return {
        name.lower().strip()
        for name in allowed_payment_methods(user, branch, kassa).values_list("name", flat=True)
    }


def is_method_allowed(user, method_name, branch=None, kassa=None):
    """Bo'sh usul («umumiy balans») har doim ruxsat etiladi.

    Aks holda usul nomi (katta-kichik harfga sezgir emas) ruxsat etilganlar
    ro'yxatida bo'lishi shart.
    """
    if not method_name or not str(method_name).strip():
        return True
    return str(method_name).strip().lower() in allowed_method_names(user, branch, kassa)


def branch_methods_union(branches):
    """Bir nechta filialning yoqilgan usullari birlashmasi (xodim validatsiyasi uchun)."""
    result = PaymentMethod.objects.none()
    for branch in branches:
        result = result | branch_methods(branch)
    return result
