from django.db import models
from django.conf import settings


class CoinConfig(models.Model):
    attendance_present_amount = models.IntegerField(default=5, verbose_name="Keldi — bonus")
    attendance_absent_amount = models.IntegerField(default=-20, verbose_name="Kelmadi — penalty")
    attendance_excused_amount = models.IntegerField(default=0, verbose_name="Sababli — coin")
    attendance_present_enabled = models.BooleanField(default=True, verbose_name="Keldi uchun coin berilsin")
    attendance_absent_enabled = models.BooleanField(default=True, verbose_name="Kelmadi uchun penalty olinsin")
    attendance_excused_enabled = models.BooleanField(default=False, verbose_name="Sababli uchun coin berilsin")
    teacher_daily_limit = models.IntegerField(default=50, verbose_name="O'qituvchi kunlik limiti")
    leaderboard_enabled = models.BooleanField(default=True, verbose_name="Leaderboard yoqilgan")
    shop_enabled = models.BooleanField(default=True, verbose_name="Shop yoqilgan")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Yangilangan")

    class Meta:
        verbose_name = "Coin sozlamasi"
        verbose_name_plural = "Coin sozlamalari"

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)

    @classmethod
    def get_instance(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj

    def __str__(self):
        return f"Coin sozlamalari (keldi={self.attendance_present_amount}, kelmadi={self.attendance_absent_amount})"


class CoinReasonActiveManager(models.Manager):
    def get_queryset(self):
        return super().get_queryset().filter(is_active=True)


class CoinReason(models.Model):
    class Type(models.TextChoices):
        BONUS = "BONUS", "Bonus"
        PENALTY = "PENALTY", "Penalty"

    name = models.CharField(max_length=255, verbose_name="Sabab nomi")
    reason_type = models.CharField(max_length=10, choices=Type.choices, verbose_name="Turi")
    amount = models.IntegerField(default=0, verbose_name="Coin miqdori")
    is_active = models.BooleanField(default=True, verbose_name="Faol")
    branch = models.ForeignKey(
        "frontend.Branch", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="coin_reasons", verbose_name="Filial (bo'sh = barcha filiallar)",
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Yaratilgan")

    objects = models.Manager()
    active = CoinReasonActiveManager()

    class Meta:
        verbose_name = "Coin sababi"
        verbose_name_plural = "Coin sabablari"
        ordering = ["reason_type", "created_at"]

    def deactivate(self):
        self.is_active = False
        self.save(update_fields=["is_active"])

    def __str__(self):
        return f"{self.name} ({self.amount:+})"


class CoinTransaction(models.Model):
    class Type(models.TextChoices):
        BONUS = "BONUS", "Bonus"
        PENALTY = "PENALTY", "Penalty"
        ATTENDANCE = "ATTENDANCE", "Davomat"
        SHOP = "SHOP", "Shop"
        ADJUSTMENT = "ADJUSTMENT", "Sozlash"
        REVERSAL = "REVERSAL", "Reversal"

    class Status(models.TextChoices):
        ACTIVE = "active", "Faol"
        REVERSED = "reversed", "Reversal qilingan"

    student = models.ForeignKey(
        "frontend.Student", on_delete=models.CASCADE, related_name="coin_transactions", verbose_name="O'quvchi"
    )
    group = models.ForeignKey(
        "frontend.Group", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="coin_transactions", verbose_name="Guruh",
    )
    group_name = models.CharField(max_length=255, blank=True, default="", verbose_name="Guruh (snapshot)")
    amount = models.IntegerField(verbose_name="Coin miqdori")
    transaction_type = models.CharField(max_length=15, choices=Type.choices, verbose_name="Tranzaksiya turi")
    reason = models.ForeignKey(
        "coins.CoinReason", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="coin_transactions", verbose_name="Sabab",
    )
    reason_name = models.CharField(max_length=255, blank=True, default="", verbose_name="Sabab (snapshot)")
    reason_amount = models.IntegerField(null=True, blank=True, verbose_name="Sabab coini (snapshot)")
    description = models.TextField(blank=True, default="", verbose_name="Izoh")
    created_by = models.CharField(max_length=255, blank=True, default="", verbose_name="Kim tomonidan")
    created_by_user = models.ForeignKey(
        "auth.User", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="coin_transactions", verbose_name="Kim (foydalanuvchi)",
    )
    created_by_employee = models.ForeignKey(
        "frontend.Employee", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="coin_transactions", verbose_name="Kim (xodim)",
    )
    attendance = models.ForeignKey(
        "frontend.Attendance", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="coin_transactions", verbose_name="Davomat",
    )
    attendance_status = models.CharField(max_length=15, blank=True, default="", verbose_name="Davomat holati")
    shop_order = models.ForeignKey(
        "coins.ShopOrder", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="coin_transactions", verbose_name="Shop order",
    )
    reversal_of = models.ForeignKey(
        "self", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="reversals", verbose_name="Qaysi tranzaksiya reversal qilingan",
    )
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.ACTIVE, verbose_name="Holati")
    idempotency_key = models.CharField(max_length=255, null=True, blank=True, unique=True)
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Yaratilgan")

    class Meta:
        verbose_name = "Coin tranzaksiyasi"
        verbose_name_plural = "Coin tranzaksiyalari"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["student", "-created_at"], name="coin_tx_stud_created_idx"),
            models.Index(fields=["attendance"], name="coin_tx_attendance_idx"),
        ]

    def __str__(self):
        return f"{self.student} — {self.amount:+} Coin ({self.get_transaction_type_display()})"

    def mark_reversed(self):
        # idempotency_key ni tozalash muhim: "att:{id}" kabi key qayta ishlatilmasligi
        # uchun, aks holda unique constraint buziladi (original transaction reversed bo'lsa ham).
        if self.status != self.Status.REVERSED:
            self.status = self.Status.REVERSED
            self.idempotency_key = None
            self.save(update_fields=["status", "idempotency_key"])


class CoinBalance(models.Model):
    student = models.OneToOneField(
        "frontend.Student", on_delete=models.CASCADE, related_name="coin_balance", verbose_name="O'quvchi"
    )
    balance = models.IntegerField(default=0, verbose_name="Balans")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Yangilangan")

    class Meta:
        verbose_name = "O'quvchi coin balansi"
        verbose_name_plural = "O'quvchi coin balanslari"

    def __str__(self):
        return f"{self.student} — {self.balance} Coin"


class TeacherCoinLimit(models.Model):
    employee = models.OneToOneField(
        "frontend.Employee", on_delete=models.CASCADE, related_name="coin_limit", verbose_name="O'qituvchi"
    )
    daily_limit = models.IntegerField(null=True, blank=True, verbose_name="Kunlik limit")
    is_enabled = models.BooleanField(default=True, verbose_name="Limit amal qiladi")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Yangilangan")

    class Meta:
        verbose_name = "O'qituvchi coin limiti"
        verbose_name_plural = "O'qituvchi coin limitlari"

    @classmethod
    def get_for(cls, employee):
        obj, _ = cls.objects.get_or_create(employee=employee)
        return obj


class CoinNotification(models.Model):
    student = models.ForeignKey(
        "frontend.Student", on_delete=models.CASCADE, related_name="coin_notifications", verbose_name="O'quvchi"
    )
    text = models.TextField(verbose_name="Matn")
    kind = models.CharField(max_length=20, blank=True, default="", verbose_name="Turi")
    transaction = models.ForeignKey(
        "coins.CoinTransaction", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="notifications", verbose_name="Tranzaksiya",
    )
    is_read = models.BooleanField(default=False, verbose_name="O'qilgan")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Yaratilgan")

    class Meta:
        verbose_name = "Coin bildirishnomasi"
        verbose_name_plural = "Coin bildirishnomalari"
        ordering = ["-created_at"]


class ShopCategory(models.Model):
    name = models.CharField(max_length=255, verbose_name="Kategoriya nomi")
    is_active = models.BooleanField(default=True, verbose_name="Faol")
    branch = models.ForeignKey(
        "frontend.Branch", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="shop_categories", verbose_name="Filial (bo'sh = barcha filiallar)",
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Yaratilgan")

    class Meta:
        verbose_name = "Shop kategoriyasi"
        verbose_name_plural = "Shop kategoriyalari"
        ordering = ["name"]

    def __str__(self):
        return self.name


class ShopProductActiveManager(models.Manager):
    def get_queryset(self):
        return super().get_queryset().filter(is_active=True)


class ShopProduct(models.Model):
    name = models.CharField(max_length=255, verbose_name="Mahsulot nomi")
    image = models.ImageField(upload_to="shop/", blank=True, null=True, verbose_name="Rasm")
    description = models.TextField(blank=True, default="", verbose_name="Tavsif")
    category = models.ForeignKey(
        ShopCategory, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="products", verbose_name="Kategoriya",
    )
    branch = models.ForeignKey(
        "frontend.Branch", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="shop_products", verbose_name="Filial (o'quv markaz)",
    )
    coin_price = models.IntegerField(default=0, verbose_name="Coin narxi")
    stock = models.IntegerField(default=0, verbose_name="Qoldiq")
    is_active = models.BooleanField(default=True, verbose_name="Sotuvda")
    is_visible = models.BooleanField(default=True, verbose_name="Ko'rinadi (o'quvchiga)")
    show_price = models.BooleanField(default=True, verbose_name="Narx ko'rsatilsin")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Yaratilgan")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Yangilangan")

    objects = models.Manager()
    active = ShopProductActiveManager()

    class Meta:
        verbose_name = "Shop mahsuloti"
        verbose_name_plural = "Shop mahsulotlari"
        ordering = ["name"]

    @property
    def state(self):
        """Mahsulot holati: pending / visible / sale."""
        if not self.is_visible:
            return "pending"
        return "sale" if self.is_active else "visible"

    def set_state(self, state):
        """Holatni o'rnatadi: 'pending' / 'visible' / 'sale'."""
        self.is_active = state == "sale"
        self.is_visible = state in ("visible", "sale")

    def __str__(self):
        return f"{self.name} — {self.coin_price} Coin"


class ShopOrder(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        APPROVED = "approved", "Approved"
        GIVEN = "given", "Given"
        CANCELLED = "cancelled", "Cancelled"

    student = models.ForeignKey(
        "frontend.Student", on_delete=models.CASCADE, related_name="coin_orders", verbose_name="O'quvchi"
    )
    product = models.ForeignKey(
        ShopProduct, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="orders", verbose_name="Mahsulot",
    )
    product_name = models.CharField(max_length=255, verbose_name="Mahsulot nomi")
    product_price = models.IntegerField(default=0, verbose_name="Coin narxi")
    quantity = models.PositiveIntegerField(default=1, verbose_name="Soni")
    status = models.CharField(
        max_length=15,
        choices=Status.choices,
        default=Status.PENDING,
        verbose_name="Holati",
    )
    created_by = models.CharField(max_length=255, blank=True, default="", verbose_name="Kim tomonidan")
    given_at = models.DateTimeField(null=True, blank=True, verbose_name="Berilgan vaqt")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Yaratilgan")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Yangilangan")

    class Meta:
        verbose_name = "Shop order"
        verbose_name_plural = "Shop orderlar"
        ordering = ["-created_at"]

    def __str__(self):
        return f"#{self.id} {self.student} — {self.product_name} ({self.get_status_display()})"


class CoinAuditLog(models.Model):
    student = models.ForeignKey(
        "frontend.Student", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="coin_audit_logs", verbose_name="O'quvchi",
    )
    action = models.CharField(max_length=50, verbose_name="Harakat")
    coin_transaction = models.ForeignKey(
        CoinTransaction, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="audit_logs", verbose_name="Coin tranzaksiyasi",
    )
    actor_user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="coin_audit_logs", verbose_name="Kim (foydalanuvchi)",
    )
    actor_name = models.CharField(max_length=255, blank=True, default="", verbose_name="Kim tomonidan")
    details = models.TextField(blank=True, default="", verbose_name="Tavsif")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Sana")

    class Meta:
        verbose_name = "Coin audit logi"
        verbose_name_plural = "Coin audit loglari"
        ordering = ["-created_at"]