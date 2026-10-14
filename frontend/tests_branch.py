"""Filial (branch) bo'yicha ma'lumotlarni ajratish testlari."""

from datetime import date

from django.contrib.auth.models import User
from django.test import RequestFactory, TestCase
from django.urls import reverse

from . import branch_scope
from .models import AdminBranch, Branch, Course, Employee, Group, Kassa, Room, Student
from .permissions import grant_permission


class BranchTestMixin:
    """Ikki filial + filialga tegilmagan ma'lumotlar."""

    def setUp(self):
        self.factory = RequestFactory()
        self.branch_a = Branch.objects.create(name="Chilonzor filiali")
        self.branch_b = Branch.objects.create(name="Sergeli filiali")
        self.course = Course.objects.create(name="IT kursi")

        self.group_a = self._group("A guruhi", self.branch_a)
        self.group_b = self._group("B guruhi", self.branch_b)
        self.group_free = self._group("Filialsiz guruhi", None)

        self.student_a = Student.objects.create(first_name="Ali", last_name="A", phone="+998900000001", branch=self.branch_a)
        self.student_b = Student.objects.create(first_name="Vali", last_name="B", phone="+998900000002", branch=self.branch_b)
        self.student_free = Student.objects.create(first_name="Nodir", last_name="F", phone="+998900000003")

        self.room_a = Room.objects.create(name="A-101", branch=self.branch_a)
        self.room_b = Room.objects.create(name="B-202", branch=self.branch_b)

        self.kassa_a = Kassa.objects.create(name="Kassa A", branch=self.branch_a)
        self.kassa_b = Kassa.objects.create(name="Kassa B", branch=self.branch_b)

        self.superuser = User.objects.create_superuser("boss", "boss@example.com", "pw")
        self.branch_admin = User.objects.create_user("filial_admin", password="pw")
        AdminBranch.objects.create(user=self.branch_admin, branch=self.branch_a)
        self.free_admin = User.objects.create_user("erkin_admin", password="pw")

    def _group(self, name, branch):
        return Group.objects.create(
            name=name,
            branch=branch,
            course=self.course,
            start_date=date(2026, 1, 1),
            end_date=date(2026, 12, 31),
        )

    def _request(self, user):
        from django.contrib.sessions.middleware import SessionMiddleware

        request = self.factory.get("/")
        SessionMiddleware(lambda r: None).process_request(request)
        request.session.save()
        request.user = user
        return request

    def _grant(self, user, *codenames):
        for codename in codenames:
            grant_permission(self.superuser, user, codename)


class BranchScopeTests(BranchTestMixin, TestCase):
    # ---------------- allowed_branch_ids ----------------
    def test_superuser_unrestricted(self):
        self.assertIsNone(branch_scope.allowed_branch_ids(self.superuser))

    def test_assigned_admin_restricted(self):
        self.assertEqual(branch_scope.allowed_branch_ids(self.branch_admin), [self.branch_a.pk])

    def test_unassigned_admin_sees_everything(self):
        self.assertIsNone(branch_scope.allowed_branch_ids(self.free_admin))

    def test_anonymous_sees_nothing(self):
        from django.contrib.auth.models import AnonymousUser

        self.assertEqual(branch_scope.allowed_branch_ids(AnonymousUser()), [])

    # ---------------- scope() ----------------
    def test_superuser_scope_returns_all(self):
        request = self._request(self.superuser)
        self.assertEqual(branch_scope.scope(request, Student.objects.all()).count(), 3)

    def test_branch_admin_scope_filters(self):
        request = self._request(self.branch_admin)
        self.assertEqual(
            [s.pk for s in branch_scope.scope(request, Student.objects.all())],
            [self.student_a.pk],
        )

    def test_branch_admin_cannot_see_unassigned_data(self):
        request = self._request(self.branch_admin)
        scoped = branch_scope.scope(request, Student.objects.all())
        self.assertFalse(scoped.filter(pk=self.student_free.pk).exists())

    def test_group_room_kassa_scoped(self):
        request = self._request(self.branch_admin)
        self.assertEqual([g.pk for g in branch_scope.scope(request, Group.objects.all())], [self.group_a.pk])
        self.assertEqual([r.pk for r in branch_scope.scope(request, Room.objects.all())], [self.room_a.pk])
        self.assertEqual([k.pk for k in branch_scope.scope(request, Kassa.objects.all())], [self.kassa_a.pk])

    # ---------------- session / filial tanlagichi ----------------
    def test_superuser_can_switch_branch(self):
        request = self._request(self.superuser)
        branch_scope.set_current_branch(request, self.branch_a.pk)
        self.assertEqual(branch_scope.get_current_branch(request), self.branch_a)
        self.assertEqual(
            [s.pk for s in branch_scope.scope(request, Student.objects.all())],
            [self.student_a.pk],
        )

    def test_switch_back_to_all_branches(self):
        request = self._request(self.superuser)
        branch_scope.set_current_branch(request, self.branch_a.pk)
        branch_scope.set_current_branch(request, 0)
        self.assertIsNone(branch_scope.get_current_branch(request))
        self.assertEqual(branch_scope.scope(request, Student.objects.all()).count(), 3)

    def test_branch_admin_cannot_switch_to_other_branch(self):
        request = self._request(self.branch_admin)
        branch_scope.set_current_branch(request, self.branch_b.pk)
        self.assertIsNone(branch_scope.get_current_branch(request))
        self.assertEqual(
            [s.pk for s in branch_scope.scope(request, Student.objects.all())],
            [self.student_a.pk],
        )

    def test_branch_options_only_show_allowed(self):
        self.assertEqual(
            [b.pk for b in branch_scope.available_branches(self.branch_admin)],
            [self.branch_a.pk],
        )
        self.assertEqual(branch_scope.available_branches(self.superuser).count(), 2)

    # ---------------- xodim ----------------
    def test_employee_locked_to_assigned_branches(self):
        emp_user = User.objects.create_user("oqituvchi", password="pw")
        emp = Employee.objects.create(first_name="Sardor", last_name="T", phone="900000004", user=emp_user)
        emp.branches.add(self.branch_a)
        emp.save()

        self.assertFalse(branch_scope.can_switch_branch(emp_user))
        self.assertIsNone(branch_scope.get_current_branch(self._request(emp_user)))
        self.assertEqual(
            [g.pk for g in branch_scope.scope(self._request(emp_user), Group.objects.all())],
            [self.group_a.pk],
        )

    def test_employee_without_branch_sees_nothing(self):
        emp_user = User.objects.create_user("yangi_xodim", password="pw")
        Employee.objects.create(first_name="Yangi", last_name="X", phone="900000005", user=emp_user)
        self.assertEqual(branch_scope.scope(self._request(emp_user), Group.objects.all()).count(), 0)

    # ---------------- ensure_access ----------------
    def test_ensure_access_blocks_foreign_branch(self):
        request = self._request(self.branch_admin)
        self.assertTrue(branch_scope.ensure_access(request, self.group_a))
        self.assertFalse(branch_scope.ensure_access(request, self.group_b))
        self.assertFalse(branch_scope.ensure_access(request, self.group_free))

    def test_ensure_access_superuser_switched_branch(self):
        request = self._request(self.superuser)
        branch_scope.set_current_branch(request, self.branch_b.pk)
        self.assertFalse(branch_scope.ensure_access(request, self.group_a))
        self.assertTrue(branch_scope.ensure_access(request, self.group_b))


class BranchViewTests(BranchTestMixin, TestCase):
    def test_branch_switch_view_sets_session(self):
        self.client.force_login(self.superuser)
        response = self.client.post(
            reverse("branch_switch"),
            {"branch": self.branch_a.pk, "next": reverse("student_list")},
        )
        self.assertEqual(response.status_code, 302)
        self.assertEqual(self.client.session["current_branch_id"], self.branch_a.pk)

    def test_student_list_shows_only_branch_data(self):
        self._grant(self.branch_admin, "student.view")
        self.client.force_login(self.branch_admin)
        response = self.client.get(reverse("student_list"))
        self.assertEqual(response.status_code, 200)
        self.assertEqual([row["id"] for row in response.context["students"]], [self.student_a.pk])

    def test_student_list_superuser_sees_all(self):
        self.client.force_login(self.superuser)
        response = self.client.get(reverse("student_list"))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.context["students"]), 3)

    def test_group_list_scoped(self):
        self._grant(self.branch_admin, "group.view")
        self.client.force_login(self.branch_admin)
        response = self.client.get(reverse("group_list"))
        self.assertEqual([g.pk for g in response.context["groups"]], [self.group_a.pk])

    def test_room_list_scoped(self):
        self._grant(self.branch_admin, "room.view")
        self.client.force_login(self.branch_admin)
        response = self.client.get(reverse("room_list"))
        self.assertEqual([r.pk for r in response.context["rooms"]], [self.room_a.pk])

    def test_foreign_group_detail_is_forbidden(self):
        self._grant(self.branch_admin, "group.view")
        self.client.force_login(self.branch_admin)
        response = self.client.get(reverse("group_detail", args=[self.group_b.pk]))
        self.assertIn(response.status_code, (403, 404))

    def test_foreign_student_profile_is_forbidden(self):
        self._grant(self.branch_admin, "student.view")
        self.client.force_login(self.branch_admin)
        response = self.client.get(reverse("student_profile", args=[self.student_b.pk]))
        self.assertIn(response.status_code, (403, 404))

    def test_group_create_assigns_current_branch(self):
        self._grant(self.branch_admin, "group.create")
        self.client.force_login(self.branch_admin)
        response = self.client.post(reverse("group_create"), {
            "name": "Yangi guruh",
            "branch": self.branch_a.pk,
            "status": "kutilyotgan",
            "education_type": Group.EducationType.OFFLINE,
            "day_type": Group.DayType.EVERYDAY,
        })
        self.assertEqual(response.status_code, 302)
        self.assertTrue(Group.objects.filter(name="Yangi guruh", branch=self.branch_a).exists())

    def test_group_create_cannot_use_foreign_branch(self):
        self._grant(self.branch_admin, "group.create")
        self.client.force_login(self.branch_admin)
        response = self.client.post(reverse("group_create"), {
            "name": "Yashirin guruh",
            "branch": self.branch_b.pk,
            "status": "kutilyotgan",
            "education_type": Group.EducationType.OFFLINE,
            "day_type": Group.DayType.EVERYDAY,
        })
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Yashirin guruh")
        self.assertFalse(Group.objects.filter(name="Yashirin guruh").exists())

    def test_branch_admin_page_assigns_admin(self):
        self.client.force_login(self.superuser)
        response = self.client.post(
            reverse("branch_admin_branches", args=[self.branch_b.pk]),
            {"admins": [str(self.free_admin.pk)]},
        )
        self.assertEqual(response.status_code, 302)
        self.assertTrue(AdminBranch.objects.filter(user=self.free_admin, branch=self.branch_b).exists())

    # ---------------- o'quvchi akkaunti ----------------
    def test_student_account_sees_only_own_branch(self):
        from frontend import context_processors

        student_user = User.objects.create_user("oquvchi_user", password="pw")
        self.student_a.user = student_user
        self.student_a.save()

        self.assertEqual(branch_scope.allowed_branch_ids(student_user), [self.branch_a.pk])
        self.assertFalse(branch_scope.can_switch_branch(student_user))
        request = self._request(student_user)
        self.assertEqual(
            [s.pk for s in branch_scope.scope(request, Student.objects.all())],
            [self.student_a.pk],
        )

        ctx = context_processors.branch_context(request)
        self.assertEqual(ctx["current_branch"], self.branch_a)
        self.assertTrue(ctx["branch_locked"])

    def test_student_without_branch_sees_nothing(self):
        from frontend import context_processors

        student_user = User.objects.create_user("oquvchi_yoq", password="pw")
        self.student_free.user = student_user
        self.student_free.save()

        self.assertEqual(branch_scope.allowed_branch_ids(student_user), [])
        request = self._request(student_user)
        self.assertEqual(branch_scope.scope(request, Student.objects.all()).count(), 0)
        ctx = context_processors.branch_context(request)
        self.assertIsNone(ctx["current_branch"])
        self.assertTrue(ctx["branch_locked"])

    def test_employee_label_shown_even_without_session(self):
        from frontend import context_processors

        emp_user = User.objects.create_user("xodim2", password="pw")
        emp = Employee.objects.create(first_name="Alisher", last_name="K", phone="900000006", user=emp_user)
        emp.branches.add(self.branch_a, self.branch_b)
        emp.save()

        ctx = context_processors.branch_context(self._request(emp_user))
        self.assertIsNotNone(ctx["locked_branch"])
        self.assertFalse(ctx["can_switch_branch"])

    # ---------------- formalar ----------------
    def test_branch_is_required_for_restricted_admin(self):
        from frontend.forms import GroupForm

        form = GroupForm(data={
            "name": "Filialsiz",
            "status": "kutilyotgan",
            "education_type": Group.EducationType.OFFLINE,
            "day_type": Group.DayType.EVERYDAY,
        }, branches=branch_scope.available_branches(self.branch_admin))
        self.assertFalse(form.is_valid())
        self.assertIn("branch", form.errors)

    def test_branch_optional_for_superuser(self):
        from frontend.forms import GroupForm

        form = GroupForm(data={
            "name": "Superuser guruhi",
            "status": "kutilyotgan",
            "education_type": Group.EducationType.OFFLINE,
            "day_type": Group.DayType.EVERYDAY,
        }, branches=branch_scope.form_branches(self.superuser))
        self.assertTrue(form.is_valid(), form.errors)

    def test_room_list_only_own_branch_in_form(self):
        from frontend.forms import GroupForm

        form = GroupForm(branches=branch_scope.available_branches(self.branch_admin))
        room_ids = set(form.fields["room"].queryset.values_list("pk", flat=True))
        self.assertEqual(room_ids, {self.room_a.pk})

    def test_room_from_other_branch_rejected(self):
        from frontend.forms import GroupForm

        form = GroupForm(data={
            "name": "Noto'g'ri xona",
            "branch": self.branch_a.pk,
            "room": self.room_b.pk,
            "status": "kutilyotgan",
            "education_type": Group.EducationType.OFFLINE,
            "day_type": Group.DayType.EVERYDAY,
        }, branches=branch_scope.available_branches(self.branch_admin))
        self.assertFalse(form.is_valid())
        self.assertIn("room", form.errors)

    # ---------------- kassa ----------------
    def _make_kassa_admin(self):
        branch_admin = User.objects.create_user("kassa_admin", password="pw")
        branch_admin.is_staff = True
        branch_admin.save()
        AdminBranch.objects.create(user=branch_admin, branch=self.branch_a)
        return branch_admin

    def test_branch_admin_sees_branch_kassas_regardless_of_owner(self):
        from frontend import kassa_views

        branch_admin = self._make_kassa_admin()
        self.kassa_a.owner = self.free_admin
        self.kassa_a.save()
        self.kassa_b.owner = self.free_admin
        self.kassa_b.save()

        request = self._request(branch_admin)
        self.assertFalse(kassa_views._owner_only(request, branch_admin))
        visible = kassa_views._scoped_kassalar(request)
        self.assertEqual([k.pk for k in visible], [self.kassa_a.pk])

    def test_plain_employee_still_owner_only(self):
        from frontend import kassa_views

        emp_user = User.objects.create_user("sodic", password="pw")
        emp = Employee.objects.create(first_name="S", last_name="S", phone="900000007", user=emp_user)
        self.kassa_a.owner = emp_user
        self.kassa_a.save()

        request = self._request(emp_user)
        self.assertTrue(kassa_views._owner_only(request, emp_user))

    # ---------------- kassa formasi: egasi filialga bog'langan ----------------
    def test_kassa_owner_must_belong_to_branch(self):
        from frontend.forms import KassaForm

        # branch_a ga biriktirilgan, branch_b ga esa yo'q admin.
        form = KassaForm(data={
            "branch": self.branch_b.pk,
            "owner": self.branch_admin.pk,
            "name": "Noto'g'ri kassa",
            "is_active": "on",
        })
        self.assertFalse(form.is_valid())
        self.assertIn("owner", form.errors)

    def test_kassa_owner_from_same_branch_accepted(self):
        from frontend.forms import KassaForm

        form = KassaForm(data={
            "branch": self.branch_a.pk,
            "owner": self.branch_admin.pk,
            "name": "To'g'ri kassa",
            "is_active": "on",
        })
        self.assertTrue(form.is_valid(), form.errors)

    def test_superuser_can_own_any_branch_kassa(self):
        from frontend.forms import KassaForm

        form = KassaForm(data={
            "branch": self.branch_b.pk,
            "owner": self.superuser.pk,
            "name": "Boss kassasi",
            "is_active": "on",
        })
        self.assertTrue(form.is_valid(), form.errors)

    def test_owner_branch_map_contains_assignment(self):
        from frontend import branch_scope

        mapping = branch_scope.branch_admin_map()
        self.assertEqual(mapping[self.branch_admin.pk], [self.branch_a.pk])
        self.assertIsNone(mapping[self.superuser.pk])

    def test_owner_branch_map_excludes_unassigned_admin(self):
        from frontend import branch_scope

        mapping = branch_scope.branch_admin_map()
        self.assertNotIn(self.free_admin.pk, mapping)

    def test_unassigned_admin_cannot_own_any_kassa(self):
        from frontend import branch_scope
        from frontend.forms import KassaForm

        self.free_admin.is_staff = True
        self.free_admin.save()

        self.assertFalse(branch_scope.can_own_branch_kassa(self.free_admin, self.branch_a))
        self.assertFalse(branch_scope.can_own_branch_kassa(self.free_admin, self.branch_b))

        form = KassaForm(data={
            "branch": self.branch_a.pk,
            "owner": self.free_admin.pk,
            "name": "Noto'g'ri kassa",
            "is_active": "on",
        })
        self.assertFalse(form.is_valid())
        self.assertIn("owner", form.errors)

    def test_admin_cannot_own_other_branch_kassa(self):
        from frontend.forms import KassaForm

        # branch_admin faqat branch_a ga biriktirilgan.
        form = KassaForm(data={
            "branch": self.branch_b.pk,
            "owner": self.branch_admin.pk,
            "name": "Boshqa filial kassasi",
            "is_active": "on",
        })
        self.assertFalse(form.is_valid())
        self.assertIn("owner", form.errors)

    def test_employee_branches_also_grants_ownership(self):
        from frontend import branch_scope
        from frontend.forms import KassaForm

        emp_user = User.objects.create_user("filial_xodimi", password="pw")
        emp = Employee.objects.create(
            first_name="Nodir", last_name="A", phone="900000008", user=emp_user
        )
        emp.branches.add(self.branch_a)
        emp.save()

        self.assertTrue(branch_scope.can_own_branch_kassa(emp_user, self.branch_a))
        self.assertFalse(branch_scope.can_own_branch_kassa(emp_user, self.branch_b))
        self.assertEqual(
            branch_scope.branch_admin_map()[emp_user.pk], [self.branch_a.pk]
        )

        form = KassaForm(data={
            "branch": self.branch_a.pk,
            "owner": emp_user.pk,
            "name": "Xodim kassasi",
            "is_active": "on",
        })
        self.assertTrue(form.is_valid(), form.errors)

    def test_kassa_form_has_branch_admin_links(self):
        self.client.force_login(self.superuser)
        response = self.client.get(reverse("kassa_create"))
        urls = response.context["branch_admin_urls"]
        self.assertEqual(
            urls[str(self.branch_a.pk)],
            reverse("branch_admin_branches", args=[self.branch_a.pk]),
        )

    # ---------------- ism-familya ko'rsatish ----------------
    def test_user_display_name_prefers_employee(self):
        from frontend.branch_scope import user_display_name

        user = User.objects.create_user("ali", password="pw")
        self.assertEqual(user_display_name(user), "ali")

        user.first_name = "Alisher"
        user.last_name = "Karimov"
        user.save()
        self.assertEqual(user_display_name(user), "Alisher Karimov")

        Employee.objects.create(first_name="Sardor", last_name="Tursunov", user=user)
        user.refresh_from_db()
        self.assertEqual(user_display_name(user), "Sardor Tursunov")

    def test_kassa_owner_options_show_full_name(self):
        from frontend.forms import KassaForm

        emp_user = User.objects.create_user("sardor_b", password="pw")
        emp = Employee.objects.create(
            first_name="Sardor", last_name="Bekov", phone="900000009", user=emp_user
        )
        emp.branches.add(self.branch_a)
        emp.save()

        form = KassaForm()
        labels = {
            str(value): label
            for value, label in form.fields["owner"].choices
            if value != ""
        }
        self.assertEqual(labels[str(emp_user.pk)], "Sardor Bekov")

    def test_user_name_filter_renders(self):
        from frontend.templatetags.dict_filters import user_name

        self.assertEqual(user_name(None), "Noma'lum")
        self.assertEqual(user_name(self.superuser), self.superuser.username)

    # ---------------- kassa sahifalari render bo'lishi ----------------
    def test_kassa_pages_render(self):
        self.client.force_login(self.superuser)
        self.kassa_a.owner = self.superuser
        self.kassa_a.save()

        pages = [
            reverse("kassa_dashboard"),
            reverse("kassa_list"),
            reverse("kassa_detail", args=[self.kassa_a.pk]),
            reverse("kassa_history"),
            reverse("kassa_overview"),
            reverse("payment_create"),
            reverse("kassa_create"),
        ]
        for url in pages:
            with self.subTest(url=url):
                response = self.client.get(url)
                self.assertEqual(response.status_code, 200)

    def test_kassa_pages_show_owner_full_name(self):
        self.client.force_login(self.superuser)
        emp_user = User.objects.create_user("shoir_b", password="pw")
        emp = Employee.objects.create(
            first_name="Jasur", last_name="Rahimov", phone="900000010", user=emp_user
        )
        emp.branches.add(self.branch_a)
        emp.save()
        self.kassa_a.owner = emp_user
        self.kassa_a.save()

        response = self.client.get(reverse("kassa_list"))
        self.assertContains(response, "Jasur Rahimov")
        self.assertNotContains(response, "shoir_b")

    def test_kassa_form_page_passes_map(self):
        self.client.force_login(self.superuser)
        response = self.client.get(reverse("kassa_create"))
        self.assertEqual(response.status_code, 200)


class ShopCoinBranchAddTest(BranchTestMixin, TestCase):
    """«Barcha filiallar»ga qo'shish huquqi va filial tanlash cheklovi."""

    def test_unrestricted_admin_can_add_to_all_branches(self):
        self.assertTrue(branch_scope.can_add_to_all_branches(self.free_admin))
        self.assertTrue(branch_scope.can_add_to_all_branches(self.superuser))

    def test_assigned_admin_cannot_add_to_all_branches(self):
        self.assertFalse(branch_scope.can_add_to_all_branches(self.branch_admin))

    def test_default_branch_for_restricted_user_is_own_branch(self):
        self.assertEqual(branch_scope.default_add_branch(self.branch_admin).pk, self.branch_a.pk)
        self.assertIsNone(branch_scope.default_add_branch(self.free_admin))

    def test_resolve_added_branch_respects_restriction(self):
        # O'z filialini tanlay oladi.
        self.assertEqual(
            branch_scope.resolve_added_branch(
                self.branch_admin, str(self.branch_a.pk)
            ).pk,
            self.branch_a.pk,
        )
        # «Barcha filiallar» (bo'sh) — rad etilib o'z filialiga tushadi.
        self.assertEqual(
            branch_scope.resolve_added_branch(self.branch_admin, "").pk,
            self.branch_a.pk,
        )
        # Boshqa filial — rad etilib o'z filialiga tushadi.
        self.assertEqual(
            branch_scope.resolve_added_branch(
                self.branch_admin, str(self.branch_b.pk)
            ).pk,
            self.branch_a.pk,
        )

    def test_resolve_added_branch_unrestricted(self):
        # Cheklovsiz: bo'sh bo'lsa None («Barcha filiallar»), raqam bo'lsa o'sha filial.
        self.assertIsNone(branch_scope.resolve_added_branch(self.free_admin, ""))
        self.assertEqual(
            branch_scope.resolve_added_branch(self.free_admin, str(self.branch_b.pk)).pk,
            self.branch_b.pk,
        )


class ShopProductStateTest(BranchTestMixin, TestCase):
    """Mahsulot holatlari: Kutayotgan / Ko'rinadi / Sotuvda."""

    def setUp(self):
        super().setUp()
        from coins.models import ShopProduct
        self.product = ShopProduct.objects.create(
            name="Disk", coin_price=50, stock=3, branch=self.branch_a,
        )

    def _post(self, url):
        from django.test import Client
        c = Client()
        c.force_login(self.superuser)
        return c.post(url)

    def test_toggle_cycles_sale_to_pending(self):
        self._post(reverse("shop_product_toggle", args=[self.product.pk]))
        self.product.refresh_from_db()
        self.assertFalse(self.product.is_active)
        self.assertFalse(self.product.is_visible)

    def test_visibility_toggle_makes_visible_not_sale(self):
        self.product.set_state("pending")
        self.product.save()
        self._post(reverse("shop_product_visibility_toggle", args=[self.product.pk]))
        self.product.refresh_from_db()
        self.assertTrue(self.product.is_visible)
        self.assertFalse(self.product.is_active)

    def test_create_product_as_pending(self):
        from django.test import Client
        c = Client()
        c.force_login(self.superuser)
        c.post(reverse("shop_product_create"), {
            "name": "Kutayotgan mahsulot",
            "coin_price": "30",
            "stock": "5",
            "status": "pending",
            "show_price": "on",
        })
        from coins.models import ShopProduct
        p = ShopProduct.objects.get(name="Kutayotgan mahsulot")
        self.assertFalse(p.is_visible)
        self.assertFalse(p.is_active)
        self.assertTrue(p.show_price)

    def test_create_sale_product_publishes_news(self):
        from django.test import Client
        from frontend.models import News, NewsCategory
        if not NewsCategory.objects.filter(value="yangilik").exists():
            NewsCategory.objects.create(value="yangilik", label="Yangilik")
        c = Client()
        c.force_login(self.superuser)
        c.post(reverse("shop_product_create"), {
            "name": "Yangi Kofe",
            "coin_price": "40",
            "stock": "10",
            "status": "sale",
            "show_price": "on",
        })
        n = News.objects.filter(title__startswith="Yangi mahsulot qo'shildi: Yangi Kofe").first()
        self.assertIsNotNone(n)
        self.assertTrue(n.is_published)
        self.assertTrue(n.published_at)
        self.assertEqual(n.audience, "barcha")
        self.assertIn("40 coin", n.body)

    def test_create_pending_product_publishes_no_news(self):
        from django.test import Client
        from frontend.models import News
        c = Client()
        c.force_login(self.superuser)
        c.post(reverse("shop_product_create"), {
            "name": "Yashirin Mahsulot",
            "coin_price": "40",
            "stock": "10",
            "status": "pending",
            "show_price": "",
        })
        from coins.models import ShopProduct
        p = ShopProduct.objects.get(name="Yashirin Mahsulot")
        self.assertEqual(News.objects.filter(title__contains="Yashirin Mahsulot").count(), 0)
        self.assertFalse(p.is_visible)

    def test_publish_product_news_skips_hidden_products(self):
        from coins.services import publish_product_news
        self.product.set_state("pending")
        self.product.save()
        self.assertIsNone(publish_product_news(self.product))
        self.product.set_state("sale")
        self.product.save()
        self.assertIsNotNone(publish_product_news(self.product))

    def test_visible_product_price_hidden(self):
        from django.test import Client
        c = Client()
        c.force_login(self.superuser)
        c.post(reverse("shop_product_update", args=[self.product.pk]), {
            "name": self.product.name,
            "coin_price": str(self.product.coin_price),
            "stock": str(self.product.stock),
            "status": "visible",
            "show_price": "",  # narx yashirin
        })
        self.product.refresh_from_db()
        self.assertTrue(self.product.is_visible)
        self.assertFalse(self.product.is_active)
        self.assertFalse(self.product.show_price)