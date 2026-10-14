"""Filial va xodim bo'yicha to'lov usullarini cheklash testlari."""

from django.contrib.auth.models import User
from django.test import TestCase
from django.urls import reverse

from . import payment_scope
from .models import Branch, Employee, Kassa, PaymentMethod, Student
from .permissions import grant_permission


class PaymentScopeTestMixin:
    def setUp(self):
        self.naqd, _ = PaymentMethod.objects.get_or_create(name="Naqd")
        self.karta, _ = PaymentMethod.objects.get_or_create(name="Karta")
        self.click, _ = PaymentMethod.objects.get_or_create(name="Click")

        self.branch_andijon = Branch.objects.create(name="Andijon filiali")
        self.branch_izboskan = Branch.objects.create(name="Izboskan filiali")
        self.branch_empty = Branch.objects.create(name="Sozlanmagan filiali")

        # Andijon: Naqd, Karta. Izboskan: faqat Naqd.
        self.branch_andijon.payment_methods.set([self.naqd, self.karta])
        self.branch_izboskan.payment_methods.set([self.naqd])

        self.kassa = Kassa.objects.create(name="Andijon kassa", branch=self.branch_andijon)

        self.admin = User.objects.create_superuser("boss_pm", "boss_pm@example.com", "pw")
        self.student = Student.objects.create(
            first_name="Ali", last_name="Valiyev", phone="+998900000101", branch=self.branch_andijon
        )

    def _employee(self, username, phone, branch=None, methods=None):
        user = User.objects.create_user(username, password="pw")
        emp = Employee.objects.create(
            first_name=username, last_name="Emp", phone=phone, user=user
        )
        if branch is not None:
            emp.branches.add(branch)
        if methods is not None:
            emp.payment_methods.set(methods)
        return emp


class PaymentScopeUnitTests(PaymentScopeTestMixin, TestCase):
    def test_branch_configured_limits_methods(self):
        names = set(
            payment_scope.branch_methods(self.branch_andijon).values_list("name", flat=True)
        )
        self.assertEqual(names, {"Naqd", "Karta"})

    def test_branch_without_config_uses_all_active(self):
        names = set(
            payment_scope.branch_methods(self.branch_empty).values_list("name", flat=True)
        )
        self.assertEqual(names, {"Naqd", "Karta", "Click"})

    def test_employee_methods_intersect_branch(self):
        # Xodimga Click berilsa ham, Andijonda u yoqilmagani uchun chiqmaydi.
        emp = self._employee("humoyun", "900000102", self.branch_andijon, [self.naqd, self.karta, self.click])
        names = set(
            payment_scope.employee_methods(emp, self.branch_andijon).values_list("name", flat=True)
        )
        self.assertEqual(names, {"Naqd", "Karta"})

    def test_employee_without_individual_uses_branch(self):
        emp = self._employee("erkin", "900000103", self.branch_andijon, [])
        names = set(
            payment_scope.employee_methods(emp, self.branch_andijon).values_list("name", flat=True)
        )
        self.assertEqual(names, {"Naqd", "Karta"})

    def test_is_method_allowed_case_insensitive(self):
        emp = self._employee("aziz", "900000104", self.branch_izboskan, [])
        self.assertTrue(payment_scope.is_method_allowed(emp.user, "naqd", branch=self.branch_izboskan))
        self.assertFalse(payment_scope.is_method_allowed(emp.user, "Karta", branch=self.branch_izboskan))

    def test_empty_method_always_allowed(self):
        emp = self._employee("bo_sh", "900000105", self.branch_izboskan, [])
        self.assertTrue(payment_scope.is_method_allowed(emp.user, "", branch=self.branch_izboskan))


class PaymentMethodEnforcementTests(PaymentScopeTestMixin, TestCase):
    def test_payment_window_shows_only_allowed_methods(self):
        emp = self._employee("humoyun2", "900000106", self.branch_andijon, [self.karta])
        grant_permission(self.admin, emp.user, "payment.create")
        self.kassa.owner = emp.user
        self.kassa.save()
        self.client.force_login(emp.user)

        response = self.client.get(reverse("payment_create"))
        self.assertEqual(response.status_code, 200)
        content = response.content.decode()
        self.assertIn('value="karta"', content)
        self.assertNotIn('value="naqd"', content)

    def test_backend_rejects_disallowed_method(self):
        emp = self._employee("humoyun3", "900000107", self.branch_andijon, [self.karta])
        grant_permission(self.admin, emp.user, "payment.create")
        self.kassa.owner = emp.user
        self.kassa.save()
        self.client.force_login(emp.user)

        response = self.client.post(
            reverse("payment_create"),
            {
                "kassa_id": self.kassa.pk,
                "student_id": self.student.pk,
                "amount": "100000",
                "payment_method": "click",
            },
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertFalse(data.get("success"))
        self.assertIn("ruxsat", data.get("error", "").lower())

    def test_backend_accepts_allowed_method(self):
        from unittest import mock

        emp = self._employee("humoyun4", "900000108", self.branch_andijon, [self.karta])
        grant_permission(self.admin, emp.user, "payment.create")
        self.kassa.owner = emp.user
        self.kassa.save()
        self.client.force_login(emp.user)

        with mock.patch("frontend.views.send_payment_received_sms", return_value=True):
            response = self.client.post(
                reverse("payment_create"),
                {
                    "kassa_id": self.kassa.pk,
                    "student_id": self.student.pk,
                    "amount": "100000",
                    "payment_method": "karta",
                },
            )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data.get("success"), data)


class PaymentMethodFormTests(PaymentScopeTestMixin, TestCase):
    def test_branch_and_employee_forms_render(self):
        self.client.force_login(self.admin)
        for name in ("branch_create", "employee_create"):
            with self.subTest(url=name):
                response = self.client.get(reverse(name))
                self.assertEqual(response.status_code, 200)

    def test_employee_form_rejects_method_outside_branch(self):
        from .forms import EmployeeForm

        form = EmployeeForm(
            data={
                "first_name": "Test",
                "last_name": "Xodim",
                "phone": "901234501",
                "salary_type": "monthly",
                "percent": "0",
                "monthly_salary": "1000000",
                "branches": [self.branch_andijon.pk],
                "payment_methods": [self.naqd.pk, self.click.pk],
            }
        )
        self.assertFalse(form.is_valid())
        self.assertIn("payment_methods", form.errors)

    def test_employee_form_accepts_method_within_branch(self):
        from .forms import EmployeeForm

        form = EmployeeForm(
            data={
                "first_name": "Test",
                "last_name": "Xodim",
                "phone": "901234502",
                "salary_type": "monthly",
                "percent": "0",
                "monthly_salary": "1000000",
                "branches": [self.branch_andijon.pk],
                "payment_methods": [self.naqd.pk, self.karta.pk],
            }
        )
        self.assertTrue(form.is_valid(), form.errors)
