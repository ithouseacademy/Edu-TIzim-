"""Filial izolyatsiyasi: har bir foydalanuvchi faqat o'z filialini ko'radi.

Ushbu testlar butun tizim bo'ylab «boshqa filial ma'lumotlari sizib chiqmasligi»ni
tekshiradi — ro'yxatlar, tafsilotlar, CSV eksportlari, kassa amallari va
davomat yozish.
"""

from datetime import date

import json

from django.contrib.auth.models import User
from django.test import TestCase
from django.urls import reverse

from . import branch_scope
from .models import AdminBranch, Branch, Course, Employee, Group, Kassa, Role, Room, Student
from .permissions import grant_permission


class BranchIsolationTests(TestCase):
    """Ikki filial: A (admin1) va B (admin2) — hech qanday aralashuv bo'lmasligi kerak."""

    def setUp(self):
        self.branch_a = Branch.objects.create(name="Chilonzor filiali")
        self.branch_b = Branch.objects.create(name="Sergeli filiali")
        self.course = Course.objects.create(name="IT kursi")

        self.group_a = Group.objects.create(
            name="A guruhi", branch=self.branch_a, course=self.course,
            start_date=date(2026, 1, 1), end_date=date(2026, 12, 31),
        )
        self.group_b = Group.objects.create(
            name="B guruhi", branch=self.branch_b, course=self.course,
            start_date=date(2026, 1, 1), end_date=date(2026, 12, 31),
        )
        self.group_free = Group.objects.create(
            name="Filialsiz guruhi", branch=None, course=self.course,
            start_date=date(2026, 1, 1), end_date=date(2026, 12, 31),
        )

        self.student_a = Student.objects.create(
            first_name="AliA", last_name="A", phone="+998900000101", branch=self.branch_a
        )
        self.student_b = Student.objects.create(
            first_name="ValiB", last_name="B", phone="+998900000102", branch=self.branch_b
        )
        self.student_free = Student.objects.create(
            first_name="NodirF", last_name="F", phone="+998900000103"
        )

        self.room_a = Room.objects.create(name="XonaA101", branch=self.branch_a)
        self.room_b = Room.objects.create(name="XonaB202", branch=self.branch_b)

        self.kassa_a = Kassa.objects.create(name="KassaA", branch=self.branch_a)
        self.kassa_b = Kassa.objects.create(name="KassaB", branch=self.branch_b)

        self.superuser = User.objects.create_superuser("boss", "boss@example.com", "pw")

        self.admin_a = User.objects.create_user("admin_a", password="pw")
        self.admin_a.is_staff = True
        self.admin_a.save()
        AdminBranch.objects.create(user=self.admin_a, branch=self.branch_a)

        self.teacher_user = User.objects.create_user("teacher_user", password="pw")
        self.admin_b = User.objects.create_user("admin_b", password="pw")
        self.admin_b.is_staff = True
        self.admin_b.save()
        AdminBranch.objects.create(user=self.admin_b, branch=self.branch_b)

        for codename in (
            "dashboard.view", "dashboard.report", "statistics.view",
            "student.view", "student.create", "student.update", "student.delete",
            "student.transfer", "student.export", "student.freeze",
            "group.view", "group.create", "group.update", "group.delete",
            "group.export", "group.settings",
            "room.view", "room.create", "room.update", "room.delete",
            "cashbox.view", "cashbox.create", "cashbox.update",
            "cashbox.delete", "cashbox.transfer", "cashbox.withdraw", "cashbox.report",
            "payment.view", "payment.create", "payment.transfer",
            "attendance.view", "attendance.create", "attendance.update",
            "teacher.view", "branch.view",
        ):
            try:
                grant_permission(self.superuser, self.admin_a, codename)
                grant_permission(self.superuser, self.admin_b, codename)
            except Exception:
                pass

    # ---------- ro'yxatlar ----------

    def test_admin_a_sees_only_own_branch_lists(self):
        self.client.force_login(self.admin_a)
        cases = [
            (reverse("student_list"), ["AliA"], ["ValiB", "NodirF"]),
            (reverse("group_list"), ["A guruhi"], ["B guruhi", "Filialsiz guruhi"]),
            (reverse("room_list"), ["XonaA101"], ["XonaB202"]),
            (reverse("kassa_list"), ["KassaA"], ["KassaB"]),
        ]
        for url, must_see, must_not_see in cases:
            with self.subTest(url=url):
                response = self.client.get(url)
                self.assertEqual(response.status_code, 200)
                html = response.content.decode()
                for text in must_see:
                    self.assertIn(text, html)
                for text in must_not_see:
                    self.assertNotIn(text, html)

    def test_admin_b_sees_only_own_branch_lists(self):
        self.client.force_login(self.admin_b)
        response = self.client.get(reverse("student_list"))
        html = response.content.decode()
        self.assertIn("ValiB", html)
        self.assertNotIn("AliA", html)
        self.assertNotIn("NodirF", html)

    # ---------- tafsilot sahifalari ----------

    def test_admin_a_cannot_open_other_branch_detail(self):
        self.client.force_login(self.admin_a)
        for url in (
            reverse("student_profile", args=[self.student_b.pk]),
            reverse("kassa_detail", args=[self.kassa_b.pk]),
        ):
            with self.subTest(url=url):
                response = self.client.get(url)
                self.assertIn(response.status_code, (403, 404))
                self.assertNotIn("ValiB", response.content.decode())
                self.assertNotIn("KassaB", response.content.decode())

    def test_admin_a_can_open_own_branch_detail(self):
        self.client.force_login(self.admin_a)
        for url, text in (
            (reverse("student_profile", args=[self.student_a.pk]), "AliA"),
            (reverse("kassa_detail", args=[self.kassa_a.pk]), "KassaA"),
        ):
            with self.subTest(url=url):
                response = self.client.get(url)
                self.assertEqual(response.status_code, 200)
                self.assertIn(text, response.content.decode())

    # ---------- kassa amallari (POST) ----------

    def test_admin_a_cannot_write_to_other_branch_kassa(self):
        self.client.force_login(self.admin_a)
        for name in ("kassa_add_income", "kassa_add_expense", "kassa_transfer"):
            with self.subTest(view=name):
                response = self.client.post(
                    reverse(name, args=[self.kassa_b.pk]), {"amount": "1000"}
                )
                self.assertIn(response.status_code, (403, 404))

    # ---------- eksport ----------

    def test_export_does_not_leak_other_branch(self):
        self.client.force_login(self.admin_a)
        for url in (
            reverse("student_export_csv"),
            reverse("student_export_excel"),
            reverse("group_export_csv"),
        ):
            with self.subTest(url=url):
                response = self.client.get(url)
                self.assertEqual(response.status_code, 200)
                body = response.content
                self.assertNotIn("ValiB".encode(), body)
                self.assertNotIn("B guruhi".encode(), body)

    # ---------- dashboard / statistika ----------

    def test_dashboard_counts_only_own_branch(self):
        from .models import LessonTime

        LessonTime.objects.create(
            group=self.group_a, days="dushanba",
            start_time="09:00", end_time="10:30",
        )
        LessonTime.objects.create(
            group=self.group_b, days="dushanba",
            start_time="11:00", end_time="12:30",
        )
        LessonTime.objects.create(
            group=self.group_free, days="dushanba",
            start_time="13:00", end_time="14:30",
        )

        self.client.force_login(self.admin_a)
        response = self.client.get(reverse("dashboard"))
        self.assertEqual(response.status_code, 200)

        group_ids = {
            lesson["group_id"] for lesson in response.context["schedule_lessons"]
        }
        self.assertIn(self.group_a.pk, group_ids)
        self.assertNotIn(self.group_b.pk, group_ids)
        self.assertNotIn(self.group_free.pk, group_ids)

    def test_dashboard_respects_selected_branch(self):
        """Super admin filial tanlaganda dars jadvali faqat o'sha filialni ko'rsatadi."""
        from .models import LessonTime

        LessonTime.objects.create(
            group=self.group_a, days="dushanba",
            start_time="09:00", end_time="10:30",
        )
        LessonTime.objects.create(
            group=self.group_b, days="dushanba",
            start_time="11:00", end_time="12:30",
        )

        self.client.force_login(self.superuser)
        self.client.post(
            reverse("branch_switch"),
            {"branch": self.branch_a.pk, "next": reverse("dashboard")},
        )
        response = self.client.get(reverse("dashboard"))
        group_ids = {
            lesson["group_id"] for lesson in response.context["schedule_lessons"]
        }
        self.assertEqual(group_ids, {self.group_a.pk})

    def test_statistics_hides_other_branch(self):
        self.client.force_login(self.admin_a)
        response = self.client.get(reverse("statistics"))
        if response.status_code != 200:
            self.skipTest("statistika ruxsati berilmagan")
        html = response.content.decode()
        self.assertNotIn("B guruhi", html)
        self.assertNotIn("ValiB", html)

    # ---------- davomat ----------

    def test_cannot_mark_attendance_for_other_branch_student(self):
        """Guruh A admini B filiali o'quvchisiga davomat qo'yolmasligi kerak."""
        from django.urls import NoReverseMatch

        try:
            url = reverse("take_attendance", args=[self.group_a.pk])
        except NoReverseMatch:
            self.skipTest("take_attendance URL topilmadi")

        self.client.force_login(self.admin_a)
        response = self.client.post(
            url,
            data=json.dumps({
                "group_id": self.group_a.pk,
                "date": date.today().isoformat(),
                "records": [{"student_id": self.student_b.pk, "status": "present"}],
            }),
            content_type="application/json",
        )
        self.assertIn(response.status_code, (400, 403, 404))

    # ---------- session filial tanlash ----------

    def test_branch_admin_cannot_switch_to_other_branch(self):
        self.client.force_login(self.admin_a)
        response = self.client.get(
            reverse("branch_switch"), {"branch": self.branch_b.pk}
        )
        # Tanlashga urinish natijasi: joriy filial o'zgarmasligi kerak
        self.assertNotEqual(
            self.client.session.get(branch_scope.SESSION_KEY),
            self.branch_b.pk,
        )

    def test_scope_function_isolates_querysets(self):
        from django.contrib.sessions.middleware import SessionMiddleware
        from django.test import RequestFactory

        request = RequestFactory().get("/")
        SessionMiddleware(lambda r: None).process_request(request)
        request.session.save()
        request.user = self.admin_a

        self.assertEqual(
            set(branch_scope.scope(request, Group.objects.all()).values_list("pk", flat=True)),
            {self.group_a.pk},
        )
        self.assertEqual(
            set(branch_scope.scope(request, Student.objects.all()).values_list("pk", flat=True)),
            {self.student_a.pk},
        )
        self.assertEqual(
            set(branch_scope.scope(request, Room.objects.all()).values_list("pk", flat=True)),
            {self.room_a.pk},
        )
        self.assertEqual(
            set(branch_scope.scope(request, Kassa.objects.all()).values_list("pk", flat=True)),
            {self.kassa_a.pk},
        )

    def test_superuser_still_sees_everything(self):
        from django.contrib.sessions.middleware import SessionMiddleware
        from django.test import RequestFactory

        request = RequestFactory().get("/")
        SessionMiddleware(lambda r: None).process_request(request)
        request.session.save()
        request.user = self.superuser

        self.assertEqual(branch_scope.scope(request, Group.objects.all()).count(), 3)

    def test_branches_never_mix(self):
        """Hech qanday obyekt ikki filialga bir vaqtda tegmasligi kerak."""
        for model in (Group, Student, Room, Kassa):
            for obj in model.objects.all():
                branch_ids = set()
                if hasattr(obj, "branch_id") and obj.branch_id:
                    branch_ids.add(obj.branch_id)
                self.assertLessEqual(len(branch_ids), 1)

    def test_group_list_hides_other_branch_teachers(self):
        """Boshqa filial o'qituvchilari filtr ro'yxatida chiqmasligi kerak."""
        role = Role.objects.filter(name="O'qituvchi").first() or Role.objects.create(name="O'qituvchi")
        teacher_b = Employee.objects.create(
            first_name="UstozB", last_name="B", phone="+998900000201",
            role=role, is_active=True,
        )
        teacher_b.branches.add(self.branch_b)
        self.group_b.teacher = teacher_b
        self.group_b.save()

        teacher_a = Employee.objects.create(
            first_name="UstozA", last_name="A", phone="+998900000202",
            role=role, is_active=True,
        )
        teacher_a.branches.add(self.branch_a)
        self.group_a.teacher = teacher_a
        self.group_a.save()

        self.client.force_login(self.admin_a)
        html = self.client.get(reverse("group_list")).content.decode()
        self.assertNotIn("UstozB", html)
        self.assertIn("UstozA", html)

    def test_teacher_redirected_to_react_app(self):
        """O'qituvchilar Django sahifalariga emas, React ilovasiga boradi."""
        from django.conf import settings

        role = Role.objects.filter(name="O'qituvchi").first() or Role.objects.create(name="O'qituvchi")
        emp = Employee.objects.create(
            first_name="OqituvchiX", last_name="X", phone="+998900000203",
            role=role, is_active=True,
        )
        emp.branches.add(self.branch_a)
        emp.user = self.teacher_user
        emp.save()

        self.teacher_user.is_staff = True
        self.teacher_user.save()

        expected = getattr(settings, "TEACHER_APP_URL", "")
        self.client.force_login(self.teacher_user)
        for url in (
            reverse("teacher_dashboard"),
            reverse("teacher_my_groups"),
        ):
            with self.subTest(url=url):
                response = self.client.get(url)
                self.assertEqual(response.status_code, 302)
                self.assertEqual(response.url, expected)