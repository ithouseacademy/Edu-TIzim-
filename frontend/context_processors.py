from frontend.permissions import get_permissions, is_super_admin
from frontend.models import Task, Feedback
from frontend.reminder_state import unread_count_for
from frontend import messaging_api
from frontend import branch_scope


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

    feedback_new_count = 0
    if is_admin_super or "feedback.view" in permissions:
        feedback_new_count = Feedback.objects.filter(status=Feedback.Status.NEW).count()

    return {
        "permissions": permissions,
        "is_super_admin": is_admin_super,
        "can": can,
        "feedback_new_count": feedback_new_count,
    }


def messaging_context(request):
    """Messaging uchun: sidebar'da ko'rsatish, badge (o'qilmaganlar) soni."""
    user = getattr(request, "user", None)
    can_messaging = False
    messaging_unread = 0
    if user is not None and getattr(user, "is_authenticated", False):
        can_messaging = messaging_api.can_access_messaging(user)
        if can_messaging:
            actor = messaging_api._actor_from_user(user)
            messaging_unread = messaging_api.unread_total(actor)
    return {
        "can_messaging": can_messaging,
        "messaging_unread": messaging_unread,
    }


def branch_context(request):
    """Filial tanlash context'i.

    Shablonlarda ishlatiladi:
      - `current_branch`      : joriy tanlangan filial (None = barchasi)
      - `branch_options`      : tanlash mumkin bo'lgan filiallar
      - `can_switch_branch`   : tanlagich ko'rsatilishi kerakmi
      - `branch_locked`       : xodim/o'quvchi o'z filialiga «bog'langan»
    """
    user = getattr(request, "user", None)
    if user is None or not getattr(user, "is_authenticated", False):
        return {
            "current_branch": None,
            "branch_options": [],
            "can_switch_branch": False,
            "branch_locked": False,
            "branch_filter_active": False,
        }
    current = branch_scope.get_current_branch(request)
    locked = not branch_scope.can_switch_branch(user)
    locked_branch = None
    if locked:
        # Xodim bir nechta filialda ishlaydi — nomini ko'rsatish uchun birinchisi.
        locked_branch = branch_scope.default_branch_for(user) or branch_scope._employee_branch(user)
        if current is None:
            current = locked_branch
    can_add_all = branch_scope.can_add_to_all_branches(user)
    add_default = branch_scope.default_add_branch(user, current)
    return {
        "current_branch": current,
        "locked_branch": locked_branch,
        "branch_options": list(branch_scope.available_branches(user)),
        "can_switch_branch": branch_scope.can_switch_branch(user),
        "branch_locked": locked,
        "branch_filter_active": current is not None,
        "can_add_to_all_branches": can_add_all,
        "default_branch_id": add_default.pk if add_default is not None else None,
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
