"""Asosiy (bosh) kassa xavfsizligi.

Qoidalar:
  - Asosiy kassani faqat rahbar (super admin) yaratadi/tahrirlaydi:
    oddiy admin uchun `is_main` maydoni ko'rinmaydi va tinglanmaydi.
  - Asosiy kassa faqat 'cashbox.view_main' huquqi bor xodimlarga ko'rinadi;
    filial doirasi unga taluqli emas.
  - Asosiy kassaga pul o'tkazish 'cashbox.transfer_main' huquqi bilan
    cheklanadi (view + service darajasida majburiy).
  - Asosiy kassadan pul o'tkazish faqat rahbar / 'cashbox.manage_all' uchun.
"""

from decimal import Decimal

from django.contrib.auth.models import User
from django.core.exceptions import PermissionDenied
from django.test import TestCase
from django.urls import reverse

from .models import Kassa, KassaTransaction, KassaTransfer
from .permissions import grant_permission, has_permission

from .kassa_transfer_service import create_transfer_request


class KassaMainPermissionTests(TestCase):
    def setUp(self):
        self.boss = User.objects.create_superuser("boss", "b@x.com", "pw")

        self.main = Kassa.objects.create(
            name="Asosiy kassa", owner=self.boss, is_main=True
        )
        self.branch = Kassa.objects.create(
            name="Filial kassasi", owner=self.boss
        )

        self.admin = User.objects.create_user("raxsatli_admin", password="pw")
        self.admin.is_staff = True
        self.admin.save()

        self.limited = User.objects.create_user("cheklangan_admin", password="pw")
        self.limited.is_staff = True
        self.limited.save()

    # ---------- Faqat rahbar asosiy kassa yaratadi ------------------------

    def test_boss_can_create_main_kassa(self):
        self.client.force_login(self.boss)
        resp = self.client.post(reverse("kassa_create"), {
            "name": "Yangi asosiy",
            "owner": str(self.boss.pk),
            "branch": "",
            "is_active": "on",
            "is_main": "on",
        })
        self.assertIn(resp.status_code, (200, 302))
        self.assertTrue(
            Kassa.objects.filter(name="Yangi asosiy", is_main=True).exists()
        )

    def test_regular_admin_sees_no_is_main_field(self):
        grant_permission(self.boss, self.admin, "cashbox.create")
        self.client.force_login(self.admin)
        page = self.client.get(reverse("kassa_create"))
        self.assertEqual(page.status_code, 200)
        form = page.context["form"]
        self.assertNotIn("is_main", form.fields)

    def test_regular_admin_cannot_set_is_main(self):
        grant_permission(self.boss, self.admin, "cashbox.create")
        self.client.force_login(self.admin)
        resp = self.client.post(reverse("kassa_create"), {
            "name": "Qalbakilikan",
            "owner": str(self.admin.pk),
            "branch": "",
            "is_active": "on",
            "is_main": "on",
        })
        self.assertIn(resp.status_code, (200, 302))
        kassa = Kassa.objects.filter(name="Qalbakilikan").first()
        self.assertIsNotNone(kassa)
        self.assertFalse(kassa.is_main)  # oddiy admin asosiy qila olmaydi

    # ---------- Ko'rish faqat 'cashbox.view_main' egalariga ---------------

    def test_main_kassa_hidden_without_view_main(self):
        grant_permission(self.boss, self.limited, "cashbox.view")
        self.client.force_login(self.limited)
        resp = self.client.get(reverse("kassa_list"))
        self.assertEqual(resp.status_code, 200)
        self.assertNotContains(resp, "Asosiy kassa")
        self.assertContains(resp, "Filial kassasi")

    def test_main_kassa_visible_with_view_main(self):
        grant_permission(self.boss, self.limited, "cashbox.view")
        grant_permission(self.boss, self.limited, "cashbox.view_main")
        self.client.force_login(self.limited)
        resp = self.client.get(reverse("kassa_list"))
        self.assertEqual(resp.status_code, 200)
        self.assertContains(resp, "Asosiy kassa")

    def test_main_kassa_detail_requires_view_main(self):
        grant_permission(self.boss, self.limited, "cashbox.view")
        self.client.force_login(self.limited)
        # Oddiy filial kassasi ochiq
        ok = self.client.get(reverse("kassa_detail", args=[self.branch.pk]))
        self.assertEqual(ok.status_code, 200)
        # Asosiy kassa — 403
        denied = self.client.get(reverse("kassa_detail", args=[self.main.pk]))
        self.assertEqual(denied.status_code, 403)

    # ---------- O'tkazish faqat 'cashbox.transfer_main' egalariga ---------

    def test_transfer_to_main_blocked_without_transfer_main(self):
        grant_permission(self.boss, self.limited, "cashbox.view")
        grant_permission(self.boss, self.limited, "cashbox.transfer")
        KassaTransaction.objects.create(
            kassa=self.branch, transaction_type="income", amount=Decimal("500000")
        )
        self.client.force_login(self.limited)
        resp = self.client.post(reverse("kassa_transfer", args=[self.branch.pk]), {
            "to_kassa": str(self.main.pk),
            "amount": "200000",
            "description": "asosiyga",
        })
        self.assertEqual(resp.status_code, 302)
        self.assertFalse(KassaTransfer.objects.exists())

    def test_transfer_to_main_allowed_with_transfer_main(self):
        grant_permission(self.boss, self.admin, "cashbox.view")
        grant_permission(self.boss, self.admin, "cashbox.transfer")
        grant_permission(self.boss, self.admin, "cashbox.transfer_main")
        KassaTransaction.objects.create(
            kassa=self.branch, transaction_type="income", amount=Decimal("500000")
        )
        self.client.force_login(self.admin)
        resp = self.client.post(reverse("kassa_transfer", args=[self.branch.pk]), {
            "to_kassa": str(self.main.pk),
            "amount": "200000",
            "description": "asosiyga",
        })
        self.assertEqual(resp.status_code, 302)
        t = KassaTransfer.objects.first()
        self.assertIsNotNone(t)
        self.assertEqual(t.from_kassa, self.branch)
        self.assertEqual(t.to_kassa, self.main)
        self.assertEqual(t.status, KassaTransfer.Status.APPROVED)

    def test_transfer_form_target_includes_main_only_with_transfer_main(self):
        grant_permission(self.boss, self.admin, "cashbox.view")
        grant_permission(self.boss, self.admin, "cashbox.transfer_main")
        self.client.force_login(self.admin)
        page = self.client.get(reverse("kassa_detail", args=[self.branch.pk]))
        form = page.context["transfer_form"]
        target_ids = list(
            form.fields["to_kassa"].queryset.values_list("pk", flat=True)
        )
        self.assertIn(self.main.pk, target_ids)

    def test_transfer_form_target_excludes_main_without_transfer_main(self):
        grant_permission(self.boss, self.limited, "cashbox.view")
        self.client.force_login(self.limited)
        page = self.client.get(reverse("kassa_detail", args=[self.branch.pk]))
        form = page.context["transfer_form"]
        target_ids = list(
            form.fields["to_kassa"].queryset.values_list("pk", flat=True)
        )
        self.assertNotIn(self.main.pk, target_ids)

    # ---------- Service darajasidagi majburiy tekshiruv ------------------

    def test_service_denies_transfer_to_main_without_permission(self):
        grant_permission(self.boss, self.limited, "cashbox.view")
        with self.assertRaises(PermissionDenied):
            create_transfer_request(
                self.branch, self.main, Decimal("100000"), self.limited
            )

    def test_service_denies_transfer_from_main_without_manage_all(self):
        grant_permission(self.boss, self.limited, "cashbox.view")
        with self.assertRaises(PermissionDenied):
            create_transfer_request(
                self.main, self.branch, Decimal("100000"), self.limited
            )

    def test_service_allows_boss_transfer_to_main(self):
        KassaTransaction.objects.create(
            kassa=self.branch, transaction_type="income", amount=Decimal("300000")
        )
        t = create_transfer_request(
            self.branch, self.main, Decimal("100000"), self.boss
        )
        self.assertIsNotNone(t)
        self.assertEqual(t.to_kassa, self.main)

    # ---------- Yangi huquqlar delegatsiyada ishlaydi ---------------------

    def test_delegation_of_new_permissions(self):
        target = User.objects.create_user("target", password="pw")
        target.is_staff = True
        target.save()

        # Huquqi bo'lmagan admin bera olmaydi
        self.assertFalse(grant_permission(self.limited, target, "cashbox.view_main"))
        self.assertFalse(grant_permission(self.limited, target, "cashbox.transfer_main"))

        # Boss (super admin) bera oladi va berilgan ishlaydi
        self.assertTrue(grant_permission(self.boss, target, "cashbox.view_main"))
        self.assertTrue(grant_permission(self.boss, target, "cashbox.transfer_main"))
        self.assertTrue(has_permission(target, "cashbox.view_main"))
        self.assertTrue(has_permission(target, "cashbox.transfer_main"))

        # Yangi asosiy-kassa kirim/chiqim ruxsatlari ham delegatsiya qilinadi
        self.assertTrue(grant_permission(self.boss, target, "cashbox.main_income"))
        self.assertTrue(grant_permission(self.boss, target, "cashbox.main_expense"))
        self.assertTrue(has_permission(target, "cashbox.main_income"))
        self.assertTrue(has_permission(target, "cashbox.main_expense"))


class MainKassaIncomeExpensePermissionTests(TestCase):
    """Asosiy (bosh) kassada kirim/chiqim alohida ruxsatlar bilan cheklanadi."""

    def setUp(self):
        self.boss = User.objects.create_superuser("boss", "b@x.com", "pw")
        self.main = Kassa.objects.create(
            name="Asosiy kassa", owner=self.boss, is_main=True
        )
        self.admin = User.objects.create_user("operator", password="pw")
        self.admin.is_staff = True
        self.admin.save()
        # Ko'rish va kassa ochish huquqlari bor, lekin main_* yo'q.
        grant_permission(self.boss, self.admin, "cashbox.view")
        grant_permission(self.boss, self.admin, "cashbox.view_main")
        grant_permission(self.boss, self.admin, "cashbox.create")
        grant_permission(self.boss, self.admin, "expense.regular")

    def _income(self, amount):
        KassaTransaction.objects.create(
            kassa=self.main,
            transaction_type=KassaTransaction.TransactionType.INCOME,
            amount=Decimal(amount),
            balance_before=Decimal("0"),
            balance_after=Decimal(amount),
            description="test",
            created_by="test",
        )

    def test_income_blocked_without_main_income(self):
        self.client.force_login(self.admin)
        self.client.post(reverse("kassa_add_income", args=[self.main.pk]), {
            "amount": "100000", "description": "kirim",
        })
        self.assertFalse(
            KassaTransaction.objects.filter(
                kassa=self.main,
                transaction_type=KassaTransaction.TransactionType.INCOME,
            ).exists()
        )

    def test_income_allowed_with_main_income(self):
        grant_permission(self.boss, self.admin, "cashbox.main_income")
        self.client.force_login(self.admin)
        self.client.post(reverse("kassa_add_income", args=[self.main.pk]), {
            "amount": "100000", "description": "kirim",
        })
        self.assertTrue(
            KassaTransaction.objects.filter(
                kassa=self.main,
                transaction_type=KassaTransaction.TransactionType.INCOME,
            ).exists()
        )

    def test_expense_blocked_without_main_expense(self):
        self._income("500000")
        self.client.force_login(self.admin)
        self.client.post(reverse("kassa_add_expense", args=[self.main.pk]), {
            "amount": "100000", "description": "chiqim",
        })
        self.assertFalse(
            KassaTransaction.objects.filter(
                kassa=self.main,
                transaction_type=KassaTransaction.TransactionType.EXPENSE,
            ).exists()
        )

    def test_expense_allowed_with_main_expense(self):
        self._income("500000")
        grant_permission(self.boss, self.admin, "cashbox.main_expense")
        self.client.force_login(self.admin)
        self.client.post(reverse("kassa_add_expense", args=[self.main.pk]), {
            "amount": "100000", "description": "chiqim",
        })
        self.assertTrue(
            KassaTransaction.objects.filter(
                kassa=self.main,
                transaction_type=KassaTransaction.TransactionType.EXPENSE,
            ).exists()
        )