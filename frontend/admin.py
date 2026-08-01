from django.contrib import admin
from .models import Course, CourseLevel, MarketingSurvey, Group, Student, LessonTime, StudentLog, Branch, Room, Role, Position, Employee, Attendance, AbsenceReason, GroupLog, VerificationCode, StudentBalance, Transaction, StudentLessonPrice, GlobalConfig, ReceiptTemplate, ReceiptSettings, Kassa, KassaTransaction, KassaTransfer, PaymentMethod, ExpenseCategory, SmsHistory

admin.site.register(Course)
admin.site.register(CourseLevel)
admin.site.register(MarketingSurvey)
admin.site.register(Group)
admin.site.register(Student)
admin.site.register(LessonTime)
admin.site.register(StudentLog)
admin.site.register(Branch)
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
