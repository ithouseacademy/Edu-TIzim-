from frontend.permissions import get_permissions, is_super_admin
from frontend.models import Task
from frontend.reminder_state import unread_count_for


def perms_context(request):
    """Inject `permissions` (set of granted codenames) and `is_super_admin`
    into every template context so buttons/menus can be shown/hidden."""
    user = getattr(request, "user", None)
    if user is not None and getattr(user, "is_authenticated", False):
        permissions = get_permissions(user)
        is_admin_super = is_super_admin(user)
    else:
        permissions = set()
        is_admin_super = False

    def can(codename):
        return codename in permissions or is_admin_super

    return {
        "permissions": permissions,
        "is_super_admin": is_admin_super,
        "can": can,
    }


def new_tasks_badge(request):
    """Badge hisoblarini barcha sahifalarga beradi.

    - `new_tasks_count`: oxirgi ko'rilgandan keyin kelgan yangi topshiriqlar.
    - `unread_reminders_count`: o'qiymagan eslatmalar (o'ziga + «hammaga»).
    - `notifications_count`: ikkalasining yig'indisi (sidebar «Topshiriqlar» dagi badge).

    Umumiy (send_to_all) eslatmalar employee_profile'siz foydalanuvchilarda
    ham hisoblanadi — aks holda administratorning badge'ida hech narsa chiqmas edi.
    """
    user = getattr(request, "user", None)
    if user is None or not getattr(user, "is_authenticated", False):
        return {"new_tasks_count": 0, "unread_reminders_count": 0, "notifications_count": 0}
    try:
        emp = request.user.employee_profile
    except Exception:
        emp = None
    new_tasks = 0
    if emp:
        base = Task.objects.filter(assigned_to=emp, is_active=True)
        if emp.notifications_seen_at:
            base = base.filter(created_at__gt=emp.notifications_seen_at)
        new_tasks = base.count()
    unread_reminders = unread_count_for(user, emp)
    return {
        "new_tasks_count": new_tasks,
        "unread_reminders_count": unread_reminders,
        "notifications_count": new_tasks + unread_reminders,
    }
