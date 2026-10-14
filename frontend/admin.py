from django.contrib import admin
from .models import Course, CourseLevel, MarketingSurvey, Group, Student, LessonTime, StudentLog, Branch, Room, Role, Position, Employee, Attendance, AbsenceReason, GroupLog, VerificationCode, StudentBalance, Transaction, StudentLessonPrice, GlobalConfig, ReceiptTemplate, ReceiptSettings, Kassa, KassaTransaction, KassaTransfer, PaymentMethod, ExpenseCategory, SmsHistory, TeacherBalance, TeacherTransaction, GroupTeacherAssignment, LessonTeacherSalary, Permission as PermissionModel, AdminPermission, PermissionAuditLog, Feedback, Chat, ChatMember, Message, News, NewsCategory, AdminBranch


@admin.register(Student)
class StudentAdmin(admin.ModelAdmin):
    list_display = ["id", "first_name", "last_name", "username", "phone", "status", "is_active"]
    list_filter = ["status", "is_active"]
    search_fields = ["first_name", "last_name", "username", "phone"]
    ordering = ["-id"]


admin.site.register(Course)
admin.site.register(CourseLevel)
admin.site.register(MarketingSurvey)
admin.site.register(Group)
admin.site.register(LessonTime)
admin.site.register(StudentLog)
admin.site.register(Branch)
admin.site.register(AdminBranch)
admin.site.register(Room)
admin.site.register(Role)
admin.site.register(Position)
admin.site.register(Employee)
admin.site.register(Attendance)
admin.site.register(AbsenceReason)
admin.site.register(GroupLog)
admin.site.register(VerificationCode)
admin.site.register(StudentBalance)
admin.site.register(StudentLessonPrice)
admin.site.register(GlobalConfig)
admin.site.register(ReceiptSettings)


admin.site.register(ReceiptTemplate)

@admin.register(Transaction)
class TransactionAdmin(admin.ModelAdmin):
    list_display = ["student", "amount", "transaction_type", "balance_after", "created_at"]
    list_filter = ["transaction_type", "created_at"]
    search_fields = ["student__first_name", "student__last_name"]


@admin.register(Kassa)
class KassaAdmin(admin.ModelAdmin):
    list_display = ["name", "owner", "is_active", "created_at"]
    list_filter = ["is_active"]
    search_fields = ["name", "owner__first_name", "owner__last_name"]


@admin.register(KassaTransaction)
class KassaTransactionAdmin(admin.ModelAdmin):
    list_display = ["kassa", "transaction_type", "amount", "balance_after", "created_by", "created_at"]
    list_filter = ["transaction_type", "created_at"]
    search_fields = ["kassa__name", "created_by", "description"]


@admin.register(KassaTransfer)
class KassaTransferAdmin(admin.ModelAdmin):
    list_display = ["from_kassa", "to_kassa", "amount", "created_by", "created_at"]
    list_filter = ["created_at"]
    search_fields = ["from_kassa__name", "to_kassa__name", "created_by"]


@admin.register(PaymentMethod)
class PaymentMethodAdmin(admin.ModelAdmin):
    list_display = ["name", "icon", "color", "is_active", "order"]
    list_filter = ["is_active"]
    list_editable = ["is_active", "order"]


@admin.register(ExpenseCategory)
class ExpenseCategoryAdmin(admin.ModelAdmin):
    list_display = ["name", "is_active", "order", "created_at"]
    list_filter = ["is_active"]
    list_editable = ["is_active", "order"]


@admin.register(SmsHistory)
class SmsHistoryAdmin(admin.ModelAdmin):
    list_display = ["student_name", "recipient_name", "recipient_phone", "sms_type", "status", "sent_by", "created_at"]
    list_filter = ["sms_type", "status"]
    search_fields = ["student_name", "recipient_name", "recipient_phone"]
    readonly_fields = ["created_at"]


@admin.register(TeacherBalance)
class TeacherBalanceAdmin(admin.ModelAdmin):
    list_display = ["employee", "balance", "updated_at"]
    search_fields = ["employee__first_name", "employee__last_name"]
    readonly_fields = ["updated_at"]


@admin.register(TeacherTransaction)
class TeacherTransactionAdmin(admin.ModelAdmin):
    list_display = ["employee", "amount", "transaction_type", "student", "group", "payment_method", "created_by", "created_at"]
    list_filter = ["transaction_type", "created_at"]
    search_fields = ["employee__first_name", "employee__last_name", "student__first_name", "student__last_name", "description"]


@admin.register(GroupTeacherAssignment)
class GroupTeacherAssignmentAdmin(admin.ModelAdmin):
    list_display = ["group", "teacher", "start_date", "end_date", "created_at"]
    list_filter = ["start_date", "end_date"]
    search_fields = ["group__name", "teacher__first_name", "teacher__last_name"]


@admin.register(LessonTeacherSalary)
class LessonTeacherSalaryAdmin(admin.ModelAdmin):
    list_display = ["date", "student", "group", "teacher", "teacher_percent", "teacher_amount", "status", "payment_date"]
    list_filter = ["status", "date"]
    search_fields = ["student__first_name", "student__last_name", "teacher__first_name", "teacher__last_name", "group__name"]


@admin.register(PermissionModel)
class PermissionAdmin(admin.ModelAdmin):
    list_display = ["codename", "name", "module", "action", "is_active", "created_at"]
    list_filter = ["module", "is_active"]
    search_fields = ["codename", "name", "description"]
    readonly_fields = ["created_at"]


@admin.register(AdminPermission)
class AdminPermissionAdmin(admin.ModelAdmin):
    list_display = ["user", "permission", "granted_by", "created_at"]
    list_filter = ["permission__module"]
    search_fields = ["user__username", "permission__codename"]
    autocomplete_fields = ["user", "permission"]
    readonly_fields = ["created_at"]


@admin.register(PermissionAuditLog)
class PermissionAuditLogAdmin(admin.ModelAdmin):
    list_display = ["actor", "target_user", "permission_codename", "permission_module", "action", "created_at"]
    list_filter = ["action", "permission_module", "created_at"]
    search_fields = ["actor__username", "target_user__username", "permission_codename"]
    readonly_fields = ["created_at"]


@admin.register(Feedback)
class FeedbackAdmin(admin.ModelAdmin):
    list_display = ["student", "category", "status", "message_preview", "admin_response", "created_at"]
    list_filter = ["category", "status", "created_at"]
    search_fields = ["student__first_name", "student__last_name", "message"]
    readonly_fields = ["created_at"]

    @admin.display(description="Xabar")
    def message_preview(self, obj):
        return (obj.message or "")[:60]

@admin.register(Chat)
class ChatAdmin(admin.ModelAdmin):
    list_display = ["id", "title", "chat_type", "group", "created_at"]
    list_filter = ["chat_type", "created_at"]
    search_fields = ["title", "group__name"]


@admin.register(ChatMember)
class ChatMemberAdmin(admin.ModelAdmin):
    list_display = ["chat", "student", "employee", "user", "is_admin", "joined_at"]
    list_filter = ["is_admin", "joined_at"]
    search_fields = ["chat__title", "student__first_name", "employee__first_name"]

    @admin.display(description="Ishtirokchi")
    def who(self, obj):
        return str(obj.student or obj.employee or obj.user or "-")


@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display = ["id", "chat", "sender", "media_type", "created_at"]
    list_filter = ["media_type", "created_at"]
    search_fields = ["text", "chat__title", "student__first_name", "employee__first_name"]

    @admin.display(description="Yuboruvchi")
    def sender(self, obj):
        return str(obj.student or obj.employee or obj.user or "-")


@admin.register(News)
class NewsAdmin(admin.ModelAdmin):
    list_display = ["id", "title", "category", "audience", "is_published", "is_pinned", "published_at", "created_by"]
    list_filter = ["category", "audience", "is_published", "is_pinned"]
    search_fields = ["title", "body"]
    filter_horizontal = ["groups"]
    readonly_fields = ["created_at", "updated_at"]


@admin.register(NewsCategory)
class NewsCategoryAdmin(admin.ModelAdmin):
    list_display = ["id", "label", "value", "is_active", "order"]
    list_filter = ["is_active"]
    search_fields = ["label", "value"]
    list_editable = ["is_active", "order"]
