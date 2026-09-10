"""
Centralized route-based permission enforcement middleware.

Maps each Django url_name to the permission codename required to access it.
If a logged-in (non-superuser) user hits a protected route without the
permission, the middleware returns HTTP 403 Forbidden.

Design rationale:
  - Central, extendable, single place to add a permission for any new route.
  - Does not require editing every view.
  - Superusers implicitly bypass all checks.
  - Teacher/student/public endpoints are exempt and never blocked.

Note: VIEWS that already carry an explicit @require_permission decorator are
redundantly-but-safely covered; the middleware is the backstop for the rest.
"""

from django.urls import get_resolver
from django.http import HttpResponseForbidden

# Mapping of url_name -> permission codename.
ROUTE_PERMISSIONS = {
    # ----- Dashboard / Analytics -----
    "dashboard": "dashboard.view",
    # ----- Kassa -----
    "kassa_dashboard": "cashbox.view",
    "kassa_dashboard_export_excel": "cashbox.report",
    "kassa_overview": "cashbox.view",
    "kassa_overview_export": "cashbox.report",
    "kassa_overview_export_excel": "cashbox.report",
    "kassa_list": "cashbox.view",
    "kassa_create": "cashbox.create",
    "kassa_detail": "cashbox.view",
    "kassa_detail_export_excel": "cashbox.report",
    "kassa_update": "cashbox.update",
    "kassa_delete": "cashbox.delete",
    "kassa_add_income": "cashbox.create",
    "kassa_add_expense": "expense.regular",
    "kassa_add_employee_payout": "cashbox.create",
    "kassa_advance_close": "expense.advance_close",
    "kassa_transfer": "cashbox.transfer",
    "kassa_history": "cashbox.view",
    "kassa_register_payment": "payment.create",
    "payment_method_list": "cashbox.view",
    "payment_method_create": "cashbox.create",
    "payment_method_edit": "cashbox.update",
    "payment_method_toggle": "cashbox.update",
    "payment_method_delete": "cashbox.delete",
    "expense_category_list": "cashbox.view",
    "expense_category_create": "cashbox.create",
    "expense_category_edit": "cashbox.update",
    "expense_category_toggle": "cashbox.update",
    "expense_category_delete": "cashbox.delete",
    "income_category_list": "cashbox.view",
    "income_category_create": "cashbox.create",
    "income_category_edit": "cashbox.update",
    "income_category_toggle": "cashbox.update",
    "income_category_delete": "cashbox.delete",
    # ----- Payments -----
    "payment_create": "payment.create",
    "payment_transfer_ajax": "payment.transfer",
    "payment_expense_ajax": "payment.create",
    "payment_student_refund": "expense.refund",
    "payment_history": "payment.view",
    "payment_filter": "payment.view",
    "debt_sms_page": "payment.sms",
    "send_debt_reminders_to_all": "payment.sms",
    "transfer_wrong_payment": "payment.transfer",
    "balance_withdraw": "finance.create",
    "balance_transfer": "student.transfer",
    "student_balance_view": "finance.view",
    # ----- Attendance -----
    "group_davom": "attendance.view",
    "group_attendance_page": "attendance.view",
    "take_attendance": "attendance.create",
    # ----- Student -----
    "student_list": "student.view",
    "student_filter": "student.view",
    "student_create": "student.create",
    "student_update": "student.update",
    "student_delete": "student.delete",
    "pending_students": "student.view",
    "graduated_students": "student.view",
    "student_profile": "student.view",
    "student_freeze": "student.freeze",
    "student_unfreeze": "student.freeze",
    "student_remove_from_group": "student.transfer",
    "student_add_to_group": "student.transfer",
    "student_send_sms": "student.sms",
    "update_student_lesson_price": "student.update",
    "student_export_excel": "student.export",
    "student_export_csv": "student.export",
    "pending_export_excel": "student.export",
    "pending_export_csv": "student.export",
    "graduated_export_excel": "student.export",
    "graduated_export_csv": "student.export",
    "api_update_deferred_reason": "student.update",
    # ----- Group -----
    "group_list": "group.view",
    "group_create": "group.create",
    "group_update": "group.update",
    "group_delete": "group.delete",
    "group_extend": "group.update",
    "group_detail": "group.view",
    "group_history": "audit.view",
    "group_settings": "group.settings",
    "group_freeze": "group.freeze",
    "group_archive": "group.freeze",
    "group_teacher_assignments": "group.settings",
    "group_teacher_assignment_delete": "group.settings",
    "group_export_excel": "group.export",
    "group_export_csv": "group.export",
    "group_detail_export_excel": "group.export",
    "group_detail_export_csv": "group.export",
    "group_davom": "attendance.view",
    "add_student_to_group": "student.transfer",
    "add_pending_to_group": "student.transfer",
    "remove_student_from_group": "student.transfer",
    "graduate_student": "student.transfer",
    "transfer_student": "student.transfer",
    "transfer_all_students": "student.transfer",
    # ----- Course -----
    "course_list": "course.view",
    "course_create": "course.create",
    "course_update": "course.update",
    "course_delete": "course.delete",
    "course_level_list": "course_level.view",
    "course_level_create": "course_level.create",
    "course_level_update": "course_level.update",
    "course_level_delete": "course_level.delete",
    "api_course_levels": "course_level.view",
    # ----- Teacher -----
    "teacher_salary_list": "teacher.salary",
    "teacher_salary_detail": "teacher.salary",
    "teacher_salary_pay": "teacher.salary",
    "teacher_salary_update_percent": "teacher.salary",
    # ----- Employees / Admins -----
    "employee_list": "employee.view",
    "employee_create": "employee.create",
    "employee_profile": "employee.view",
    "employee_update": "employee.update",
    "employee_delete": "employee.delete",
    "employee_export_excel": "report.export",
    "employee_export_csv": "report.export",
    "position_list": "position.view",
    "position_create": "position.create",
    "position_update": "position.update",
    "position_delete": "position.delete",
    "branch_list": "branch.view",
    "branch_create": "branch.create",
    "branch_update": "branch.update",
    "branch_delete": "branch.delete",
    "room_list": "room.view",
    "room_create": "room.create",
    "room_update": "room.update",
    "room_delete": "room.delete",
    "room_export_excel": "report.export",
    "room_export_csv": "report.export",
    # ----- Reports / Statistics -----
    "statistics": "statistics.view",
    # ----- Marketing / Surveys -----
    "survey_list": "survey.view",
    "survey_create": "survey.create",
    "survey_update": "survey.update",
    "survey_delete": "survey.delete",
    # ----- Absence reasons -----
    "absence_reason_list": "absence_reason.view",
    "absence_reason_create": "absence_reason.create",
    "absence_reason_update": "absence_reason.update",
    "absence_reason_delete": "absence_reason.delete",
    # ----- Settings -----
    "global_config": "settings.update",
    "receipt_settings": "settings.receipt",
    "sms_settings": "settings.sms",
    "qr_settings": "settings.qr",
    "attendance_reminder_settings": "settings.update",
    "receipt_builder": "settings.receipt",
    "receipt_print_preview": "settings.receipt",
    "receipt_print": "settings.receipt",
    "api_receipt_html": "settings.receipt",
    "receipt_list": "cashbox.view",
    "api_receipt_templates": "settings.receipt",
    "api_receipt_template_detail": "settings.receipt",
    "api_receipt_template_create": "settings.receipt",
    "api_receipt_template_duplicate": "settings.receipt",
    "api_receipt_template_set_default": "settings.receipt",
    # ----- Additional functions -----
    "additional_functions": "additional_functions.view",
    # ----- Admin management (see admin_permission app) -----
    "admin_list": "admin.view",
    "admin_create": "admin.create",
    "admin_permissions": "admin.permissions.manage",
    "employee_permissions": "admin.permissions.manage",
    "admin_permission_toggle": "admin.permissions.manage",
    "admin_permission_grant_all": "admin.permissions.manage",
    "admin_permission_revoke_all": "admin.permissions.manage",
    "admin_block": "admin.update",
    "admin_update": "admin.update",
    "admin_delete": "admin.delete",
    "audit_log": "audit.view",
    # ----- Employee API (teacher app - only admin-only actions gated) -----
    "employee_api_list": "employee.view",
    "employee_api_create": "employee.create",
    "employee_api_detail": "employee.view",
    "employee_api_update": "employee.update",
    "employee_api_delete": "employee.delete",
    "employee_api_roles": "employee.view",
    "employee_api_positions": "employee.view",
    "employee_api_branches": "employee.view",
    # ----- Topshiriqlar / Eslatmalar (view own is always allowed) -----
    "task_create": "task.manage",
    "task_update": "task.manage",
    "task_delete": "task.manage",
}

# Routes a logged-in *teacher*/support user may use without a grant.
# These are intentionally exempt (teacher/student facing).
EXEMPT_PATHS = (
    "/teacher-",
    "/teacher/",
    "/api/employee/login/",
    "/api/employee/logout/",
    "/api/employee/me/",
    "/api/employee/change-password/",
    "/api/employee/change-phone/",
    "/api/employee/transactions/",
    "/api/employee/my-groups/",
    "/api/employee/attendance/",
    "/api/employee/take-attendance/",
    "/api/employee/teacher-dashboard/",
    "/api/employee/teacher-group/",
    "/api/employee/my-salary/",
    "/api/student/",
    "/api/telegram-webhook/",
    "/login/",
    "/logout/",
    "/admin/",
    "/bugungi-guruhlar/",
)

EXEMPT_URL_NAMES = {
    "login",
    "logout",
    "teacher_dashboard",
    "teacher_my_groups",
    "teacher_group_detail",
    "teacher_attendance_page",
    "teacher_attendance_desktop",
    "take_attendance",
    "admin_mobile_groups",
    "employee_api_login",
    "employee_api_logout",
    "employee_api_me",
    "employee_api_change_password",
    "employee_api_change_phone",
    "employee_api_my_groups",
    "employee_api_attendance",
    "employee_api_take_attendance",
    "employee_api_dashboard",
    "employee_api_group_detail",
    "employee_api_group_update",
    "employee_api_my_salary",
    "student_api_profile",
    "student_login",
    "student_send_code",
    "student_verify_code",
    "student_set_password",
    "telegram_webhook",
    "telegram_eslatma_webhook",
}


class PermissionMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self._check(request)
        if response is not None:
            return response
        return self.get_response(request)

    def _check(self, request):
        user = getattr(request, "user", None)
        # Only enforce for authenticated, non-superuser requests.
        if not getattr(user, "is_authenticated", False):
            return None
        if getattr(user, "is_superuser", False):
            return None

        resolver = getattr(request, "resolver_match", None)
        if resolver is None:
            # resolver_match may not be populated at middleware time in some
            # setups; resolve the URL path ourselves as a fallback.
            try:
                resolver = get_resolver().resolve(request.path)
                request.resolver_match = resolver
            except Exception:
                return None
        url_name = resolver.url_name or ""

        if url_name in EXEMPT_URL_NAMES:
            return None

        # Path-based exemption (teacher/student/api)
        path = request.path
        if any(path.startswith(p) for p in EXEMPT_PATHS):
            return None

        required = ROUTE_PERMISSIONS.get(url_name)
        if required is None:
            return None

        from frontend.permissions import has_permission
        if not has_permission(user, required):
            return HttpResponseForbidden(
                "Sizda ushbu sahifaga kirish uchun ruxsat yo'q (permission: %s)" % required
            )
        return None
