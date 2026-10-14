from django.db import migrations
from django.db import models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ("frontend", "0074_messaging"),
    ]

    operations = [
        migrations.CreateModel(
            name="CoinConfig",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                (
                    "attendance_present_amount",
                    models.IntegerField(default=5, verbose_name="Keldi — bonus"),
                ),
                (
                    "attendance_absent_amount",
                    models.IntegerField(default=-20, verbose_name="Kelmadi — penalty"),
                ),
                (
                    "attendance_excused_amount",
                    models.IntegerField(default=0, verbose_name="Sababli — coin"),
                ),
                (
                    "attendance_present_enabled",
                    models.BooleanField(default=True, verbose_name="Keldi uchun coin berilsin"),
                ),
                (
                    "attendance_absent_enabled",
                    models.BooleanField(default=True, verbose_name="Kelmadi uchun penalty olinsin"),
                ),
                (
                    "attendance_excused_enabled",
                    models.BooleanField(default=False, verbose_name="Sababli uchun coin berilsin"),
                ),
                ("teacher_daily_limit", models.IntegerField(default=50, verbose_name="O'qituvchi kunlik limiti")),
                ("leaderboard_enabled", models.BooleanField(default=True, verbose_name="Leaderboard yoqilgan")),
                ("shop_enabled", models.BooleanField(default=True, verbose_name="Shop yoqilgan")),
                ("updated_at", models.DateTimeField(auto_now=True, verbose_name="Yangilangan")),
            ],
            options={
                "verbose_name": "Coin sozlamasi",
                "verbose_name_plural": "Coin sozlamalari",
            },
        ),
        migrations.CreateModel(
            name="CoinReason",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=255, verbose_name="Sabab nomi")),
                (
                    "reason_type",
                    models.CharField(
                        choices=[("BONUS", "Bonus"), ("PENALTY", "Penalty")],
                        max_length=10,
                        verbose_name="Turi",
                    ),
                ),
                ("amount", models.IntegerField(default=0, verbose_name="Coin miqdori")),
                ("is_active", models.BooleanField(default=True, verbose_name="Faol")),
                ("created_at", models.DateTimeField(auto_now_add=True, verbose_name="Yaratilgan")),
            ],
            options={
                "verbose_name": "Coin sababi",
                "verbose_name_plural": "Coin sabablari",
                "ordering": ["reason_type", "created_at"],
            },
        ),
        migrations.CreateModel(
            name="TeacherCoinLimit",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("daily_limit", models.IntegerField(blank=True, null=True, verbose_name="Kunlik limit")),
                ("is_enabled", models.BooleanField(default=True, verbose_name="Limit amal qiladi")),
                ("updated_at", models.DateTimeField(auto_now=True, verbose_name="Yangilangan")),
                (
                    "employee",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="coin_limit",
                        to="frontend.employee",
                        verbose_name="O'qituvchi",
                    ),
                ),
            ],
            options={
                "verbose_name": "O'qituvchi coin limiti",
                "verbose_name_plural": "O'qituvchi coin limitlari",
            },
        ),
        migrations.CreateModel(
            name="ShopCategory",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=255, verbose_name="Kategoriya nomi")),
                ("is_active", models.BooleanField(default=True, verbose_name="Faol")),
                ("created_at", models.DateTimeField(auto_now_add=True, verbose_name="Yaratilgan")),
            ],
            options={
                "verbose_name": "Shop kategoriyasi",
                "verbose_name_plural": "Shop kategoriyalari",
                "ordering": ["name"],
            },
        ),
        migrations.CreateModel(
            name="ShopProduct",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=255, verbose_name="Mahsulot nomi")),
                ("image", models.ImageField(upload_to="shop/", blank=True, null=True, verbose_name="Rasm")),
                ("description", models.TextField(blank=True, default="", verbose_name="Tavsif")),
                ("coin_price", models.IntegerField(default=0, verbose_name="Coin narxi")),
                ("stock", models.IntegerField(default=0, verbose_name="Qoldiq")),
                ("is_active", models.BooleanField(default=True, verbose_name="Faol")),
                ("created_at", models.DateTimeField(auto_now_add=True, verbose_name="Yaratilgan")),
                ("updated_at", models.DateTimeField(auto_now=True, verbose_name="Yangilangan")),
                (
                    "category",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="products",
                        to="coins.shopcategory",
                        verbose_name="Kategoriya",
                    ),
                ),
            ],
            options={
                "verbose_name": "Shop mahsuloti",
                "verbose_name_plural": "Shop mahsulotlari",
                "ordering": ["name"],
            },
        ),
        migrations.CreateModel(
            name="CoinBalance",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("balance", models.IntegerField(default=0, verbose_name="Balans")),
                ("updated_at", models.DateTimeField(auto_now=True, verbose_name="Yangilangan")),
                (
                    "student",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="coin_balance",
                        to="frontend.student",
                        verbose_name="O'quvchi",
                    ),
                ),
            ],
            options={
                "verbose_name": "O'quvchi coin balansi",
                "verbose_name_plural": "O'quvchi coin balanslari",
            },
        ),
        migrations.CreateModel(
            name="ShopOrder",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("product_name", models.CharField(max_length=255, verbose_name="Mahsulot nomi")),
                ("product_price", models.IntegerField(default=0, verbose_name="Coin narxi")),
                ("quantity", models.PositiveIntegerField(default=1, verbose_name="Soni")),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("pending", "Pending"),
                            ("approved", "Approved"),
                            ("given", "Given"),
                            ("cancelled", "Cancelled"),
                        ],
                        default="pending",
                        max_length=15,
                        verbose_name="Holati",
                    ),
                ),
                ("created_by", models.CharField(blank=True, default="", max_length=255, verbose_name="Kim tomonidan")),
                ("given_at", models.DateTimeField(blank=True, null=True, verbose_name="Berilgan vaqt")),
                ("created_at", models.DateTimeField(auto_now_add=True, verbose_name="Yaratilgan")),
                ("updated_at", models.DateTimeField(auto_now=True, verbose_name="Yangilangan")),
                (
                    "product",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="orders",
                        to="coins.shopproduct",
                        verbose_name="Mahsulot",
                    ),
                ),
                (
                    "student",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="coin_orders",
                        to="frontend.student",
                        verbose_name="O'quvchi",
                    ),
                ),
            ],
            options={
                "verbose_name": "Shop order",
                "verbose_name_plural": "Shop orderlar",
                "ordering": ["-created_at"],
            },
        ),
        migrations.CreateModel(
            name="CoinTransaction",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("amount", models.IntegerField(verbose_name="Coin miqdori")),
                (
                    "transaction_type",
                    models.CharField(
                        choices=[
                            ("BONUS", "Bonus"),
                            ("PENALTY", "Penalty"),
                            ("ATTENDANCE", "Davomat"),
                            ("SHOP", "Shop"),
                            ("ADJUSTMENT", "Sozlash"),
                            ("REVERSAL", "Reversal"),
                        ],
                        max_length=15,
                        verbose_name="Tranzaksiya turi",
                    ),
                ),
                ("reason_name", models.CharField(blank=True, default="", max_length=255, verbose_name="Sabab (snapshot)")),
                ("reason_amount", models.IntegerField(blank=True, null=True, verbose_name="Sabab coini (snapshot)")),
                ("description", models.TextField(blank=True, default="", verbose_name="Izoh")),
                ("created_by", models.CharField(blank=True, default="", max_length=255, verbose_name="Kim tomonidan")),
                ("attendance_status", models.CharField(blank=True, default="", max_length=15, verbose_name="Davomat holati")),
                ("group_name", models.CharField(blank=True, default="", max_length=255, verbose_name="Guruh (snapshot)")),
                (
                    "status",
                    models.CharField(
                        choices=[("active", "Faol"), ("reversed", "Reversal qilingan")],
                        default="active",
                        max_length=10,
                        verbose_name="Holati",
                    ),
                ),
                ("idempotency_key", models.CharField(blank=True, null=True, max_length=255, unique=True)),
                ("created_at", models.DateTimeField(auto_now_add=True, verbose_name="Yaratilgan")),
                (
                    "attendance",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="coin_transactions",
                        to="frontend.attendance",
                        verbose_name="Davomat",
                    ),
                ),
                (
                    "created_by_employee",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="coin_transactions",
                        to="frontend.employee",
                        verbose_name="Kim (xodim)",
                    ),
                ),
                (
                    "created_by_user",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="coin_transactions",
                        to="auth.user",
                        verbose_name="Kim (foydalanuvchi)",
                    ),
                ),
                (
                    "group",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="coin_transactions",
                        to="frontend.group",
                        verbose_name="Guruh",
                    ),
                ),
                (
                    "reason",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="coin_transactions",
                        to="coins.coinreason",
                        verbose_name="Sabab",
                    ),
                ),
                (
                    "reversal_of",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="reversals",
                        to="coins.cointransaction",
                        verbose_name="Qaysi tranzaksiya reversal qilingan",
                    ),
                ),
                (
                    "shop_order",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="coin_transactions",
                        to="coins.shoporder",
                        verbose_name="Shop order",
                    ),
                ),
                (
                    "student",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="coin_transactions",
                        to="frontend.student",
                        verbose_name="O'quvchi",
                    ),
                ),
            ],
            options={
                "verbose_name": "Coin tranzaksiyasi",
                "verbose_name_plural": "Coin tranzaksiyalari",
                "ordering": ["-created_at"],
                "indexes": [
                    models.Index(fields=["student", "-created_at"], name="coin_tx_stud_created_idx"),
                    models.Index(fields=["attendance"], name="coin_tx_attendance_idx"),
                ],
            },
        ),
        migrations.CreateModel(
            name="CoinNotification",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("text", models.TextField(verbose_name="Matn")),
                ("kind", models.CharField(blank=True, default="", max_length=20, verbose_name="Turi")),
                ("is_read", models.BooleanField(default=False, verbose_name="O'qilgan")),
                ("created_at", models.DateTimeField(auto_now_add=True, verbose_name="Yaratilgan")),
                (
                    "student",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="coin_notifications",
                        to="frontend.student",
                        verbose_name="O'quvchi",
                    ),
                ),
                (
                    "transaction",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="notifications",
                        to="coins.cointransaction",
                        verbose_name="Tranzaksiya",
                    ),
                ),
            ],
            options={
                "verbose_name": "Coin bildirishnomasi",
                "verbose_name_plural": "Coin bildirishnomalari",
                "ordering": ["-created_at"],
            },
        ),
        migrations.CreateModel(
            name="CoinAuditLog",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("action", models.CharField(max_length=50, verbose_name="Harakat")),
                ("details", models.TextField(blank=True, default="", verbose_name="Tavsif")),
                ("actor_name", models.CharField(blank=True, default="", max_length=255, verbose_name="Kim tomonidan")),
                ("created_at", models.DateTimeField(auto_now_add=True, verbose_name="Sana")),
                (
                    "actor_user",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="coin_audit_logs",
                        to="auth.user",
                        verbose_name="Kim (foydalanuvchi)",
                    ),
                ),
                (
                    "coin_transaction",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="audit_logs",
                        to="coins.cointransaction",
                        verbose_name="Coin tranzaksiyasi",
                    ),
                ),
                (
                    "student",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="coin_audit_logs",
                        to="frontend.student",
                        verbose_name="O'quvchi",
                    ),
                ),
            ],
            options={
                "verbose_name": "Coin audit logi",
                "verbose_name_plural": "Coin audit loglari",
                "ordering": ["-created_at"],
            },
        ),
    ]