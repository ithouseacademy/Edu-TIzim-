from django.urls import path

from . import views

# Xodim (admin + o'qituvchi) — backend/urls.py da "api/employee/" ostida include qilinadi
admin_urlpatterns = [
    # Dashboard / settings
    path("coins/summary", views.coin_summary, name="coin_summary"),
    path("coins/settings", views.coin_settings, name="coin_settings"),
    path("coins/teacher-limits", views.coin_teacher_limits, name="coin_teacher_limits"),
    path("coins/teacher-limits/<int:pk>/", views.coin_teacher_limits, name="coin_teacher_limit_detail"),

    # Reasons
    path("coins/reasons", views.coin_reasons, name="coin_reasons"),
    path("coins/reasons/<int:pk>/", views.coin_reason_detail, name="coin_reason_detail"),
    path("coins/reasons/<int:pk>/toggle", views.coin_reason_toggle, name="coin_reason_toggle"),

    # Transactions / students
    path("coins/transactions", views.coin_transactions, name="coin_transactions"),
    path("coins/students", views.coin_students, name="coin_students"),
    path("coins/students/<int:pk>/", views.coin_student_detail, name="coin_student_detail"),
    path("coins/give", views.coin_give, name="coin_give"),
    path("coins/adjust", views.coin_adjust, name="coin_adjust"),

    # Teacher activity
    path("coins/teachers", views.coin_teachers, name="coin_teachers"),
    path("coins/my-transactions", views.coin_my_transactions, name="coin_my_transactions"),

    # Reports / leaderboard / audit
    path("coins/reports", views.coin_reports, name="coin_reports"),
    path("coins/report-students", views.coin_report_students, name="coin_report_students"),
    path("coins/leaderboard", views.coin_leaderboard, name="coin_leaderboard"),
    path("coins/audit", views.coin_audit, name="coin_audit"),

    # Shop — admin/teacher
    path("shop/categories", views.shop_categories, name="shop_categories"),
    path("shop/categories/<int:pk>/toggle", views.shop_category_toggle, name="shop_category_toggle"),
    path("shop/products", views.shop_products, name="shop_products"),
    path("shop/products/<int:pk>/", views.shop_product_detail, name="shop_product_detail"),
    path("shop/orders", views.shop_orders, name="shop_orders"),
    path("shop/orders/<int:pk>/status", views.shop_order_status, name="shop_order_status"),
]

# O'quvchi — backend/urls.py da "api/student/" ostida include qilinadi
student_urlpatterns = [
    path("coins/my-summary", views.student_coin_summary_api, name="student_coin_summary"),
    path("coins/my-history", views.student_coin_history_api, name="student_coin_history"),
    path("coins/my-leaderboard", views.student_leaderboard, name="student_coin_leaderboard"),
    path("coins/shop/products", views.student_shop_products, name="student_shop_products"),
    path("coins/shop/buy", views.student_shop_buy, name="student_shop_buy"),
    path("coins/shop/orders", views.student_shop_orders, name="student_shop_orders"),
]