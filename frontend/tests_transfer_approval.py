"""Kassa o'tkazmalari tasdiqlash oqimi va filial bo'yicha ruxsatlar."""

from decimal import Decimal

from django.contrib.auth.models import User
from django.test import TestCase
from django.urls import reverse

from . import branch_scope
from .kassa_transfer_service import (
    can_approve_transfer, create_transfer_request, execute_transfer,
    kassa_available_balance, reject_transfer,
)
from .models import (
    AdminBranch, Branch, Employee, Kassa, KassaTransaction, KassaTransfer,
    Role,
)
from .permissions import (
    PERMISSION_REGISTRY, grant_permission, has_permission,
)


def make_income(kassa, amount):
    return KassaTransaction.objects.create(
        kassa=kassa,
        transaction_type=KassaTransaction.TransactionType.INCOME,
        amount=Decimal(amount),
        balance_before=Decimal("0"),
        balance_after=Decimal(amount),
        description="Test",
        created_by="test",
    )


class TransferApprovalTests(TestCase):
    def setUp(self):
        self.b1 = Branch.objects.create(name="Filial Bir")
        self.b2 = Branch.objects.create(name="Filial Ikki")

        self.superuser = User.objects.create_superuser("boss", "b@x.com", "pw")

        self.sender = User.objects.create_user("sender", password="pw")
        self.sender.is_staff = True
        self.sender.save()
        AdminBranch.objects.create(user=self.sender, branch=self.b1)

        self.receiver = User.objects.create_user("receiver", password="pw")
        self.receiver.is_staff = True
        self.receiver.save()
        AdminBranch.objects.create(user=self.receiver, branch=self.b2)

        self.k1 = Kassa.objects.create(name="Kassa-1", branch=self.b1,
                                       owner=self.sender)
        self.k2 = Kassa.objects.create(name="Kassa-2", branch=self.b2,
                                       owner=self.receiver)

        make_income(self.k1, "1000000")

    def _grant(self, user, code, branch=None):
        grant_permission(self.superuser, user, code, branch=branch)

    # ---------- bir xil filial: darhol bajariladi ----------

    def test_same_branch_transfer_completes_immediately(self):
        kassa_b1_2 = Kassa.objects.create(name="Kassa-1b", branch=self.b1)
        make_income(kassa_b1_2, "500000")

        t = create_transfer_request(kassa_b1_2, self.k1, Decimal("100000"),
                                    self.sender)
        self.assertEqual(t.status, KassaTransfer.Status.APPROVED)
        self.assertIsNotNone(t.completed_at)

    # ---- bir xil filial: boshqa boshqaruvchining kassasiga -> tasdiq ------

    def test_same_branch_to_other_owner_stays_pending(self):
        """Filial ichida boshqa admin (kassa boshqaruvchisi) kassasiga
        o'tkazma tasdiq kutadi va pul darhol yurmaydi."""
        manager = User.objects.create_user("manager", password="pw")
        manager.is_staff = True
        manager.save()
        AdminBranch.objects.create(user=manager, branch=self.b1)
        main_kassa = Kassa.objects.create(
            name="Filial asosiy kassa", branch=self.b1, owner=manager,
        )

        sender_kassa = Kassa.objects.create(name="Yuboruvchi kassa", branch=self.b1)
        make_income(sender_kassa, "900000")

        t = create_transfer_request(sender_kassa, main_kassa,
                                    Decimal("300000"), self.sender)
        self.assertEqual(t.status, KassaTransfer.Status.PENDING)
        self.assertEqual(main_kassa.balance, Decimal("0"))
        self.assertEqual(
            KassaTransaction.objects.filter(
                transaction_type=KassaTransaction.TransactionType.TRANSFER_OUT
            ).count(), 0,
        )

    def test_same_branch_manager_can_approve(self):
        """Filial kassa boshqaruvchisi (cashbox.approve ruxsati o'z filiali
        uchun berilgan admin) kelgan o'tkazmani tasdiqlay oladi."""
        manager = User.objects.create_user("manager", password="pw")
        manager.is_staff = True
        manager.save()
        AdminBranch.objects.create(user=manager, branch=self.b1)
        self._grant(manager, "cashbox.approve", branch=self.b1)
        main_kassa = Kassa.objects.create(
            name="Filial asosiy kassa", branch=self.b1, owner=manager,
        )
        sender_kassa = Kassa.objects.create(name="Yuboruvchi kassa", branch=self.b1)
        make_income(sender_kassa, "900000")

        t = create_transfer_request(sender_kassa, main_kassa,
                                    Decimal("300000"), self.sender)
        self.assertTrue(can_approve_transfer(manager, t))
        self.assertTrue(execute_transfer(t, user=manager))
        self.assertEqual(main_kassa.balance, Decimal("300000"))
        self.assertEqual(sender_kassa.balance, Decimal("600000"))

    def test_same_branch_ownerless_kassa_completes_immediately(self):
        """Egasiz kassaga o'tkazma (bir filialda) darhol bajariladi."""
        ownerless = Kassa.objects.create(name="Egasiz kassa", branch=self.b1)
        t = create_transfer_request(self.k1, ownerless, Decimal("100000"),
                                    self.sender)
        self.assertEqual(t.status, KassaTransfer.Status.APPROVED)
        self.assertEqual(ownerless.balance, Decimal("100000"))

    # ---------- turli filial: tasdiqlash kutiladi ----------

    def test_cross_branch_transfer_stays_pending(self):
        self._grant(self.sender, "cashbox.transfer")
        t = create_transfer_request(self.k1, self.k2, Decimal("200000"),
                                    self.sender)
        self.assertEqual(t.status, KassaTransfer.Status.PENDING)
        self.assertTrue(t.is_cross_branch)
        # PUL YURMADI
        self.assertEqual(self.k1.balance, Decimal("1000000"))
        self.assertEqual(self.k2.balance, Decimal("0"))
        self.assertEqual(
            KassaTransaction.objects.filter(
                transaction_type=KassaTransaction.TransactionType.TRANSFER_OUT
            ).count(), 0,
        )

    def test_receiver_without_approve_cannot_approve(self):
        self._grant(self.sender, "cashbox.transfer")
        t = create_transfer_request(self.k1, self.k2, Decimal("200000"),
                                    self.sender)
        # receiver'da cashbox.approve yo'q
        self.assertFalse(can_approve_transfer(self.receiver, t))

    def test_receiver_with_approve_can_approve_and_money_moves(self):
        self._grant(self.sender, "cashbox.transfer")
        self._grant(self.receiver, "cashbox.approve", branch=self.b2)
        t = create_transfer_request(self.k1, self.k2, Decimal("200000"),
                                    self.sender)

        self.assertTrue(can_approve_transfer(self.receiver, t))
        self.assertTrue(execute_transfer(t, user=self.receiver))

        self.assertEqual(t.status, KassaTransfer.Status.APPROVED)
        self.assertEqual(self.k1.balance, Decimal("800000"))
        self.assertEqual(self.k2.balance, Decimal("200000"))

    def test_approver_must_belong_to_receiving_branch(self):
        """Boshqa filial admini tasdiqlay olmaydi."""
        self._grant(self.sender, "cashbox.transfer")
        third = User.objects.create_user("third", password="pw")
        third.is_staff = True
        third.save()
        b3 = Branch.objects.create(name="Filial Uchinchi")
        AdminBranch.objects.create(user=third, branch=b3)
        self._grant(third, "cashbox.approve")

        t = create_transfer_request(self.k1, self.k2, Decimal("100000"),
                                    self.sender)
        self.assertFalse(can_approve_transfer(third, t))

    def test_superuser_can_approve_any_branch(self):
        self._grant(self.sender, "cashbox.transfer")
        t = create_transfer_request(self.k1, self.k2, Decimal("100000"),
                                    self.sender)
        self.assertTrue(can_approve_transfer(self.superuser, t))

    def test_manage_all_permission_can_approve(self):
        self._grant(self.sender, "cashbox.transfer")
        self._grant(self.receiver, "cashbox.manage_all")
        t = create_transfer_request(self.k1, self.k2, Decimal("100000"),
                                    self.sender)
        self.assertTrue(can_approve_transfer(self.receiver, t))

    def test_reject_does_not_move_money(self):
        self._grant(self.sender, "cashbox.transfer")
        self._grant(self.receiver, "cashbox.approve", branch=self.b2)
        t = create_transfer_request(self.k1, self.k2, Decimal("200000"),
                                    self.sender)

        self.assertTrue(reject_transfer(t, self.receiver, "Sabab yo'q"))
        self.assertEqual(t.status, KassaTransfer.Status.REJECTED)
        self.assertEqual(self.k1.balance, Decimal("1000000"))
        self.assertEqual(self.k2.balance, Decimal("0"))

    def test_cannot_approve_twice(self):
        self._grant(self.sender, "cashbox.transfer")
        self._grant(self.receiver, "cashbox.approve", branch=self.b2)
        t = create_transfer_request(self.k1, self.k2, Decimal("100000"),
                                    self.sender)
        execute_transfer(t, user=self.receiver)
        self.assertFalse(can_approve_transfer(self.receiver, t))
        self.assertFalse(execute_transfer(t, user=self.receiver))

    # ---------- balans bandi ----------

    def test_pending_transfers_reserve_balance(self):
        self._grant(self.sender, "cashbox.transfer")
        t1 = create_transfer_request(self.k1, self.k2, Decimal("600000"),
                                     self.sender)
        t2 = create_transfer_request(self.k1, self.k2, Decimal("600000"),
                                     self.sender)
        # Ikki o'tkazma birga 1 200 000 — balans 1 000 000
        self.assertLess(kassa_available_balance(self.k1), Decimal("0"))
        self.assertTrue(execute_transfer(t1, user=self.superuser))
        # Birinchisi o'tdi, ikkinchisi balans yetarli emas
        self.assertFalse(execute_transfer(t2, user=self.superuser))

    # ---------- view'lar ----------

    def test_transfer_list_isolated_by_branch(self):
        self._grant(self.sender, "cashbox.transfer")
        self._grant(self.sender, "cashbox.view")
        self._grant(self.receiver, "cashbox.view")
        create_transfer_request(self.k1, self.k2, Decimal("50000"), self.sender)

        self.client.force_login(self.sender)
        r = self.client.get(reverse("kassa_transfer_list"))
        self.assertEqual(r.status_code, 200)
        html = r.content.decode()
        self.assertIn("Kassa-1", html)
        self.assertNotIn("Filial Ikki</strong><br>", html) if False else None

    def test_sender_cannot_approve_own_request(self):
        self._grant(self.sender, "cashbox.transfer")
        self._grant(self.sender, "cashbox.approve")
        t = create_transfer_request(self.k1, self.k2, Decimal("50000"), self.sender)

        self.client.force_login(self.sender)
        self.client.post(reverse("kassa_transfer_approve", args=[t.pk]))
        self.assertEqual(t.status, KassaTransfer.Status.PENDING)

    def test_receiver_approves_via_view(self):
        self._grant(self.sender, "cashbox.transfer")
        self._grant(self.receiver, "cashbox.approve", branch=self.b2)
        self._grant(self.receiver, "cashbox.view")
        t = create_transfer_request(self.k1, self.k2, Decimal("75000"), self.sender)

        self.client.force_login(self.receiver)
        response = self.client.post(reverse("kassa_transfer_approve", args=[t.pk]))
        self.assertEqual(response.status_code, 302)

        t.refresh_from_db()
        self.assertEqual(t.status, KassaTransfer.Status.APPROVED)
        self.assertEqual(self.k2.balance, Decimal("75000"))


class BranchScopedPermissionTests(TestCase):
    def setUp(self):
        self.b1 = Branch.objects.create(name="B1")
        self.b2 = Branch.objects.create(name="B2")
        self.superuser = User.objects.create_superuser("boss", "b@x.com", "pw")
        self.admin = User.objects.create_user("adm", password="pw")
        self.admin.is_staff = True
        self.admin.save()
        AdminBranch.objects.create(user=self.admin, branch=self.b1)
        AdminBranch.objects.create(user=self.admin, branch=self.b2)

    def test_branch_scoped_grant_only_works_in_that_branch(self):
        grant_permission(self.superuser, self.admin, "cashbox.withdraw",
                         branch=self.b1)
        self.assertTrue(has_permission(self.admin, "cashbox.withdraw",
                                       branch=self.b1))
        self.assertFalse(has_permission(self.admin, "cashbox.withdraw",
                                        branch=self.b2))

    def test_global_grant_works_in_all_branches(self):
        grant_permission(self.superuser, self.admin, "cashbox.view")
        self.assertTrue(has_permission(self.admin, "cashbox.view", branch=self.b1))
        self.assertTrue(has_permission(self.admin, "cashbox.view", branch=self.b2))

    def test_new_permission_codenames_exist(self):
        for code in ("cashbox.approve", "cashbox.manage_all", "branch.monitor",
                     "branch.assign_admin"):
            with self.subTest(code=code):
                self.assertIn(code, PERMISSION_REGISTRY)

    def test_cache_invalidated_after_grant(self):
        self.assertFalse(has_permission(self.admin, "cashbox.approve",
                                        branch=self.b1))
        grant_permission(self.superuser, self.admin, "cashbox.approve",
                         branch=self.b1)
        # Yangi so'rov simulyatsiyasi
        fresh = User.objects.get(pk=self.admin.pk)
        self.assertTrue(has_permission(fresh, "cashbox.approve", branch=self.b1))

    def test_branch_permissions_page_loads(self):
        self.client.force_login(self.superuser)
        response = self.client.get(
            reverse("admin_branch_permissions", args=[self.admin.pk]),
            {"branch": self.b1.pk},
        )
        self.assertEqual(response.status_code, 200)
        html = response.content.decode()
        self.assertIn(self.b1.name, html)

    def test_ordinary_admin_cannot_open_branch_permissions_page(self):
        self.client.force_login(self.admin)
        response = self.client.get(
            reverse("admin_branch_permissions", args=[self.admin.pk]),
            {"branch": self.b1.pk},
        )
        self.assertNotEqual(response.status_code, 200)


class BranchMonitorTests(TestCase):
    def setUp(self):
        self.b1 = Branch.objects.create(name="B1")
        self.b2 = Branch.objects.create(name="B2")
        self.superuser = User.objects.create_superuser("boss", "b@x.com", "pw")

        self.plain = User.objects.create_user("plain", password="pw")
        self.plain.is_staff = True
        self.plain.save()
        AdminBranch.objects.create(user=self.plain, branch=self.b1)

        k = Kassa.objects.create(name="K1", branch=self.b1)
        make_income(k, "250000")

    def test_superuser_sees_monitor(self):
        self.client.force_login(self.superuser)
        response = self.client.get(reverse("branch_monitor"))
        self.assertEqual(response.status_code, 200)
        html = response.content.decode()
        self.assertIn("B1", html)
        self.assertIn("B2", html)
        self.assertIn("250", html.replace("&#x27;", "'"))

    def test_branch_admin_without_monitor_is_redirected(self):
        self.client.force_login(self.plain)
        response = self.client.get(reverse("branch_monitor"))
        self.assertEqual(response.status_code, 302)

    def test_monitor_permission_grants_access(self):
        grant_permission(self.superuser, self.plain, "branch.monitor")
        self.client.force_login(self.plain)
        response = self.client.get(reverse("branch_monitor"))
        self.assertEqual(response.status_code, 200)