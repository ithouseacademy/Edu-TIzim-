"""Kassa (cashbox) egasini tayinlash xavfsizligi.

Qoidalar:
  - Oddiy admin faqat O'ZI uchun kassa ochishi mumkin; boss/super staff
    nomiga kassa ochib berolmaydi.
  - Super admin (boss) o'zi uchun (va kerak bo'lsa boshqalarga ham) kassa
    ocha oladi va uning nomi yaratish sahifasida ko'rinadi.
"""

from django.contrib.auth.models import User
from django.test import TestCase
from django.urls import reverse

from .models import Kassa
from .permissions import grant_permission


class KassaOwnerPermissionTests(TestCase):
    def setUp(self):
        self.boss = User.objects.create_superuser("boss", "b@x.com", "pw")

        self.regular = User.objects.create_user("oddiy_admin", password="pw")
        self.regular.is_staff = True
        self.regular.save()

        self.super_staff = User.objects.create_superuser("super_staff", "s@x.com", "pw")

        # Oddiy admin kassa ochish (create) huquqiga ega
        grant_permission(self.boss, self.regular, "cashbox.create")

    # ---------- Boss nomi kassa yaratishda ko'rinadi -----------------------

    def test_boss_name_appears_when_creating_kassa(self):
        self.client.force_login(self.boss)
        resp = self.client.get(reverse("kassa_create"))
        self.assertEqual(resp.status_code, 200)
        self.assertContains(resp, str(self.boss.pk))
        self.assertContains(resp, "boss")

    # ---------- Boss o'zi uchun kassa ocha oladi ---------------------------

    def test_boss_can_create_kassa_for_himself(self):
        self.client.force_login(self.boss)
        resp = self.client.post(reverse("kassa_create"), {
            "name": "Boss kassasi",
            "owner": str(self.boss.pk),
            "branch": "",
            "is_active": "on",
        })
        self.assertIn(resp.status_code, (200, 302))
        self.assertTrue(
            Kassa.objects.filter(name="Boss kassasi", owner=self.boss).exists()
        )

    # ---------- Oddiy admin o'zi uchun kassa ocha oladi --------------------

    def test_regular_admin_can_create_kassa_for_self(self):
        self.client.force_login(self.regular)
        resp = self.client.post(reverse("kassa_create"), {
            "name": "Mening kassam",
            "owner": str(self.regular.pk),
            "branch": "",
            "is_active": "on",
        })
        self.assertIn(resp.status_code, (200, 302))
        self.assertTrue(
            Kassa.objects.filter(name="Mening kassam", owner=self.regular).exists()
        )

    # ---------- Oddiy admin super_staff / boshqa admin nomiga bera olmaydi --

    def test_regular_admin_cannot_create_kassa_for_super_staff(self):
        self.client.force_login(self.regular)
        resp = self.client.post(reverse("kassa_create"), {
            "name": "Noqonuniy kassa",
            "owner": str(self.super_staff.pk),
            "branch": "",
            "is_active": "on",
        })
        # Avval super_staff hech qanday kassaga ega emas
        self.assertFalse(
            Kassa.objects.filter(owner=self.super_staff).exists()
        )
        # Variantlar orasida super_staff ko'rinmasligi kerak
        page = self.client.get(reverse("kassa_create"))
        self.assertNotContains(page, 'value="%s"' % self.super_staff.pk)

    def test_regular_admin_cannot_create_kassa_for_another_admin(self):
        other = User.objects.create_user("boshqa_admin", password="pw")
        other.is_staff = True
        other.save()
        self.client.force_login(self.regular)
        resp = self.client.post(reverse("kassa_create"), {
            "name": "Boshqa nomdagi kassa",
            "owner": str(other.pk),
            "branch": "",
            "is_active": "on",
        })
        self.assertFalse(
            Kassa.objects.filter(owner=other).exists()
        )
        # Egasi odatiy admin bo'lgan kassa yaratilmasligi kerak
        self.assertEqual(
            Kassa.objects.filter(name="Boshqa nomdagi kassa").count(), 0
        )

    # ---------- Filiallar faqat tegishlilarigina ko'rinishi ----------

    def test_unrestricted_admin_sees_no_branch_dropdown(self):
        """Biriktirilmagan oddiy admin boshqa filiallarni tanlolmasligi kerak:
        filial dropdown'i ko'rinmaydi, faqat global kassa ochiladi."""
        self.client.force_login(self.regular)
        page = self.client.get(reverse("kassa_create"))
        self.assertNotContains(page, 'id="id_branch"')
        # Shar'hadan farqli, joriy shaxs hech qaysi filialga biriktirilmagan.
        form = page.context["form"]
        self.assertNotIn("branch", form.fields)

    def test_unrestricted_admin_not_in_owner_branch_map(self):
        """Biriktirilmagan admin `owner_branch_map`da bo'lmasligi kerak —
        aks holda JS uni barcha filiallarda adminga aylantirib qo'yadi."""
        from frontend.forms import KassaForm

        form = KassaForm(user=self.regular)
        self.assertNotIn(self.regular.pk, form.owner_branch_map)

    def test_assigned_admin_sees_only_own_branch(self):
        from .models import AdminBranch, Branch

        b1 = Branch.objects.create(name="F1")
        b2 = Branch.objects.create(name="F2")
        u = User.objects.create_user("amir_admin", password="pw")
        u.is_staff = True
        u.save()
        AdminBranch.objects.create(user=u, branch=b1)
        grant_permission(self.boss, u, "cashbox.create")

        self.client.force_login(u)
        page = self.client.get(reverse("kassa_create"))
        form = page.context["form"]
        self.assertIn("branch", form.fields)
        branch_ids = list(
            form.fields["branch"].queryset.values_list("pk", flat=True)
        )
        self.assertEqual(branch_ids, [b1.pk])
        self.assertNotIn(b2.pk, branch_ids)
        # O'zi faqat o'z filialida egasi bo'lib ko'rinadi
        self.assertEqual(form.owner_branch_map[u.pk], [b1.pk])