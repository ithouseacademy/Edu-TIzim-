from django.contrib import admin

from .models import (
    CoinAuditLog,
    CoinBalance,
    CoinConfig,
    CoinNotification,
    CoinReason,
    CoinTransaction,
    ShopCategory,
    ShopOrder,
    ShopProduct,
    TeacherCoinLimit,
)


@admin.register(CoinConfig)
class CoinConfigAdmin(admin.ModelAdmin):
    list_display = (
        "attendance_present_amount",
        "attendance_absent_amount",
        "attendance_excused_amount",
        "teacher_daily_limit",
        "leaderboard_enabled",
        "shop_enabled",
    )


@admin.register(CoinReason)
class CoinReasonAdmin(admin.ModelAdmin):
    list_display = ("name", "reason_type", "amount", "is_active", "created_at")
    list_filter = ("reason_type", "is_active")
    search_fields = ("name",)
    actions = ("deactivate_reasons",)

    @admin.action(description="Tanlangan sabablarni o'chirish (soft)")
    def deactivate_reasons(self, request, queryset):
        queryset.update(is_active=False)


@admin.register(CoinTransaction)
class CoinTransactionAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "student",
        "transaction_type",
        "amount",
        "reason_name",
        "created_by",
        "status",
        "group",
        "created_at",
    )
    list_filter = ("transaction_type", "status", "created_at")
    search_fields = ("student__first_name", "student__last_name", "reason_name", "description")
    date_hierarchy = "created_at"
    readonly_fields = ("idempotency_key",)
    show_full_result_count = False


@admin.register(CoinBalance)
class CoinBalanceAdmin(admin.ModelAdmin):
    list_display = ("student", "balance", "updated_at")
    search_fields = ("student__first_name", "student__last_name", "student__phone")


@admin.register(TeacherCoinLimit)
class TeacherCoinLimitAdmin(admin.ModelAdmin):
    list_display = ("employee", "daily_limit", "is_enabled")
    search_fields = ("employee__first_name", "employee__last_name")


@admin.register(CoinNotification)
class CoinNotificationAdmin(admin.ModelAdmin):
    list_display = ("student", "text", "is_read", "created_at")
    list_filter = ("is_read",)


@admin.register(ShopCategory)
class ShopCategoryAdmin(admin.ModelAdmin):
    list_display = ("name", "is_active")


@admin.register(ShopProduct)
class ShopProductAdmin(admin.ModelAdmin):
    list_display = ("name", "category", "coin_price", "stock", "is_active", "created_at")
    list_filter = ("category", "is_active")
    search_fields = ("name",)


@admin.register(ShopOrder)
class ShopOrderAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "student",
        "product_name",
        "product_price",
        "quantity",
        "status",
        "created_at",
    )
    list_filter = ("status",)
    search_fields = ("student__first_name", "student__last_name", "product_name")


@admin.register(CoinAuditLog)
class CoinAuditLogAdmin(admin.ModelAdmin):
    list_display = ("id", "student", "action", "actor_name", "created_at")
    list_filter = ("action", "created_at")
    search_fields = ("details", "actor_name")