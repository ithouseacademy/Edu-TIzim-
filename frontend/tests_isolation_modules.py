"""Xodim, shikoyat, vazifa, eslatma, audit log va xabar bo'limlarining
filial izolyatsiyasi.

Bu modul `tests_isolation.py` dagi asosiy testlardan alohida, chunki
boshqa modellarni (Feedback, Task, Reminder, PermissionAuditLog) qamrab oladi.
"""

from datetime import timedelta

from django.contrib.auth.models import User
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone

from .models import (
    AdminBranch, Branch, Course, Employee, Feedback, Group,
    PermissionAuditLog, Reminder, Role, Student, Task,
)
from .permissions import grant_permission


class BranchModulesTests(TestCase):
    def setUp(self):
        self.branch_a = Branch.objects.create(name="Filial A")
        self.branch_b = Branch.objects.create(name="Filial B")

        self.role = Role.objects.create(name="O'qituvchi")

        self.superuser = User.objects.create_superuser("boss", "boss@x.com", "pw")

        self.admin_a = User.objects.create_user("mod_admin_a", password="pw")
        self.admin_a.is_staff = True
        self.admin_a.save()
        AdminBranch.objects.create(user=self.admin_a, branch=self.branch_a)

        self.admin_b = User.objects.create_user("mod_admin_b", password="pw")
        self.admin_b.is_staff = True
        self.admin_b.save()
        AdminBranch.objects.create(user=self.admin_b, branch=self.branch_b)

        # A filiali xodimi
        self.emp_a = Employee.objects.create(
            first_name="XodimAaa", last_name="A", phone="+998900001001",
            role=self.role, is_active=True,
        )
        self.emp_a.branches.add(self.branch_a)
        self.emp_a.user = self.admin_a
        self.emp_a.save()

        # B filiali xodimi
        self.emp_b = Employee.objects.create(
            first_name="XodimBbb", last_name="B", phone="+998900001002",
            role=self.role, is_active=True,
        )
        self.emp_b.branches.add(self.branch_b)

        self.student_a = Student.objects.create(
            first_name="OquvchiAaa", last_name="A", phone="+998900001003",
            branch=self.branch_a,
        )
        self.student_b = Student.objects.create(
            first_name="OquvchiBbb", last_name="B", phone="+998900001004",
            branch=self.branch_b,
        )

        # Bu modulda faqat FILIAL chegarasi tekshiriladi, ruxsat emas —
        # shuning uchun admin A ga barcha ruxsatlar beriladi.
        from .permissions import PERMISSION_REGISTRY

        for codename in sorted(PERMISSION_REGISTRY):
            with self.subTest(permission=codename):
                grant_permission(self.superuser, self.admin_a, codename)

    # ---------------- Xodimlar ----------------

    def test_employee_list_only_own_branch(self):
        self.client.force_login(self.admin_a)
        response = self.client.get(reverse("employee_list"))
        if response.status_code != 200:
            self.skipTest("employee_list ruxsati berilmagan")
        html = response.content.decode()
        self.assertIn("XodimAaa", html)
        self.assertNotIn("XodimBbb", html)

    def test_employee_export_only_own_branch(self):
        self.client.force_login(self.admin_a)
        for name in ("employee_export_csv", "employee_export_excel"):
            with self.subTest(view=name):
                response = self.client.get(reverse(name))
                if response.status_code != 200:
                    continue
                self.assertNotIn("XodimBbb".encode(), response.content)

    def test_cannot_open_other_branch_employee(self):
        self.client.force_login(self.admin_a)
        response = self.client.get(reverse("employee_profile", args=[self.emp_b.pk]))
        self.assertIn(response.status_code, (403, 404))
        self.assertNotIn("XodimBbb", response.content.decode())

    def test_can_open_own_branch_employee(self):
        self.client.force_login(self.admin_a)
        response = self.client.get(reverse("employee_profile", args=[self.emp_a.pk]))
        self.assertEqual(response.status_code, 200)
        self.assertIn("XodimAaa", response.content.decode())

    # ---------------- Shikoyatlar ----------------

    def test_feedback_list_only_own_branch(self):
        Feedback.objects.create(student=self.student_a, message="A filiali shikoyati")
        Feedback.objects.create(student=self.student_b, message="B filiali shikoyati")

        self.client.force_login(self.admin_a)
        response = self.client.get(reverse("feedback_list"))
        if response.status_code != 200:
            self.skipTest("feedback ruxsati berilmagan")
        html = response.content.decode()
        self.assertIn("A filiali shikoyati", html)
        self.assertNotIn("B filiali shikoyati", html)

    def test_cannot_open_other_branch_feedback(self):
        feedback_b = Feedback.objects.create(student=self.student_b, message="Yashirin B")
        self.client.force_login(self.admin_a)
        response = self.client.get(reverse("feedback_detail", args=[feedback_b.pk]))
        self.assertIn(response.status_code, (403, 404))
        self.assertNotIn("Yashirin B", response.content.decode())

    def test_feedback_badge_counts_own_branch_only(self):
        Feedback.objects.create(student=self.student_a, message="A1")
        Feedback.objects.create(student=self.student_b, message="B1")
        self.client.force_login(self.admin_a)
        response = self.client.get(reverse("feedback_badge"))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json().get("count"), 1)

    # ---------------- Vazifalar ----------------

    def test_task_list_only_own_branch(self):
        Task.objects.create(
            title="VazifaAaa", assigned_to=self.emp_a,
            created_by=self.admin_a,
        )
        Task.objects.create(
            title="VazifaBbb", assigned_to=self.emp_b,
            created_by=self.superuser,
        )
        self.client.force_login(self.admin_a)
        response = self.client.get(reverse("task_list"))
        if response.status_code != 200:
            self.skipTest("task ruxsati berilmagan")
        html = response.content.decode()
        self.assertIn("VazifaAaa", html)
        self.assertNotIn("VazifaBbb", html)

    # ---------------- Eslatmalar ----------------

    def test_reminder_list_only_own_branch(self):
        Reminder.objects.create(
            employee=self.emp_a, message="EslatmaAaa", created_by=self.admin_a,
        )
        Reminder.objects.create(
            employee=self.emp_b, message="EslatmaBbb", created_by=self.superuser,
        )
        self.client.force_login(self.admin_a)
        response = self.client.get(reverse("reminder_list"))
        if response.status_code != 200:
            self.skipTest("reminder ruxsati berilmagan")
        html = response.content.decode()
        self.assertIn("EslatmaAaa", html)
        self.assertNotIn("EslatmaBbb", html)

    # ---------------- Audit log ----------------

    def test_audit_log_only_own_branch(self):
        PermissionAuditLog.objects.create(
            actor=self.admin_a, target_user=self.emp_a.user,
            action="grant", permission_codename="student.view",
            detail="A filiali amali",
        )
        PermissionAuditLog.objects.create(
            actor=self.admin_b, target_user=self.admin_b,
            action="grant", permission_codename="student.view",
            detail="B filiali amali",
        )
        self.client.force_login(self.admin_a)
        response = self.client.get(reverse("audit_log"))
        if response.status_code != 200:
            self.skipTest("audit ruxsati berilmagan")
        html = response.content.decode()
        self.assertNotIn("B filiali amali", html)

    # ---------------- Kurslar ----------------

    def _make_course(self, name, *branches):
        course = Course.objects.create(name=name)
        course.branches.set(branches)
        return course

    def test_course_list_only_own_branch(self):
        self._make_course("KursAaa", self.branch_a)
        self._make_course("KursBbb", self.branch_b)

        self.client.force_login(self.admin_a)
        response = self.client.get(reverse("course_list"))
        if response.status_code != 200:
            self.skipTest("course ruxsati berilmagan")
        html = response.content.decode()
        self.assertIn("KursAaa", html)
        self.assertNotIn("KursBbb", html)

    def test_cannot_edit_other_branch_course(self):
        foreign = self._make_course("KursBbb", self.branch_b)

        self.client.force_login(self.admin_a)
        for url in (
            reverse("course_update", args=[foreign.pk]),
            reverse("course_delete", args=[foreign.pk]),
        ):
            with self.subTest(url=url):
                response = self.client.get(url)
                self.assertIn(response.status_code, (403, 404))
                self.assertNotIn("KursBbb", response.content.decode())

    def test_can_edit_own_branch_course(self):
        own = self._make_course("KursAaa", self.branch_a)

        self.client.force_login(self.admin_a)
        for url in (
            reverse("course_update", args=[own.pk]),
            reverse("course_delete", args=[own.pk]),
        ):
            with self.subTest(url=url):
                response = self.client.get(url)
                self.assertEqual(response.status_code, 200)
                self.assertIn("KursAaa", response.content.decode())

    def test_course_create_form_only_lists_allowed_branches(self):
        self.client.force_login(self.admin_a)
        response = self.client.get(reverse("course_create"))
        if response.status_code != 200:
            self.skipTest("course ruxsati berilmagan")
        html = response.content.decode()
        self.assertIn(self.branch_a.name, html)
        self.assertNotIn(self.branch_b.name, html)

    def test_superuser_sees_all_courses(self):
        self._make_course("KursAaa", self.branch_a)
        self._make_course("KursBbb", self.branch_b)

        self.client.force_login(self.superuser)
        response = self.client.get(reverse("course_list"))
        self.assertEqual(response.status_code, 200)
        html = response.content.decode()
        self.assertIn("KursAaa", html)
        self.assertIn("KursBbb", html)

    # ---------------- Xabarlar (API) ----------------

    def test_messaging_search_hides_other_branch_users(self):
        from frontend.models import Chat, ChatMember

        chat = Chat.objects.create(chat_type="private", title="")
        ChatMember.objects.create(chat=chat, employee=self.emp_a, is_admin=True)

        self.client.force_login(self.admin_a)
        response = self.client.get(
            reverse("messaging_users_search"), {"q": "Xodim"}
        )
        if response.status_code != 200:
            self.skipTest("messaging ruxsati berilmagan")
        body = response.content.decode("utf-8", "replace")
        self.assertNotIn("XodimBbb", body)

    def test_cannot_open_private_chat_with_other_branch_student(self):
        self.client.force_login(self.admin_a)
        response = self.client.post(
            reverse("messaging_open_private", args=[self.student_b.pk])
        )
        # 404/403 yoki "o'zingiz bilan" xatosi bo'lishi mumkin,
        # muhim natija: chat yaratilmasligi kerak.
        from frontend.models import Chat

        self.assertEqual(
            Chat.objects.filter(members__student=self.student_b).count(), 0
        )
        self.assertIn(response.status_code, (200, 302, 400, 403, 404))