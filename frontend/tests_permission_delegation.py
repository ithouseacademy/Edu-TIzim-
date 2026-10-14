"""Admin huquqlarini topshirish (delegatsiya) xavfsizligi testlari.

Asosiy qoida: hech bir admin o'zida mavjud bo'lmagan huquqni boshqasiga
bera olmaydi. Bu tekshiruv backendda majburiy bajarilishi kerak.
"""

from django.contrib.auth.models import User
from django.test import TestCase
from django.urls import reverse

from .models import (
    AdminBranch, AdminPermission, Branch, PermissionAuditLog,
)
from .permissions import (
    PERMISSION_REGISTRY, all_codenames, can_grant, get_grantable_codenames,
    get_permissions, grant_all, grant_permission, has_permission,
    revoke_all, revoke_permission, set_permissions,
)

# Adminning o'zida bo'ladigan 10 ta ruxsat
ADMIN_TEN = [
    "admin.view",
    "admin.create",
    "admin.update",
    "admin.permissions.manage",
    "group.view",
    "student.view",
    "attendance.view",
    "payment.view",
    "report.view",
    "dashboard.view",
]


class PermissionDelegationTests(TestCase):
    def setUp(self):
        self.superuser = User.objects.create_superuser("boss", "b@x.com", "pw")

        self.admin = User.objects.create_user("admin10", password="pw")
        self.admin.is_staff = True
        self.admin.save()
        for code in ADMIN_TEN:
            grant_permission(self.superuser, self.admin, code)

        self.target = User.objects.create_user("target", password="pw")
        self.target.is_staff = True
        self.target.save()

    # ---------- 1. O'zidagi 10 tadan bir nechtasini bera oladi ----------

    def test_admin_can_grant_subset_of_own_permissions(self):
        self.assertTrue(grant_permission(self.admin, self.target, "group.view"))
        self.assertTrue(grant_permission(self.admin, self.target, "student.view"))
        self.assertEqual(
            get_permissions(self.target) & {"group.view", "student.view"},
            {"group.view", "student.view"},
        )

    # ---------- 2. O'zida yo'q 11-huquqni bera olmaydi ----------

    def test_admin_cannot_grant_permission_it_does_not_hold(self):
        self.assertNotIn("finance.create", ADMIN_TEN)
        self.assertFalse(grant_permission(self.admin, self.target, "finance.create"))
        self.assertFalse(has_permission(self.target, "finance.create"))
        self.assertFalse(
            AdminPermission.objects.filter(
                user=self.target, permission__codename="finance.create"
            ).exists()
        )

    # ---------- 3. "Barchasini berish" faqat ruxsat etilganlarni tanlaydi ----

    def test_grant_all_only_grants_actor_permissions(self):
        n = grant_all(self.admin, self.target)
        self.assertEqual(n, len(ADMIN_TEN))
        self.assertEqual(get_permissions(self.target), set(ADMIN_TEN))
        self.assertEqual(len(ADMIN_TEN), 10)
        # qolgan 116 ta huquq berilmagan
        self.assertEqual(get_permissions(self.target), set(PERMISSION_REGISTRY) - (
            set(PERMISSION_REGISTRY) - set(ADMIN_TEN)
        ))

    # ---------- 4. API orqali ruxsatsiz huquq yuborilsa rad etiladi ----------

    def test_api_rejects_unauthorized_permission(self):
        self.client.force_login(self.admin)
        url = reverse("admin_permission_toggle", args=[self.target.pk])
        resp = self.client.post(url, {"codename": "finance.create", "state": "true"})
        self.assertEqual(resp.status_code, 403)
        self.assertFalse(has_permission(self.target, "finance.create"))
        # rad etilgan urinish audit logga yozilgan
        self.assertTrue(
            PermissionAuditLog.objects.filter(
                actor=self.admin, target_user=self.target,
                permission_codename="finance.create", action="deny",
            ).exists()
        )

    def test_api_allows_authorized_permission(self):
        self.client.force_login(self.admin)
        url = reverse("admin_permission_toggle", args=[self.target.pk])
        resp = self.client.post(url, {"codename": "group.view", "state": "true"})
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(resp.json()["ok"])
        self.assertTrue(has_permission(self.target, "group.view"))

    # ---------- 5. manage olib tashlansa boshqalarni o'zgartira olmaydi ------

    def test_removing_manage_blocks_further_changes(self):
        revoke_permission(self.superuser, self.admin, "admin.permissions.manage")
        self.client.force_login(self.admin)
        self.assertFalse(can_grant(self.admin, "admin.permissions.manage"))
        url = reverse("admin_permission_toggle", args=[self.target.pk])
        resp = self.client.post(url, {"codename": "group.view", "state": "true"})
        self.assertEqual(resp.status_code, 403)
        self.assertFalse(has_permission(self.target, "group.view"))

    # ---------- 6. O'zgartirilgan huquqlar keyingi so'rovda to'g'ri o'qiladi -

    def test_permission_changes_reflected_without_stale_cache(self):
        self.assertFalse(has_permission(self.target, "group.view"))  # cache boshlanadi
        grant_permission(self.superuser, self.target, "group.view")
        self.assertTrue(has_permission(self.target, "group.view"))
        revoke_permission(self.superuser, self.target, "group.view")
        self.assertFalse(has_permission(self.target, "group.view"))

    # ---------- 7. Oddiy admin superuserga aylanmaydi -------------------------

    def test_regular_admin_cannot_escalate_to_superuser(self):
        self.client.force_login(self.admin)
        # superuser ruxsatlarini boshqarishga urinish
        resp = self.client.post(
            reverse("admin_permission_toggle", args=[self.superuser.pk]),
            {"codename": "finance.create", "state": "true"},
        )
        self.assertEqual(resp.status_code, 403)
        self.superuser.refresh_from_db()
        self.assertTrue(self.superuser.is_superuser)
        # superuser ma'lumotlarini tahrirlashga urinish
        resp = self.client.post(
            reverse("admin_update", args=[self.superuser.pk]),
            {"name": "Hacked", "is_active": "on"},
        )
        self.assertIn(resp.status_code, (302, 403))
        self.superuser.refresh_from_db()
        self.assertNotEqual(self.superuser.first_name, "Hacked")
        # adminni o'zi superuserga aylantirib bo'lmaydi
        self.assertFalse(self.admin.is_superuser)

    # ---------- 8. Filial doirasidagi vakolat --------------------------------

    def test_branch_scoped_actor_cannot_grant_globally_or_other_branch(self):
        b1 = Branch.objects.create(name="Filial 1")
        b2 = Branch.objects.create(name="Filial 2")
        actor = User.objects.create_user("branch_actor", password="pw")
        actor.is_staff = True
        actor.save()
        AdminBranch.objects.create(user=actor, branch=b1)

        grant_permission(self.superuser, actor, "admin.permissions.manage", branch=b1)
        grant_permission(self.superuser, actor, "group.view", branch=b1)

        # global bera olmaydi
        self.assertFalse(can_grant(actor, "group.view"))
        self.assertFalse(grant_permission(actor, self.target, "group.view"))
        # boshqa filialga ham bera olmaydi
        self.assertFalse(can_grant(actor, "group.view", b2))
        # o'z filialiga bera oladi
        self.assertTrue(can_grant(actor, "group.view", b1))
        self.assertTrue(
            grant_permission(actor, self.target, "group.view", branch=b1)
        )

    # ---------- 9. Superuser va vakolatli adminlar ishlashda davom etadi -----

    def test_superuser_can_grant_all_and_is_unaffected(self):
        n = grant_all(self.superuser, self.target)
        self.assertEqual(n, len(PERMISSION_REGISTRY))
        self.assertEqual(get_permissions(self.target), set(all_codenames()))

    def test_authorized_admin_still_works(self):
        self.assertTrue(can_grant(self.admin, "group.view"))
        self.assertTrue(grant_permission(self.admin, self.target, "group.view"))
        self.assertTrue(has_permission(self.target, "group.view"))

    # ---------- 10. Barcha huquqlarning har biri uchun backend tekshiruvi ----

    def test_every_permission_is_enforced(self):
        self.assertEqual(len(PERMISSION_REGISTRY), 130)
        allowed = get_grantable_codenames(self.admin)
        self.assertEqual(allowed, set(ADMIN_TEN))
        for code in all_codenames():
            self.assertEqual(
                can_grant(self.admin, code),
                code in ADMIN_TEN,
                msg="can_grant mismatch for %s" % code,
            )

    # ---------- Qo'shimcha: revoke_all faqat boshqariladiganini oladi --------

    def test_revoke_all_keeps_permissions_actor_cannot_manage(self):
        for code in ADMIN_TEN:
            grant_permission(self.superuser, self.target, code)
        grant_permission(self.superuser, self.target, "finance.create")

        revoke_all(self.admin, self.target)

        remaining = get_permissions(self.target)
        self.assertEqual(remaining, {"finance.create"})

    # ---------- Qo'shimcha: set_permissions vakolatsizni qo'shmaydi ----------

    def test_set_permissions_cannot_add_unauthorized(self):
        set_permissions(self.admin, self.target, ["group.view", "finance.create"])
        self.assertIn("group.view", get_permissions(self.target))
        self.assertNotIn("finance.create", get_permissions(self.target))

    # ---------- Qo'shimcha: employee_permissions sahifasi ishlaydi ----------

    def test_employee_permissions_page_renders_for_authorized_admin(self):
        from .models import Employee

        emp = Employee.objects.create(user=self.target, first_name="Xodim")
        self.client.force_login(self.admin)
        resp = self.client.get(reverse("employee_permissions", args=[emp.pk]))
        self.assertEqual(resp.status_code, 200)
        self.assertContains(resp, "Berilgan huquqlar")
