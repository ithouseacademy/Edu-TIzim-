from . import branch_scope
"""
Admin (Super Admin) management views for the granular permission system.

Super Admin (is_superuser) manages other admins (is_staff users) and their
granular permissions. Regular admins can only manage permissions if they hold
the 'admin.permissions.manage' grant, but can NEVER modify a superuser.
"""

from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.contrib.auth.models import User
from django.db import IntegrityError
from django.db.models import Count, Q
from django.http import JsonResponse
from django.shortcuts import render, redirect, get_object_or_404
from django.urls import reverse

from .models import (
    AdminBranch, Branch, Employee, Permission, AdminPermission,
    PermissionAuditLog,
)
from .permissions import (
    has_permission,
    is_super_admin,
    can_manage_admin,
    can_grant,
    get_grantable_codenames,
    log_denied,
    grant_permission,
    revoke_permission,
    grant_all,
    revoke_all,
    set_permissions,
    all_codenames,
    PERMISSION_REGISTRY,
    MODULE_LABELS,
)


def _can(request):
    """Super admin can always manage; otherwise requires permissions.manage."""
    return can_manage_admin(request)


def _admin_context():
    """Return (modules -> ordered list of (codename,label,action)) for the UI."""
    groups = {}
    for codename, (module, action, label) in PERMISSION_REGISTRY.items():
        groups.setdefault(module, []).append({
            "codename": codename,
            "action": action,
            "label": label,
        })
    ordered = []
    for module in sorted(groups.keys(), key=lambda m: MODULE_LABELS.get(m, m)):
        ordered.append({
            "module": module,
            "label": MODULE_LABELS.get(module, module),
            "permissions": groups[module],
        })
    return ordered


def _admin_user_queryset():
    """Admins = staff users (includes superusers). Excludes pure teacher-only users."""
    return User.objects.filter(is_staff=True).annotate(
        perm_count=Count("admin_permissions")
    ).order_by("-is_superuser", "-is_active", "username")


@login_required(login_url="login")
def admin_list(request):
    if not _can(request):
        return redirect("dashboard")
    admins = _admin_user_queryset()
    return render(request, "admin_permission/list.html", {
        "admins": admins,
        "can_manage": True,
    })


@login_required(login_url="login")
def admin_create(request):
    if not _can(request) or not has_permission(request.user, "admin.create"):
        return redirect("admin_list")
    error = None
    if request.method == "POST":
        name = request.POST.get("name", "").strip()
        username = request.POST.get("username", "").strip()
        password = request.POST.get("password", "")
        is_active = request.POST.get("is_active") == "on"
        grant_all_flag = request.POST.get("grant_all") == "on"
        if not name or not username or not password:
            error = "Ism, login (telefon) va parol to'ldirilishi shart."
        elif len(password) < 4:
            error = "Parol kamida 4 belgidan iborat bo'lishi kerak."
        else:
            try:
                user = User.objects.create_user(username=username, password=password, first_name=name)
                user.is_staff = True
                user.is_active = is_active
                user.save()
                if grant_all_flag:
                    grant_all(request.user, user)
                messages.success(request, f"Admin '{name}' yaratildi.")
                return redirect("admin_permissions", pk=user.id)
            except IntegrityError:
                error = "Bu login (telefon) bilan foydalanuvchi allaqachon mavjud."
    return render(request, "admin_permission/create.html", {
        "error": error,
        "can_manage": True,
    })


@login_required(login_url="login")
def admin_permissions(request, pk):
    if not _can(request):
        return redirect("dashboard")
    admin = get_object_or_404(User, pk=pk, is_staff=True)
    if not is_super_admin(request.user) and is_super_admin(admin):
        messages.error(request, "Siz super admin huquqlarini o'zgartira olmaysiz.")
        return redirect("admin_list")
    return _render_manage(request, admin, back_url=None, back_label="Orqaga")


@login_required(login_url="login")
def employee_permissions(request, pk):
    """Permissions for an Employee's linked login/account, reachable from the
    employee profile 'Sozlash' button."""
    if not _can(request):
        return redirect("dashboard")
    employee = get_object_or_404(Employee.all_objects, pk=pk)
    admin = employee.user
    if admin is None:
        messages.error(request, "Bu xodimda tizimga kirish (login) hisobi yo'q.")
        return redirect("employee_profile", pk=pk)
    if not is_super_admin(request.user) and is_super_admin(admin):
        messages.error(request, "Super admin huquqlarini o'zgartira olmaysiz.")
        return redirect("employee_profile", pk=pk)
    return _render_manage(
        request, admin,
        back_url=request.build_absolute_uri(reverse("employee_profile", args=[pk])),
        back_label="Xodim profiliga qaytish",
    )


def _render_manage(request, admin, back_url=None, back_label="Orqaga"):
    granted = set(
        AdminPermission.objects
        .filter(user=admin, permission__is_active=True, branch__isnull=True)
        .values_list("permission__codename", flat=True)
    )
    # Filialga xos ruxsatlar (branch_id -> {codename})
    branch_grants = {}
    for codename, branch_id in AdminPermission.objects.filter(
        user=admin, branch__isnull=False, permission__is_active=True
    ).values_list("permission__codename", "branch_id"):
        branch_grants.setdefault(branch_id, set()).add(codename)

    grantable = get_grantable_codenames(request.user)

    modules = []
    for mod in _admin_context():
        for p in mod["permissions"]:
            p["granted"] = p["codename"] in granted
            p["branch_grants"] = branch_grants
            p["grantable"] = p["codename"] in grantable
        modules.append(mod)
    return render(request, "admin_permission/manage.html", {
        "admin": admin,
        "modules": modules,
        "granted_count": len(granted),
        "total_count": len(PERMISSION_REGISTRY),
        "grantable_count": len(grantable),
        "can_grant_all": bool(grantable) and not is_super_admin(admin),
        "is_super_admin_user": is_super_admin(admin),
        "can_manage": True,
        "back_url": back_url,
        "back_label": back_label,
        "branches": branch_scope.available_branches(admin),
        "admin_branch_ids": list(
            AdminBranch.objects.filter(user=admin)
            .values_list("branch_id", flat=True)
        ),
    })


@login_required(login_url="login")
def admin_branch_permissions(request, pk):
    """Aniq bir filial doirasidagi ruxsatlar ro'yxati."""
    if not _can(request):
        return redirect("dashboard")
    admin = get_object_or_404(User, pk=pk, is_staff=True)
    branch = get_object_or_404(Branch, pk=request.GET.get("branch"))
    from .permissions import get_branch_permissions

    granted = get_branch_permissions(admin, branch)
    modules = []
    for mod in _admin_context():
        for p in mod["permissions"]:
            p["granted"] = p["codename"] in granted
            p["grantable"] = can_grant(request.user, p["codename"], branch)
        modules.append(mod)
    return render(request, "admin_permission/branch_manage.html", {
        "admin": admin,
        "branch": branch,
        "modules": modules,
        "granted_count": len(granted),
        "total_count": len(PERMISSION_REGISTRY),
        "can_manage": True,
        "back_url": reverse("admin_permissions", args=[pk]),
        "back_label": "Umumiy ruxsatlar",
    })


@login_required(login_url="login")
def admin_branch_permission_toggle(request, pk):
    """Filialga xos ruxsatni yoqish/o'chirish (AJAX)."""
    if request.method != "POST":
        return JsonResponse({"ok": False, "error": "Method not allowed"}, status=405)
    if not _can(request):
        return JsonResponse({"ok": False, "error": "Ruxsat yo'q"}, status=403)
    admin = get_object_or_404(User, pk=pk)
    if is_super_admin(admin):
        return JsonResponse(
            {"ok": False, "error": "Super admin ruxsatlarini o'zgartirib bo'lmaydi"},
            status=403,
        )
    codename = request.POST.get("codename", "")
    if codename not in PERMISSION_REGISTRY:
        return JsonResponse({"ok": False, "error": "Noma'lum ruxsat"}, status=400)
    try:
        branch = Branch.objects.get(pk=request.POST.get("branch"))
    except (Branch.DoesNotExist, TypeError, ValueError):
        return JsonResponse({"ok": False, "error": "Filial topilmadi"}, status=400)

    new_state = request.POST.get("state") == "true"
    if new_state:
        if not can_grant(request.user, codename, branch):
            log_denied(request.user, admin, codename, branch, "grant not allowed")
            return JsonResponse(
                {"ok": False, "error": "Sizda bu huquqni berish vakolati yo'q"},
                status=403,
            )
        grant_permission(request.user, admin, codename, branch=branch)
    else:
        if not can_grant(request.user, codename, branch):
            log_denied(request.user, admin, codename, branch, "revoke not allowed")
            return JsonResponse(
                {"ok": False, "error": "Siz bu huquqni o'zgartirish vakolatiga ega emassiz"},
                status=403,
            )
        revoke_permission(request.user, admin, codename, branch=branch)
    return JsonResponse({"ok": True, "granted": new_state, "branch": branch.pk})


@login_required(login_url="login")
def admin_permission_toggle(request, pk):
    if request.method != "POST":
        return JsonResponse({"ok": False, "error": "Method not allowed"}, status=405)
    if not _can(request):
        return JsonResponse({"ok": False, "error": "Ruxsat yo'q"}, status=403)
    admin = get_object_or_404(User, pk=pk)
    if is_super_admin(admin):
        return JsonResponse({"ok": False, "error": "Super admin huquqlarini o'zgartirib bo'lmaydi"}, status=403)
    codename = request.POST.get("codename", "")
    if codename not in PERMISSION_REGISTRY:
        return JsonResponse({"ok": False, "error": "Noma'lum ruxsat"}, status=400)
    new_state = request.POST.get("state") == "true"
    if new_state:
        if not can_grant(request.user, codename):
            log_denied(request.user, admin, codename, None, "grant not allowed")
            return JsonResponse(
                {"ok": False, "error": "Sizda bu huquqni berish vakolati yo'q"},
                status=403,
            )
        grant_permission(request.user, admin, codename)
    else:
        if not can_grant(request.user, codename):
            log_denied(request.user, admin, codename, None, "revoke not allowed")
            return JsonResponse(
                {"ok": False, "error": "Siz bu huquqni o'zgartirish vakolatiga ega emassiz"},
                status=403,
            )
        revoke_permission(request.user, admin, codename)
    return JsonResponse({"ok": True, "granted": new_state})


@login_required(login_url="login")
def admin_permission_grant_all(request, pk):
    if request.method != "POST" or not _can(request):
        return JsonResponse({"ok": False, "error": "Ruxsat yo'q"}, status=403)
    admin = get_object_or_404(User, pk=pk)
    if is_super_admin(admin):
        return JsonResponse({"ok": False, "error": "Super admin uchun zarur emas"}, status=403)
    n = grant_all(request.user, admin)
    return JsonResponse({"ok": True, "count": n})


@login_required(login_url="login")
def admin_permission_revoke_all(request, pk):
    if request.method != "POST" or not _can(request):
        return JsonResponse({"ok": False, "error": "Ruxsat yo'q"}, status=403)
    admin = get_object_or_404(User, pk=pk)
    if is_super_admin(admin):
        return JsonResponse({"ok": False, "error": "Super admin huquqlarini olib tashlab bo'lmaydi"}, status=403)
    n = revoke_all(request.user, admin)
    return JsonResponse({"ok": True, "count": n})


@login_required(login_url="login")
def admin_block(request, pk):
    if request.method != "POST" or not _can(request):
        return JsonResponse({"ok": False, "error": "Ruxsat yo'q"}, status=403)
    admin = get_object_or_404(User, pk=pk, is_staff=True)
    if is_super_admin(admin):
        return JsonResponse({"ok": False, "error": "Super adminni bloklab bo'lmaydi"}, status=403)
    if admin.pk == request.user.pk:
        return JsonResponse({"ok": False, "error": "O'zingizni bloklab bo'lmaydi"}, status=400)
    admin.is_active = False
    admin.save(update_fields=["is_active"])
    return JsonResponse({"ok": True, "active": False})


@login_required(login_url="login")
def admin_unblock(request, pk):
    if request.method != "POST" or not _can(request):
        return JsonResponse({"ok": False, "error": "Ruxsat yo'q"}, status=403)
    admin = get_object_or_404(User, pk=pk, is_staff=True)
    if is_super_admin(admin):
        return JsonResponse({"ok": False, "error": "Super adminni faollashtirish zarur emas"}, status=403)
    admin.is_active = True
    admin.save(update_fields=["is_active"])
    return JsonResponse({"ok": True, "active": True})


@login_required(login_url="login")
def admin_update(request, pk):
    if not _can(request) or not has_permission(request.user, "admin.update"):
        return redirect("admin_list")
    admin = get_object_or_404(User, pk=pk, is_staff=True)
    if not is_super_admin(request.user) and is_super_admin(admin):
        messages.error(request, "Siz super adminni o'zgartira olmaysiz.")
        return redirect("admin_list")
    error = None
    if request.method == "POST":
        name = request.POST.get("name", "").strip()
        password = request.POST.get("password", "").strip()
        is_active = request.POST.get("is_active") == "on"
        if not name:
            error = "Ism bo'sh bo'lmasligi kerak."
        else:
            admin.first_name = name
            if not is_super_admin(request.user) and is_super_admin(admin):
                pass  # cannot alter superuser
            else:
                admin.is_active = is_active
            if password:
                if len(password) < 4:
                    error = "Parol kamida 4 belgidan iborat bo'lishi kerak."
                else:
                    admin.set_password(password)
            if not error:
                admin.save()
                messages.success(request, "Admin ma'lumotlari yangilandi.")
                return redirect("admin_list")
    return render(request, "admin_permission/edit.html", {
        "admin": admin,
        "error": error,
        "can_manage": True,
    })


@login_required(login_url="login")
def admin_delete(request, pk):
    if not _can(request) or not has_permission(request.user, "admin.delete"):
        return redirect("admin_list")
    admin = get_object_or_404(User, pk=pk, is_staff=True)
    if is_super_admin(admin):
        messages.error(request, "Super adminni o'chirib bo'lmaydi.")
        return redirect("admin_list")
    if admin.pk == request.user.pk:
        messages.error(request, "O'zingizni o'chira olmaysiz.")
        return redirect("admin_list")
    if request.method == "POST":
        admin.delete()
        messages.success(request, "Admin o'chirildi.")
        return redirect("admin_list")
    return render(request, "admin_permission/delete.html", {
        "admin": admin,
        "can_manage": True,
    })


@login_required(login_url="login")
def audit_log(request):
    if not _can(request) or not has_permission(request.user, "audit.view"):
        return redirect("dashboard")
    logs = PermissionAuditLog.objects.select_related("actor", "target_user")
    ids = branch_scope.allowed_branch_ids(request.user)
    if ids is not None:
        # Amal bajarilgan odam yoki uning maqsadi o'z filialiga tegishli
        # bo'lsa ko'rinadi (masalan superadmin boshqa filial xodimiga
        # ruxsat bersa, o'sha filial admini o'z amalini ko'radi).
        logs = logs.filter(
            Q(actor__employee_profile__branches__id__in=ids)
            | Q(actor__admin_branches__branch_id__in=ids)
            | Q(target_user__employee_profile__branches__id__in=ids)
            | Q(target_user__admin_branches__branch_id__in=ids)
            | Q(target_user__student_profile__branch_id__in=ids)
        ).distinct()
    logs = logs.order_by("-created_at")[:200]
    perm_labels = {c: v[2] for c, v in PERMISSION_REGISTRY.items()}
    return render(request, "admin_permission/audit.html", {
        "logs": logs,
        "perm_labels": perm_labels,
        "can_manage": True,
    })
