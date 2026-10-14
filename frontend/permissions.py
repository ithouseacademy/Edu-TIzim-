"""
Granular Admin Permission System.

This module is the single source of truth for every permission in the system.
It provides:
  - PERMISSION_REGISTRY: the full list of all permissions (codename -> module/action/label)
  - has_permission(user, codename)               : backend authorization check
  - get_permissions(user)                        : set of granted codenames
  - get_grantable_codenames(user)                : set an admin may DELEGATE
  - can_grant(actor, codename, branch=None)      : can `actor` grant this perm?
  - grant_permission / revoke_permission         : single grant/revoke (with audit log)
  - grant_all / revoke_all                       : grant/revoke every *delegable* perm
  - set_permissions                              : replace perms (delegable only)
  - sync_permissions()                            : sync DB Permission rows from registry
  - has_any(request, *codenames)                 : template-friendly helper
  - can_manage_admin(user)                        : whether a user may manage another admin's perms

Rules:
  - A superuser (is_superuser) implicitly has every permission.
  - The 'admin.permissions.manage' permission gates permission management itself.
  - Regular admins can NEVER modify a superuser's permissions.
  - An admin can only DELEGATE permissions they themselves hold: hech bir
    admin o'z vakolatidan yuqoriroq vakolat bera olmaydi. 'manage' huquqi
    o'z-o'zidan yangi vakolat bermaydi — berish faqat actorda mavjud bo'lgan
    huquqlar doirasida amalga oshadi. Ruxsatsiz urinishlar audit logda
    "deny" holatida qayd etiladi.
"""

from functools import wraps

from django.contrib.auth.decorators import login_required
from django.db.models import Q
from django.http import HttpResponseForbidden

from .models import Permission, AdminPermission, PermissionAuditLog

# ============================================================
# PERMISSION REGISTRY
# Structure: codename -> (module, action, label/description)
# ============================================================

PERMISSION_REGISTRY = {
    # ===== DASHBOARD / ANALYTICS =====
    "dashboard.view": ("dashboard", "view", "Bosh sahifani ko'rish"),
    "dashboard.report": ("dashboard", "report", "Statistika va hisobotlarni ko'rish"),

    # ===== KASSA (Cashbox) =====
    "cashbox.view": ("cashbox", "view", "Kassani ko'rish"),
    "cashbox.create": ("cashbox", "create", "Kassani ochish (yaratish) va kassaga kirim qo'shish"),
    "cashbox.update": ("cashbox", "update", "Kassani tahrirlash va xodimga biriktirish"),
    "cashbox.delete": ("cashbox", "delete", "Kassani yopish (o'chirish)"),
    "cashbox.transfer": ("cashbox", "transfer", "Kassalar orasida pul o'tkazish"),
    "cashbox.withdraw": ("cashbox", "withdraw", "Kassadan pul chiqarish"),
    "cashbox.report": ("cashbox", "report", "Kassa hisobotlarini ko'rish"),
    "cashbox.approve": ("cashbox", "approve", "Kassalar o'tkazmasini tasdiqlash"),
    "cashbox.manage_all": ("cashbox", "manage_all", "Barcha kassalarni boshqarish"),
    "cashbox.view_main": ("cashbox", "view_main", "Asosiy (bosh) kassani ko'rish"),
    "cashbox.transfer_main": ("cashbox", "transfer_main", "Asosiy (bosh) kassaga pul o'tkazish"),
    "cashbox.main_income": ("cashbox", "main_income", "Asosiy (bosh) kassaga kirim qilish"),
    "cashbox.main_expense": ("cashbox", "main_expense", "Asosiy (bosh) kassadan chiqim qilish"),

    # ===== TO'LOVLAR (Payments) =====
    "payment.view": ("payment", "view", "To'lovlarni ko'rish"),
    "payment.create": ("payment", "create", "To'lov qabul qilish"),
    "payment.update": ("payment", "update", "To'lovni tahrirlash"),
    "payment.delete": ("payment", "delete", "To'lovni o'chirish"),
    "payment.refund": ("payment", "refund", "To'lovni qaytarib berish"),
    "payment.transfer": ("payment", "transfer", "To'lovni boshqa kassaga ko'chirish"),
    "payment.sms": ("payment", "sms", "Qarzdorlarga SMS yuborish"),

    # ===== CHIQIMLAR (Expenses) =====
    "expense.regular": ("expense", "regular", "Oddiy chiqim qilish (kanselyariya, arenda va boshqa)"),
    "expense.refund": ("expense", "refund", "O'quvchiga pul qaytarish (o'quvchi balansidan)"),
    "expense.salary": ("expense", "salary", "Xodimga oylik berish"),
    "expense.advance": ("expense", "advance", "Xodimga avans berish"),
    "expense.advance_close": ("expense", "advance_close", "Avans yopish (qarzni balansdan ayirish)"),

    # ===== DAVOMAT (Attendance) =====
    "attendance.view": ("attendance", "view", "Davomatni ko'rish"),
    "attendance.create": ("attendance", "create", "Davomat belgilash"),
    "attendance.update": ("attendance", "update", "Davomatni tahrirlash"),
    "attendance.delete": ("attendance", "delete", "Davomat yozuvini o'chirish"),

    # ===== O'QUVCHILAR (Students) =====
    "student.view": ("student", "view", "O'quvchilarni ko'rish"),
    "student.create": ("student", "create", "Yangi o'quvchi qo'shish"),
    "student.update": ("student", "update", "O'quvchi ma'lumotlarini tahrirlash"),
    "student.delete": ("student", "delete", "O'quvchini o'chirish"),
    "student.freeze": ("student", "freeze", "O'quvchi o'qishini vaqtincha to'xtatish yoki davom ettirish"),
    "student.transfer": ("student", "transfer", "O'quvchini guruhga qo'shish yoki guruhdan o'tkazish"),
    "student.export": ("student", "export", "O'quvchilar ro'yxatini faylga ko'chirish (export)"),
    "student.sms": ("student", "sms", "O'quvchiga SMS yuborish"),

    # ===== GURUHLAR (Groups) =====
    "group.view": ("group", "view", "Guruhlarni ko'rish"),
    "group.create": ("group", "create", "Yangi guruh yaratish"),
    "group.update": ("group", "update", "Guruh ma'lumotlarini tahrirlash"),
    "group.delete": ("group", "delete", "Guruhni o'chirish"),
    "group.freeze": ("group", "freeze", "Guruh darslarini vaqtincha to'xtatish yoki qayta boshlash"),
    "group.export": ("group", "export", "Guruh hisobotini faylga ko'chirish (export)"),
    "group.settings": ("group", "settings", "Guruh sozlamalarini boshqarish"),

    # ===== KURSLAR (Courses) =====
    "course.view": ("course", "view", "Kurslarni ko'rish"),
    "course.create": ("course", "create", "Yangi kurs yaratish"),
    "course.update": ("course", "update", "Kurs ma'lumotlarini tahrirlash"),
    "course.delete": ("course", "delete", "Kursni o'chirish"),
    "course_level.view": ("course_level", "view", "Kurs darajalarini ko'rish"),
    "course_level.create": ("course_level", "create", "Yangi kurs darajasi qo'shish"),
    "course_level.update": ("course_level", "update", "Kurs darajasini tahrirlash"),
    "course_level.delete": ("course_level", "delete", "Kurs darajasini o'chirish"),

    # ===== O'QITUVCHILAR (Teachers) =====
    "teacher.view": ("teacher", "view", "O'qituvchilarni ko'rish"),
    "teacher.create": ("teacher", "create", "Yangi o'qituvchi qo'shish"),
    "teacher.update": ("teacher", "update", "O'qituvchi ma'lumotlarini tahrirlash"),
    "teacher.delete": ("teacher", "delete", "O'qituvchini o'chirish"),
    "teacher.salary": ("teacher", "salary", "O'qituvchi oyligini (maoshini) boshqarish"),

    # ===== XODIMLAR / ADMINLAR (Employees & Admins) =====
    "admin.view": ("admin", "view", "Admin/xodimlarni ko'rish"),
    "admin.create": ("admin", "create", "Yangi admin/xodim yaratish"),
    "admin.update": ("admin", "update", "Admin/xodim ma'lumotlarini tahrirlash"),
    "admin.delete": ("admin", "delete", "Admin/xodimni o'chirish"),
    "admin.permissions.manage": ("admin", "permissions_manage", "Xodimlarga huquq (ruxsat) berish va o'zgartirish"),
    "employee.view": ("employee", "view", "Xodimlarni ko'rish"),
    "employee.create": ("employee", "create", "Yangi xodim qo'shish"),
    "employee.update": ("employee", "update", "Xodim ma'lumotlarini tahrirlash"),
    "employee.delete": ("employee", "delete", "Xodimni o'chirish"),

    # ===== MOLIYA (Finance) =====
    "finance.view": ("finance", "view", "Moliya (pul) ma'lumotlarini ko'rish"),
    "finance.create": ("finance", "create", "Yangi moliya yozuvi qo'shish"),
    "finance.update": ("finance", "update", "Moliya yozuvini tahrirlash"),
    "finance.delete": ("finance", "delete", "Moliya yozuvini o'chirish"),
    "finance.report": ("finance", "report", "Moliya hisobotlarini ko'rish"),

    # ===== HISOBOTLAR (Reports / Statistics) =====
    "report.view": ("report", "view", "Hisobotlarni ko'rish"),
    "report.export": ("report", "export", "Hisobotlarni faylga ko'chirish (export)"),

    # ===== STATISTIKA =====
    "statistics.view": ("statistics", "view", "Statistikani ko'rish"),

    # ===== MARKETING (Surveys) =====
    "survey.view": ("survey", "view", "So'rovnomalarni ko'rish"),
    "survey.create": ("survey", "create", "Yangi so'rovnoma yaratish"),
    "survey.update": ("survey", "update", "So'rovnomani tahrirlash"),
    "survey.delete": ("survey", "delete", "So'rovnomani o'chirish"),

    # ===== XODIMLAR TUZILMASI (Positions / Branches / Rooms) =====
    "position.view": ("position", "view", "Vazifalarni (lavozimlarni) ko'rish"),
    "position.create": ("position", "create", "Yangi vazifa (lavozim) qo'shish"),
    "position.update": ("position", "update", "Vazifani tahrirlash"),
    "position.delete": ("position", "delete", "Vazifani o'chirish"),
    "branch.view": ("branch", "view", "Filiallarni ko'rish"),
    "branch.create": ("branch", "create", "Yangi filial qo'shish"),
    "branch.update": ("branch", "update", "Filial ma'lumotlarini tahrirlash"),
    "branch.delete": ("branch", "delete", "Filialni o'chirish"),
    "branch.monitor": ("branch", "monitor", "Filial kuzatuvini ko'rish"),
    "branch.assign_admin": ("branch", "assign_admin", "Filialga administrator biriktirish"),
    "room.view": ("room", "view", "Xonalarni ko'rish"),
    "room.create": ("room", "create", "Yangi xona qo'shish"),
    "room.update": ("room", "update", "Xona ma'lumotlarini tahrirlash"),
    "room.delete": ("room", "delete", "Xonani o'chirish"),

    # ===== DAVOMAT SABABLARI =====
    "absence_reason.view": ("absence_reason", "view", "Davomat sabablarini ko'rish"),
    "absence_reason.create": ("absence_reason", "create", "Yangi davomat sababi qo'shish"),
    "absence_reason.update": ("absence_reason", "update", "Davomat sababini tahrirlash"),
    "absence_reason.delete": ("absence_reason", "delete", "Davomat sababini o'chirish"),

    # ===== SOZLAMALAR (Settings) =====
    "settings.view": ("settings", "view", "Sozlamalarni ko'rish"),
    "settings.update": ("settings", "update", "Sozlamalarni o'zgartirish"),
    "settings.sms": ("settings", "sms", "SMS sozlamalarini boshqarish"),
    "settings.receipt": ("settings", "receipt", "Chek (kvitansiya) sozlamalarini boshqarish"),
    "settings.qr": ("settings", "qr", "QR sozlamalarini boshqarish"),

    # ===== QO'SHIMCHA FUNKSIYALAR =====
    "additional_functions.view": ("additional_functions", "view", "Qo'shimcha funksiyalarni ko'rish"),

    # ===== SABOQ VAQTLARI =====
    "lesson_time.view": ("lesson_time", "view", "Dars vaqtlarini ko'rish"),
    "lesson_time.create": ("lesson_time", "create", "Yangi dars vaqti qo'shish"),
    "lesson_time.update": ("lesson_time", "update", "Dars vaqtini tahrirlash"),
    "lesson_time.delete": ("lesson_time", "delete", "Dars vaqtini o'chirish"),

    # ===== SMS / TELEGRAM =====
    "sms.send": ("sms", "send", "SMS yuborish"),

    # ===== AUDIT =====
    "audit.view": ("audit", "view", "Amallar tarixini (loglarni) ko'rish"),

    # ===== TOPSHIRIQLAR / ESLATMALAR (Tasks & Reminders) =====
    "task.manage": ("task", "manage", "Topshiriq va eslatma berish (tayinlash)"),

    # ===== TAKLIF VA SHIKOYATLAR (Feedback) =====
    "feedback.view": ("feedback", "view", "Taklif va shikoyatlarni ko'rish"),
    "feedback.respond": ("feedback", "respond", "Taklif va shikoyatlarga javob yozish"),

    # ===== XABARLAR (Messaging) =====
    "messaging.view": ("messaging", "view", "Xabarlar (chat) bo'limini ko'rish"),
    "messaging.send": ("messaging", "send", "Chatga xabar yuborish"),
    "messaging.settings": ("messaging", "settings", "Xabarlar sozlamalarini boshqarish"),

    # ===== GAMIFIKATSIYA / COIN =====
    "coin.view": ("coin", "view", "Coin hisobotlarini ko'rish"),
    "coin.settings": ("coin", "settings", "Coin sozlamalarini boshqarish"),
    "coin.manage_reasons": ("coin", "manage_reasons", "Coin sabablarini boshqarish"),
    "coin.manage_teacher": ("coin", "manage_teacher", "O'qituvchi coin limitlarini boshqarish"),
    "coin.view_history": ("coin", "view_history", "Coin tarixini ko'rish"),
    "coin.add": ("coin", "add", "O'quvchiga coin berish"),
    "coin.remove": ("coin", "remove", "O'quvchidan coin olish"),
    "coin.adjust": ("coin", "adjust", "Coin balansini tahrirlash"),
    "coin.reports": ("coin", "reports", "Coin hisobotlarini ko'rish"),

    # ===== SHOP (Coin do'koni) =====
    "shop.view": ("shop", "view", "Shopni ko'rish"),
    "shop.product_create": ("shop", "product_create", "Shop mahsuloti qo'shish"),
    "shop.product_edit": ("shop", "product_edit", "Shop mahsulotini tahrirlash"),
    "shop.product_delete": ("shop", "product_delete", "Shop mahsulotini o'chirish"),
    "shop.order_approve": ("shop", "order_approve", "Shop buyurtmasini tasdiqlash"),
}

# Human-friendly module names for grouping in the UI
MODULE_LABELS = {
    "dashboard": "Dashboard",
    "cashbox": "Kassa",
    "payment": "To'lovlar",
    "expense": "Chiqimlar",
    "attendance": "Davomat",
    "student": "O'quvchilar",
    "group": "Guruhlar",
    "course": "Kurslar",
    "course_level": "Kurs darajalari",
    "teacher": "O'qituvchilar",
    "admin": "Adminlar",
    "employee": "Xodimlar",
    "finance": "Moliya",
    "report": "Hisobotlar",
    "statistics": "Statistika",
    "survey": "Marketing",
    "position": "Vazifalar",
    "branch": "Filiallar",
    "room": "Xonalar",
    "absence_reason": "Davomat sabablari",
    "settings": "Sozlamalar",
    "additional_functions": "Qo'shimcha funksiyalar",
    "lesson_time": "Dars vaqtlari",
    "sms": "SMS",
    "audit": "Audit",
    "task": "Topshiriqlar va eslatmalar",
    "feedback": "Taklif va shikoyatlar",
    "messaging": "Xabarlar",
    "coin": "Gamifikatsiya (Coin)",
    "shop": "Coin do'koni (Shop)",
}


def all_codenames():
    return list(PERMISSION_REGISTRY.keys())


# ============================================================
# AUTHORIZATION HELPERS
# ============================================================

def is_super_admin(user):
    """Super Admin = Django is_superuser."""
    return bool(getattr(user, "is_superuser", False))


def has_permission(user, codename, branch=None):
    """
    Returns True if the given user (or anonymous) has the given permission.

    - Anonymous / inactive users never have permission.
    - Super users implicitly have *every* permission.
    - Otherwise the user's explicitly granted AdminPermission rows are checked.

    `branch` — filialga xos ruxsat tekshiruvi:
      - `None` (aniqlanmagan): global YOKI istalgan filialga berilgan
        ruxsat yetarli (masalan, middleware darajasida).
      - Branch objektki yoki id: global ruxsat YOKI aynan shu filialga
        berilgan ruxsat mos keladi.
    """
    if user is None or not getattr(user, "is_authenticated", False):
        return False
    if not getattr(user, "is_active", False):
        return False
    if is_super_admin(user):
        return True
    if codename not in PERMISSION_REGISTRY:
        return False
    branch_pk = getattr(branch, "pk", branch)
    # cached per-request set stored on the user instance:
    # {(codename, branch_id|None), ...}
    perms = getattr(user, "_cached_perms", None)
    if perms is None:
        perms = set(
            AdminPermission.objects
            .filter(user=user, permission__codename__in=all_codenames(), permission__is_active=True)
            .values_list("permission__codename", "branch_id")
        )
        user._cached_perms = perms
    for code, row_branch in perms:
        if code != codename:
            continue
        if row_branch is None:
            return True  # global ruxsat
        if branch_pk is None or row_branch == branch_pk:
            return True
    return False


def get_branch_permissions(user, branch=None):
    """Foydalanuvchining berilgan filial uchun amal qiladigan ruxsat to'plami.

    Global (filialsiz) ruxsatlar barcha filiallar uchun amal qiladi.
    """
    if is_super_admin(user):
        return set(all_codenames())
    if user is None or not getattr(user, "is_authenticated", False):
        return set()
    qs = AdminPermission.objects.filter(user=user, permission__is_active=True)
    if branch is not None:
        branch_pk = getattr(branch, "pk", branch)
        qs = qs.filter(Q(branch__isnull=True) | Q(branch_id=branch_pk))
    return set(qs.values_list("permission__codename", flat=True))


def get_permissions(user):
    """Return the set of codenames the user currently has granted."""
    if is_super_admin(user):
        return set(all_codenames())
    if user is None or not getattr(user, "is_authenticated", False):
        return set()
    return set(
        AdminPermission.objects
        .filter(user=user, permission__is_active=True)
        .values_list("permission__codename", flat=True)
    )


def get_permission_codes_db():
    """Return dict of codename -> Permission object from the registry."""
    codes = {(p.codename): p for p in Permission.objects.filter(codename__in=all_codenames())}
    return codes


# ============================================================
# DELEGATION (GRANTABLE) AUTHORIZATION
# ============================================================
#
# Asosiy xavfsizlik qoidasi: hech bir admin o'zida mavjud bo'lmagan
# huquqni boshqasiga bera olmaydi. "Xodimlarga huquq berish va o'zgartirish"
# (admin.permissions.manage) — bu faqat boshqa xodimlarning huquqlarini
# boshqarish imkoniyati; u adminning o'zida bo'lmagan huquqlarni berish
# vakolatini bermaydi.

def get_grantable_codenames(user):
    """Foydalanuvchi boshqalarga bera oladigan ruxsat kodlari to'plami.

    - Super admin -> barcha 128 ta ruxsat.
    - Oddiy admin -> faqat o'zida mavjud (global yoki filialga xos) ruxsatlar.
    """
    if is_super_admin(user):
        return set(all_codenames())
    if user is None or not getattr(user, "is_authenticated", False):
        return set()
    return set(
        AdminPermission.objects
        .filter(user=user, permission__is_active=True)
        .values_list("permission__codename", flat=True)
    )


def can_grant(actor, codename, branch=None):
    """`actor` shu ruxsatni boshqasiga bera oladimi?

    - Super admin har doim.
    - Global (`branch=None`) ruxsat berish uchun actorda global (filialsiz)
      ruxsat bo'lishi shart — filialga xos ruxsat globalga aylanmaydi.
    - Filialga xos ruxsat uchun actorda global ruxsat YOKI aynan shu filial
      uchun ruxsat bo'lishi kerak.
    """
    if codename not in PERMISSION_REGISTRY:
        return False
    if is_super_admin(actor):
        return True
    if actor is None or not getattr(actor, "is_authenticated", False):
        return False
    if not getattr(actor, "is_active", False):
        return False
    qs = AdminPermission.objects.filter(
        user=actor, permission__codename=codename, permission__is_active=True,
    )
    if branch is None:
        return qs.filter(branch__isnull=True).exists()
    branch_pk = getattr(branch, "pk", branch)
    return qs.filter(Q(branch__isnull=True) | Q(branch_id=branch_pk)).exists()


def log_denied(actor, target_user, codename, branch=None, reason=""):
    """Ruxsatsiz urinishni audit logga yozadi (view'lar uchun ochiq)."""
    scope = "global" if branch is None else "branch=%s" % getattr(branch, "pk", branch)
    detail = "DENIED %s; %s" % (scope, reason or "actor does not hold this permission")
    _audit(actor, target_user, codename, "deny", detail=detail)


def attendance_write_check(user, is_admin, existing):
    """
    Returns (ok, required_codename).

    Admin-level users must hold the granular attendance grants:
      - creating a NEW attendance row  -> requires 'attendance.create'
      - modifying an EXISTING row      -> requires 'attendance.update'
    Non-admin (teacher) users bypass the granular system entirely; their
    access is governed by the time/ownership checks inside the views.
    """
    if not is_admin:
        return True, None
    codename = "attendance.update" if existing else "attendance.create"
    return has_permission(user, codename), codename


def can_manage_admin(request, target_user=None):
    """
    Returns True if the request user is allowed to manage permissions.

    - Super admin can always manage.
    - A regular admin needs the 'admin.permissions.manage' permission.
    - A regular admin can never manage a superuser.
    """
    user = getattr(request, "user", None)
    if not user or not getattr(user, "is_authenticated", False):
        return False
    if is_super_admin(user):
        return True
    if target_user is not None and is_super_admin(target_user):
        return False
    return has_permission(user, "admin.permissions.manage")


# ============================================================
# MUTATION HELPERS (with audit log)
# ============================================================

def _audit(actor, target_user, codename, action, detail=""):
    try:
        PermissionAuditLog.objects.create(
            actor=actor,
            target_user=target_user,
            permission_codename=codename,
            permission_module=PERMISSION_REGISTRY.get(codename, ("", "", ""))[0],
            action=action,
            detail=detail,
        )
    except Exception:
        # Audit logging must never break the main flow.
        pass


def _invalidate_cache(user):
    """Clear the per-request permission cache after a mutation."""
    if user is not None and hasattr(user, "_cached_perms"):
        try:
            del user._cached_perms
        except AttributeError:
            pass


def grant_permission(actor, target_user, codename, branch=None, enforce=True):
    """Grant a single permission to target_user. Returns True if changed.

    `branch=None` — global (filialsiz) ruxsat; `branch=<Branch|id>` —
    faqat shu filial doirasida amal qiladigan ruxsat.

    `enforce=True` (default) — actor faqat O'ZIDA mavjud bo'lgan ruxsatni
    bera oladi. Ruxsatsiz urinish rad etiladi va audit logga yoziladi.
    """
    if codename not in PERMISSION_REGISTRY:
        return False
    if is_super_admin(target_user):
        return False  # Superuser already has everything; never store rows for it
    if enforce and not can_grant(actor, codename, branch):
        log_denied(actor, target_user, codename, branch)
        return False
    branch_pk = getattr(branch, "pk", branch)
    permission, _ = Permission.objects.get_or_create(
        codename=codename,
        defaults={
            "name": PERMISSION_REGISTRY[codename][2],
            "module": PERMISSION_REGISTRY[codename][0],
            "action": PERMISSION_REGISTRY[codename][1],
            "description": PERMISSION_REGISTRY[codename][2],
        },
    )
    created, _ = AdminPermission.objects.get_or_create(
        user=target_user, permission=permission, branch_id=branch_pk,
        defaults={"granted_by": actor},
    )
    if created:
        _audit(
            actor, target_user, codename, "grant",
            detail=f"branch={branch_pk}" if branch_pk else "branch=global",
        )
        _invalidate_cache(target_user)
    return created


def revoke_permission(actor, target_user, codename, branch=None, enforce=True):
    """Revoke a single permission from target_user. Returns True if changed.

    `branch=None` — faqat global (filialsiz) ruxsatni olib tashlaydi;
    `branch=<Branch|id>` — faqat shu filial ruxsatini olib tashlaydi.

    `enforce=True` (default) — actor faqat o'zi boshqara oladigan (o'zida
    mavjud bo'lgan) ruxsatni olib tashlay oladi; aks holda rad etiladi.
    """
    if is_super_admin(target_user):
        return False
    if codename not in PERMISSION_REGISTRY:
        return False
    if enforce and not can_grant(actor, codename, branch):
        log_denied(actor, target_user, codename, branch,
              reason="actor cannot manage this permission")
        return False
    branch_pk = getattr(branch, "pk", branch)
    deleted, _ = AdminPermission.objects.filter(
        user=target_user, permission__codename=codename, branch_id=branch_pk
    ).delete()
    if deleted:
        _audit(
            actor, target_user, codename, "revoke",
            detail=f"branch={branch_pk}" if branch_pk else "branch=global",
        )
        _invalidate_cache(target_user)
    return bool(deleted)


def grant_all(actor, target_user):
    """Grant every permission the *actor* is allowed to delegate.

    Super admin -> all 128. Oddiy admin -> faqat o'zidagi ruxsatlar.
    """
    if is_super_admin(target_user):
        return 0
    granted = 0
    for codename in all_codenames():
        if grant_permission(actor, target_user, codename):
            granted += 1
    return granted


def revoke_all(actor, target_user):
    """Revoke every permission from target_user that the actor may manage.

    Actor faqat o'zi boshqara oladigan (o'zida mavjud) ruxsatlarni olib
    tashlaydi. Boshqa admin yoki super admin tomonidan berilgan, actorda
    mavjud bo'lmagan ruxsatlar saqlanib qoladi (tasodifan o'chirilmaydi).
    """
    if is_super_admin(target_user):
        return 0
    deleted = 0
    rows = (
        AdminPermission.objects
        .filter(user=target_user, permission__codename__in=all_codenames())
        .select_related("permission")
    )
    for row in rows:
        if not can_grant(actor, row.permission.codename, row.branch):
            continue
        codename = row.permission.codename
        branch_pk = row.branch_id
        row.delete()
        deleted += 1
        _audit(
            actor, target_user, codename, "revoke",
            detail=f"branch={branch_pk}" if branch_pk else "branch=global",
        )
    if deleted:
        _invalidate_cache(target_user)
    return deleted


def set_permissions(actor, target_user, codenames):
    """
    Replace the target user's permission set with the given set of codenames.
    Returns (granted_count, revoked_count).

    Faqat actor bera oladigan ruxsatlar qo'llanadi. Actor boshqara olmaydigan
    mavjud ruxsatlar (masalan super admin berganlari) o'zgartirilmaydi.
    """
    target_perm_set = set(codenames) & get_grantable_codenames(actor)
    current = set(
        AdminPermission.objects
        .filter(user=target_user, permission__is_active=True)
        .values_list("permission__codename", flat=True)
    )
    granted = 0
    for c in (target_perm_set - current):
        if grant_permission(actor, target_user, c):
            granted += 1
    revoked = 0
    for c in (current - target_perm_set):
        if revoke_permission(actor, target_user, c):
            revoked += 1
    return granted, revoked


# ============================================================
# SYNC
# ============================================================

def sync_permissions():
    """Create/refresh DB Permission rows from the registry."""
    existing = {p.codename: p for p in Permission.objects.all()}
    created = 0
    for codename, (module, action, label) in PERMISSION_REGISTRY.items():
        perm = existing.get(codename)
        if perm is None:
            Permission.objects.create(
                codename=codename, name=label, module=module, action=action,
                description=label, is_active=True,
            )
            created += 1
        else:
            changed = False
            if perm.name != label:
                perm.name = label
                changed = True
            if perm.module != module:
                perm.module = module
                changed = True
            if perm.action != action:
                perm.action = action
                changed = True
            if not perm.is_active:
                perm.is_active = True
                changed = True
            if changed:
                perm.save(update_fields=["name", "module", "action", "is_active"])
    return created


# ============================================================
# VIEW DECORATOR
# ============================================================

def require_permission(codename):
    """
    Decorator that enforces a single permission on a Django view.

    - Anonymous users are redirected to login (via login_required).
    - Logged-in users without the permission get HTTP 403 Forbidden.
    - Super admins implicitly pass.

    Usage:
        @login_required
        @require_permission('payment.create')
        def payment_create(request): ...
    """
    def decorator(view_func):
        @wraps(view_func)
        def _wrapped(request, *args, **kwargs):
            user = getattr(request, "user", None)
            if has_permission(user, codename):
                return view_func(request, *args, **kwargs)
            return HttpResponseForbidden(
                "Sizda ushbu amalni bajarish uchun ruxsat yo'q (permission: %s)" % codename
            )
        return _wrapped
    return decorator

