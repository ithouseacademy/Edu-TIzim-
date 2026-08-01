from django.db import models
from datetime import date, timedelta, datetime
from decimal import Decimal


class ActiveManager(models.Manager):
    def get_queryset(self):
        return super().get_queryset().filter(is_active=True)


class SoftDeleteManager(models.Manager):
    def get_queryset(self):
        return super().get_queryset().filter(is_deleted=False)


class Course(models.Model):
    name = models.CharField(max_length=255, verbose_name="Kurs nomi")
    is_active = models.BooleanField(default=True, verbose_name="Faol")
    created_at = models.DateTimeField(auto_now_add=True)

    objects = ActiveManager()
    all_objects = models.Manager()

    def delete(self, *args, **kwargs):
        self.is_active = False
        self.save(update_fields=["is_active"])

    def __str__(self):
        return self.name

    class Meta:
        verbose_name = "Kurs"
        verbose_name_plural = "Kurslar"


class CourseLevel(models.Model):
    course = models.ForeignKey(Course, on_delete=models.PROTECT, related_name="levels", verbose_name="Kurs")
    name = models.CharField(max_length=255, verbose_name="Daraja nomi")
    daily_price = models.DecimalField(max_digits=12, decimal_places=2, verbose_name="Kunlik narx (so'm)")
    is_active = models.BooleanField(default=True, verbose_name="Faol")
    created_at = models.DateTimeField(auto_now_add=True)

    objects = ActiveManager()
    all_objects = models.Manager()

    def delete(self, *args, **kwargs):
        self.is_active = False
        self.save(update_fields=["is_active"])

    def __str__(self):
        return f"{self.course.name} - {self.name}"

    class Meta:
        verbose_name = "Kurs darajasi"
        verbose_name_plural = "Kurs darajalari"
        ordering = ["course", "name"]


class MarketingSurvey(models.Model):
    name = models.CharField(max_length=255, verbose_name="So'rovnoma turi")
    is_active = models.BooleanField(default=True, verbose_name="Faol")
    created_at = models.DateTimeField(auto_now_add=True)

    objects = ActiveManager()
    all_objects = models.Manager()

    def delete(self, *args, **kwargs):
        self.is_active = False
        self.save(update_fields=["is_active"])

    def __str__(self):
        return self.name

    class Meta:
        verbose_name = "Marketing so'rovnoma"
        verbose_name_plural = "Marketing so'rovnomalar"


class Group(models.Model):
    class Status(models.TextChoices):
        ACTIVE = "aktiv", "Aktiv"
        PENDING = "kutilyotgan", "Kutilyotgan"
        CLOSED = "yopilgan", "Yopilgan"
        ARCHIVED = "arxivlangan", "Arxivlangan"

    class EducationType(models.TextChoices):
        ONLINE = "onlayn", "Onlayn"
        OFFLINE = "oflayn", "Oflayn"

    class DayType(models.TextChoices):
        ODD = "toq", "Toq kunlar"
        EVEN = "juft", "Juft kunlar"
        EVERYDAY = "har_kun", "Har kunlik"

    name = models.CharField(max_length=255, verbose_name="Guruh nomi")
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.ACTIVE,
        verbose_name="Guruh holati",
    )
    course = models.ForeignKey(
        Course, on_delete=models.SET_NULL, null=True, blank=True, related_name="groups", verbose_name="Kurs"
    )
    education_type = models.CharField(
        max_length=20,
        choices=EducationType.choices,
        default=EducationType.OFFLINE,
        verbose_name="Ta'lim turi",
    )
    day_type = models.CharField(
        max_length=20,
        choices=DayType.choices,
        default=DayType.EVERYDAY,
        verbose_name="Dars kunlari turi",
    )
    days = models.CharField(max_length=255, blank=True, null=True, verbose_name="Kunlarni yozing")
    telegram_link = models.URLField(blank=True, null=True, verbose_name="Telegram guruh havolasi")
    room = models.ForeignKey(
        "Room", on_delete=models.SET_NULL, null=True, blank=True, related_name="groups", verbose_name="Xona"
    )
    teacher = models.ForeignKey(
        "Employee", on_delete=models.SET_NULL, null=True, blank=True, related_name="teacher_groups", verbose_name="O'qituvchi"
    )
    lesson_price = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True, verbose_name="1 dars narxi")
    level = models.ForeignKey(
        "CourseLevel", on_delete=models.SET_NULL, null=True, blank=True, related_name="groups", verbose_name="Daraja"
    )
    start_date = models.DateField(null=True, blank=True, verbose_name="Boshlanish sanasi")
    end_date = models.DateField(null=True, blank=True, verbose_name="Tugash sanasi")
    is_active = models.BooleanField(default=True, verbose_name="Faol")
    created_at = models.DateTimeField(auto_now_add=True)

    objects = ActiveManager()
    all_objects = models.Manager()

    def delete(self, *args, **kwargs):
        self.is_active = False
        self.save(update_fields=["is_active"])

    def is_ending_soon(self):
        if not self.end_date:
            return False
        remaining = (self.end_date - date.today()).days
        return 0 <= remaining <= 10

    def remaining_days(self):
        if not self.end_date:
            return None
        return (self.end_date - date.today()).days

    def is_date_overdue(self):
        if not self.end_date:
            return False
        return self.end_date < date.today()

    @property
    def frozen_students_count(self):
        return self.students.filter(frozen_until__gte=date.today()).count()

    def __str__(self):
        return f"{self.name} ({self.course.name})"

    class Meta:
        verbose_name = "Guruh"
        verbose_name_plural = "Guruhlar"


class Student(models.Model):
    class Status(models.TextChoices):
        PENDING = "kutilyotgan", "Kutilyotgan"
        GRADUATED = "bitirilgan", "Bitirilgan"
        REMOVED = "chiqarilgan", "Chiqarilgan"

    user = models.OneToOneField(
        "auth.User", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="student_profile", verbose_name="Foydalanuvchi"
    )
    first_name = models.CharField(max_length=255, verbose_name="Ism")
    last_name = models.CharField(max_length=255, verbose_name="Familya")
    phone = models.CharField(max_length=20, verbose_name="Telefon raqam")
    groups = models.ManyToManyField(Group, blank=True, related_name="students", verbose_name="Guruhlar")
    graduated_groups = models.ManyToManyField(
        Group, blank=True, related_name="graduated_students", verbose_name="Bitirilgan guruhlar"
    )
    desired_course = models.ManyToManyField(
        Course, blank=True, related_name="interested_students", verbose_name="Qiziqqan kurslari"
    )
    frozen_until = models.DateField(null=True, blank=True, verbose_name="Muzlatish tugash sanasi")
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
        verbose_name="Holati",
    )
    birth_date = models.DateField(null=True, blank=True, verbose_name="Tug'ilgan sana")
    marketing_survey = models.ForeignKey(
        MarketingSurvey,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="students",
        verbose_name="Marketing so'rovnoma",
    )
    additional_info = models.TextField(blank=True, null=True, verbose_name="Qo'shimcha ma'lumotlar")
    father_full_name = models.CharField(max_length=255, blank=True, null=True, verbose_name="Otasining ism familya")
    father_phone = models.CharField(max_length=20, blank=True, null=True, verbose_name="Otasining nomeri")
    mother_full_name = models.CharField(max_length=255, blank=True, null=True, verbose_name="Onasining ism familya")
    mother_phone = models.CharField(max_length=20, blank=True, null=True, verbose_name="Onasining nomeri")
    email = models.EmailField(blank=True, null=True, verbose_name="Elektron pochta")
    lesson_time = models.CharField(max_length=50, blank=True, null=True, verbose_name="Dars vaqti")
    student_category = models.CharField(max_length=100, blank=True, null=True, verbose_name="O'quvchi kategoriyasi")
    payment_date = models.DateField(null=True, blank=True, verbose_name="To'lash sanasi")
    education_language = models.CharField(max_length=50, blank=True, default="O'zbekcha", verbose_name="O'qitish tili")
    target_university = models.CharField(max_length=255, blank=True, null=True, verbose_name="Maqsaddagi universitet")
    father_workplace = models.CharField(max_length=255, blank=True, null=True, verbose_name="Otasining ish joyi")
    mother_workplace = models.CharField(max_length=255, blank=True, null=True, verbose_name="Onasining ish joyi")
    home_address = models.TextField(blank=True, null=True, verbose_name="Uy adresi")
    address_country = models.CharField(max_length=100, blank=True, null=True, verbose_name="Davlat")
    address_region = models.CharField(max_length=100, blank=True, null=True, verbose_name="Viloyat")
    address_district = models.CharField(max_length=100, blank=True, null=True, verbose_name="Tuman")
    address_mfy = models.CharField(max_length=255, blank=True, null=True, verbose_name="MFY")
    address_street = models.CharField(max_length=255, blank=True, null=True, verbose_name="Ko'cha")
    address_house = models.CharField(max_length=50, blank=True, null=True, verbose_name="Uy raqam")
    school = models.CharField(max_length=255, blank=True, null=True, verbose_name="O'qish joyi")
    telegram_chat_id = models.CharField(max_length=50, blank=True, null=True, verbose_name="Telegram chat ID")
    is_active = models.BooleanField(default=True, verbose_name="Faol")
    is_deleted = models.BooleanField(default=False, verbose_name="O'chirilgan")
    created_at = models.DateTimeField(auto_now_add=True)

    objects = SoftDeleteManager()
    all_objects = models.Manager()

    def delete(self, *args, **kwargs):
        self.is_active = False
        self.is_deleted = True
        self.save(update_fields=["is_active", "is_deleted"])

    @property
    def is_frozen(self):
        if not self.frozen_until:
            return False
        return self.frozen_until >= date.today()

    @property
    def frozen_remaining_days(self):
        if not self.frozen_until:
            return 0
        remaining = (self.frozen_until - date.today()).days
        return max(remaining, 0)

    def __str__(self):
        return f"{self.first_name} {self.last_name}"

    class Meta:
        verbose_name = "O'quvchi"
        verbose_name_plural = "O'quvchilar"


class LessonTime(models.Model):
    DAY_CHOICES = [
        ("dushanba", "Dushanba"),
        ("seshanba", "Seshanba"),
        ("chorshanba", "Chorshanba"),
        ("payshanba", "Payshanba"),
        ("juma", "Juma"),
        ("shanba", "Shanba"),
        ("yakshanba", "Yakshanba"),
    ]

    DAY_ORDER = {d[0]: i for i, d in enumerate(DAY_CHOICES)}

    group = models.ForeignKey(
        Group, on_delete=models.PROTECT, related_name="lesson_times", verbose_name="Guruh"
    )
    days = models.CharField(max_length=255, verbose_name="Hafta kunlari")
    start_time = models.TimeField(verbose_name="Boshlanish vaqti")
    end_time = models.TimeField(verbose_name="Tugash vaqti")

    def get_days_display(self):
        day_map = dict(self.DAY_CHOICES)
        selected = [d.strip() for d in self.days.split(",") if d.strip()]
        return ", ".join(day_map.get(d, d) for d in selected)

    def __str__(self):
        return f"{self.get_days_display()} {self.start_time.strftime('%H:%M')}-{self.end_time.strftime('%H:%M')}"

    class Meta:
        verbose_name = "Dars vaqti"
        verbose_name_plural = "Dars vaqtlari"
        ordering = ["start_time"]


class StudentLog(models.Model):
    class Action(models.TextChoices):
        JOINED = "joined", "Guruhga qo'shildi"
        REMOVED = "removed", "Guruhdan chiqarildi"
        TRANSFERRED = "transferred", "Guruhdan ko'chirildi"
        GRADUATED = "graduated", "Guruhni bitirdi"
        FROZEN = "frozen", "Muzlatildi"
        UNFROZEN = "unfrozen", "Muzlatish bekor qilindi"

    student = models.ForeignKey(
        Student, on_delete=models.SET_NULL, null=True, blank=True, related_name="logs", verbose_name="O'quvchi"
    )
    group = models.ForeignKey(
        Group, on_delete=models.SET_NULL, null=True, blank=True, verbose_name="Guruh"
    )
    action = models.CharField(max_length=20, choices=Action.choices, verbose_name="Harakat")
    reason = models.TextField(blank=True, null=True, verbose_name="Sabab")
    created_by = models.CharField(max_length=255, blank=True, default="", verbose_name="Kim tomonidan")
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.student} - {self.get_action_display()}"

    class Meta:
        verbose_name = "O'quvchi harakati"
        verbose_name_plural = "O'quvchi harakatlari"
        ordering = ["-created_at"]


class GroupLog(models.Model):
    group = models.ForeignKey(Group, on_delete=models.SET_NULL, null=True, blank=True, related_name="logs", verbose_name="Guruh")
    action = models.CharField(max_length=50, verbose_name="Harakat")
    description = models.TextField(verbose_name="Tavsif")
    created_by = models.CharField(max_length=255, blank=True, default="", verbose_name="Kim tomonidan")
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.group.name} - {self.action}"

    class Meta:
        verbose_name = "Guruh tarixi"
        verbose_name_plural = "Guruh tarixlari"
        ordering = ["-created_at"]


class Branch(models.Model):
    name = models.CharField(max_length=255, verbose_name="Filial nomi")
    is_active = models.BooleanField(default=True, verbose_name="Faol")
    created_at = models.DateTimeField(auto_now_add=True)

    objects = ActiveManager()
    all_objects = models.Manager()

    def delete(self, *args, **kwargs):
        self.is_active = False
        self.save(update_fields=["is_active"])

    def __str__(self):
        return self.name

    class Meta:
        verbose_name = "Filial"
        verbose_name_plural = "Filiallar"


class Room(models.Model):
    name = models.CharField(max_length=255, verbose_name="Xona nomi")
    is_active = models.BooleanField(default=True, verbose_name="Faol")
    created_at = models.DateTimeField(auto_now_add=True)

    objects = ActiveManager()
    all_objects = models.Manager()

    def delete(self, *args, **kwargs):
        self.is_active = False
        self.save(update_fields=["is_active"])

    def __str__(self):
        return self.name

    class Meta:
        verbose_name = "Xona"
        verbose_name_plural = "Xonalar"


class Role(models.Model):
    name = models.CharField(max_length=255, verbose_name="Rol nomi")
    level = models.CharField(max_length=50, blank=True, null=True, verbose_name="Daraja")
    is_active = models.BooleanField(default=True, verbose_name="Faol")
    created_at = models.DateTimeField(auto_now_add=True)

    objects = ActiveManager()
    all_objects = models.Manager()

    def delete(self, *args, **kwargs):
        self.is_active = False
        self.save(update_fields=["is_active"])

    def __str__(self):
        return self.name

    class Meta:
        verbose_name = "Rol"
        verbose_name_plural = "Rollar"


class Position(models.Model):
    name = models.CharField(max_length=255, verbose_name="Vazifa nomi")
    is_active = models.BooleanField(default=True, verbose_name="Faol")
    created_at = models.DateTimeField(auto_now_add=True)

    objects = ActiveManager()
    all_objects = models.Manager()

    def delete(self, *args, **kwargs):
        self.is_active = False
        self.save(update_fields=["is_active"])

    def __str__(self):
        return self.name

    class Meta:
        verbose_name = "Vazifa"
        verbose_name_plural = "Vazifalar"


class Employee(models.Model):
    class Gender(models.TextChoices):
        MALE = "erkak", "Erkak"
        FEMALE = "ayol", "Ayol"

    user = models.OneToOneField(
        "auth.User", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="employee_profile", verbose_name="Foydalanuvchi"
    )
    first_name = models.CharField(max_length=255, verbose_name="Ism")
    last_name = models.CharField(max_length=255, verbose_name="Familiya")
    phone = models.CharField(max_length=20, verbose_name="Telefon raqam")
    email = models.EmailField(blank=True, null=True, verbose_name="Elektron pochta")
    gender = models.CharField(max_length=10, choices=Gender.choices, blank=True, null=True, verbose_name="Jinsi")
    birth_date = models.DateField(blank=True, null=True, verbose_name="Tug'ilgan sanasi")
    position = models.ForeignKey(Position, on_delete=models.SET_NULL, null=True, blank=True, verbose_name="Vazifasi")
    photo = models.ImageField(upload_to="employees/", blank=True, null=True, verbose_name="Profil rasmi")
    salary_enabled = models.BooleanField(default=False, verbose_name="Ish haqi chiqarish")
    branches = models.ManyToManyField(Branch, blank=True, verbose_name="Filiallar")
    role = models.ForeignKey(Role, on_delete=models.SET_NULL, null=True, blank=True, verbose_name="Rol")
    salary_same = models.BooleanField(default=False, verbose_name="Hammaga bir xil")
    salary = models.DecimalField(max_digits=12, decimal_places=2, blank=True, null=True, verbose_name="Ish haqi")
    notes = models.TextField(blank=True, null=True, verbose_name="Izoh")
    is_active = models.BooleanField(default=True, verbose_name="Faol")
    is_deleted = models.BooleanField(default=False, verbose_name="O'chirilgan")
    created_at = models.DateTimeField(auto_now_add=True)

    objects = SoftDeleteManager()
    all_objects = models.Manager()

    def delete(self, *args, **kwargs):
        self.is_active = False
        self.is_deleted = True
        self.save(update_fields=["is_active", "is_deleted"])

    def __str__(self):
        return f"{self.first_name} {self.last_name}"

    class Meta:
        verbose_name = "Xodim"
        verbose_name_plural = "Xodimlar"


class Attendance(models.Model):
    class Status(models.TextChoices):
        PRESENT = "present", "Keldi"
        ABSENT = "absent", "Kelmadi"
        EXCUSED = "excused", "Sababli kelmadi"

    group = models.ForeignKey(Group, on_delete=models.SET_NULL, null=True, blank=True, related_name="attendances", verbose_name="Guruh")
    student = models.ForeignKey(Student, on_delete=models.SET_NULL, null=True, blank=True, related_name="attendances", verbose_name="O'quvchi")
    lesson_time = models.ForeignKey("LessonTime", on_delete=models.SET_NULL, null=True, blank=True, related_name="attendances", verbose_name="Dars vaqti")
    date = models.DateField(verbose_name="Sana")
    status = models.CharField(max_length=15, choices=Status.choices, default=Status.PRESENT, verbose_name="Holati")
    teacher = models.ForeignKey("Employee", on_delete=models.SET_NULL, null=True, blank=True, related_name="attendances", verbose_name="O'qituvchi")
    created_by = models.CharField(max_length=255, blank=True, default="", verbose_name="Kim tomonidan")
    notes = models.TextField(verbose_name="Izoh", blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Davomat"
        verbose_name_plural = "Davomatlar"
        unique_together = ("group", "student", "date")

    def __str__(self):
        return f"{self.student} - {self.date} - {self.get_status_display()}"


class AbsenceReason(models.Model):
    class ReasonType(models.TextChoices):
        ABSENT = "absent", "Kelmadi"
        EXCUSED = "excused", "Sababli kelmadi"
        BOTH = "both", "Ikkalasi"

    name = models.CharField(max_length=255, verbose_name="Sabab nomi")
    reason_type = models.CharField(max_length=10, choices=ReasonType.choices, default=ReasonType.BOTH, verbose_name="Turi")
    is_active = models.BooleanField(default=True, verbose_name="Faol")
    order = models.PositiveIntegerField(default=0, verbose_name="Tartib")
    created_at = models.DateTimeField(auto_now_add=True)

    objects = ActiveManager()
    all_objects = models.Manager()

    def delete(self, *args, **kwargs):
        self.is_active = False
        self.save(update_fields=["is_active"])

    class Meta:
        verbose_name = "Davomat sababi"
        verbose_name_plural = "Davomat sabablari"
        ordering = ["order", "name"]

    def __str__(self):
        return self.name


class VerificationCode(models.Model):
    phone = models.CharField(max_length=20, verbose_name="Telefon raqam")
    code = models.CharField(max_length=128, verbose_name="Tasdiqlash kodi")
    is_used = models.BooleanField(default=False, verbose_name="Ishlatilgan")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Tasdiqlash kodi"
        verbose_name_plural = "Tasdiqlash kodlari"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.phone} - {self.code}"


class StudentLessonPrice(models.Model):
    student = models.ForeignKey(Student, on_delete=models.SET_NULL, null=True, blank=True, related_name="lesson_prices", verbose_name="O'quvchi")
    group = models.ForeignKey(Group, on_delete=models.SET_NULL, null=True, blank=True, related_name="student_lesson_prices", verbose_name="Guruh")
    lesson_price = models.DecimalField(max_digits=12, decimal_places=2, verbose_name="Shaxsiy dars narxi")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "O'quvchi shaxsiy narxi"
        verbose_name_plural = "O'quvchi shaxsiy narxlari"
        unique_together = ("student", "group")

    def __str__(self):
        return f"{self.student} - {self.group} - {self.lesson_price}"


class StudentBalance(models.Model):
    student = models.OneToOneField(Student, on_delete=models.SET_NULL, null=True, blank=True, related_name="balance", verbose_name="O'quvchi")
    balance = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'), verbose_name="Balans")
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "O'quvchi balansi"
        verbose_name_plural = "O'quvchi balanslari"

    def __str__(self):
        return f"{self.student} - {self.balance} so'm"


class Transaction(models.Model):
    class Type(models.TextChoices):
        PAYMENT = "payment", "To'lov"
        LESSON = "lesson", "Dars uchun yechildi"
        CORRECTION = "correction", "Tuzatish"
        WITHDRAWAL = "withdrawal", "Pul qaytarish"
        WRONG = "wrong", "Xato amaliyot"

    student = models.ForeignKey(Student, on_delete=models.SET_NULL, null=True, blank=True, related_name="transactions", verbose_name="O'quvchi")
    amount = models.DecimalField(max_digits=12, decimal_places=2, verbose_name="Summa")
    balance_after = models.DecimalField(max_digits=12, decimal_places=2, verbose_name="Operatsiyadan keyingi balans")
    transaction_type = models.CharField(max_length=20, choices=Type.choices, verbose_name="Operatsiya turi")
    group = models.ForeignKey(Group, on_delete=models.SET_NULL, null=True, blank=True, related_name="transactions", verbose_name="Guruh")
    attendance = models.ForeignKey("Attendance", on_delete=models.SET_NULL, null=True, blank=True, related_name="transactions", verbose_name="Davomat")
    payment_method = models.CharField(max_length=20, blank=True, default="", verbose_name="To'lov usuli")
    description = models.TextField(blank=True, null=True, verbose_name="Izoh")
    created_by = models.CharField(max_length=255, blank=True, default="", verbose_name="Kim tomonidan")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Tranzaksiya"
        verbose_name_plural = "Tranzaksiyalar"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.student} - {self.amount} ({self.get_transaction_type_display()})"


class ReceiptTemplate(models.Model):
    name = models.CharField(max_length=255, verbose_name="Template nomi")
    is_default = models.BooleanField(default=False, verbose_name="Standart")
    width = models.CharField(max_length=10, default="80mm", choices=[("58mm", "58 mm"), ("80mm", "80 mm")], verbose_name="Eni")
    height_mode = models.CharField(max_length=10, default="auto", choices=[("auto", "Avtomatik"), ("custom", "Maxsus")], verbose_name="Balandlik rejimi")
    height = models.PositiveIntegerField(default=300, verbose_name="Balandlik (mm)")
    paper_margin = models.PositiveIntegerField(default=0, verbose_name="Qog'oz cheti (mm)")
    background_color = models.CharField(max_length=7, default="#ffffff", verbose_name="Fon rangi")
    print_dpi = models.PositiveIntegerField(default=203, verbose_name="Chop etish DPI")
    thermal_mode = models.BooleanField(default=False, verbose_name="Termal printer rejimi")
    black_white = models.BooleanField(default=True, verbose_name="Qora-oq rejim")
    page_padding = models.PositiveIntegerField(default=10, verbose_name="Sahifa ichki cheti (px)")
    components = models.JSONField(default=list, blank=True, verbose_name="Komponentlar")
    is_active = models.BooleanField(default=True, verbose_name="Faol")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = ActiveManager()
    all_objects = models.Manager()

    def delete(self, *args, **kwargs):
        self.is_active = False
        self.save(update_fields=["is_active"])

    class Meta:
        verbose_name = "Chek shabloni"
        verbose_name_plural = "Chek shablonlari"

    def save(self, *args, **kwargs):
        if self.is_default:
            ReceiptTemplate.all_objects.filter(is_default=True).exclude(pk=self.pk).update(is_default=False)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name


class GlobalConfig(models.Model):
    deduct_absent = models.BooleanField(default=False, verbose_name="Sababsiz kelmaganlardan pul yechish")
    deduct_excused = models.BooleanField(default=False, verbose_name="Sababli kelmaganlardan pul yechish")

    class Meta:
        verbose_name = "Global sozlama"
        verbose_name_plural = "Global sozlamalar"

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)

    @classmethod
    def get_instance(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj

    def __str__(self):
        return f"Global sozlamalar (abs={self.deduct_absent}, exc={self.deduct_excused})"


class ReceiptSettings(models.Model):
    logo = models.ImageField(upload_to="receipt_logos/", blank=True, null=True, verbose_name="Logo")
    academy_name = models.CharField(max_length=255, default="IT HOUSE ACADEMY", verbose_name="Markaz nomi")
    tagline = models.CharField(max_length=255, default="SIFATLI TA'LIM MARKAZI", verbose_name="Tagline")
    accent_color = models.CharField(max_length=7, default="#2001FF", verbose_name="Asosiy rang")

    receipt_title = models.CharField(max_length=255, default="TO'LOV CHEKI", verbose_name="Chek sarlavhasi")
    receipt_prefix = models.CharField(max_length=50, default="Chek #", verbose_name="Chek prefiksi")
    receipt_format = models.CharField(max_length=50, default="000000", verbose_name="Chek formati")
    footer_text = models.TextField(blank=True, default="Bizni tanlaganingiz uchun rahmat!", verbose_name="Footer matni")
    thank_you_text = models.CharField(max_length=255, default="Rahmat!", verbose_name="Rahmat yozuvi")
    payment_text = models.CharField(max_length=255, default="To'lov summasi", verbose_name="To'lov matni")
    extra_notes = models.TextField(blank=True, null=True, verbose_name="Qo'shimcha izoh")
    message_text = models.CharField(max_length=255, blank=True, null=True, verbose_name="Xabar matni")

    qr_link = models.URLField(blank=True, default="", verbose_name="QR Code havolasi")
    auto_generate_qr = models.BooleanField(default=True, verbose_name="Avtomatik QR")

    phone = models.CharField(max_length=50, blank=True, default="", verbose_name="Telefon")
    sms_signature = models.CharField(max_length=255, blank=True, default="IT House: 550552727", verbose_name="SMS imzosi (oxirida chiqadi)")
    telegram = models.CharField(max_length=255, blank=True, default="", verbose_name="Telegram")
    instagram = models.CharField(max_length=255, blank=True, default="", verbose_name="Instagram")
    website = models.URLField(blank=True, default="", verbose_name="Website")
    address = models.TextField(blank=True, default="", verbose_name="Manzil")

    paper_width = models.CharField(max_length=10, default="58mm", verbose_name="Qog'oz eni")
    paper_height = models.CharField(max_length=10, default="210mm", verbose_name="Qog'oz bo'yi")
    paper_padding = models.CharField(max_length=10, default="2mm", verbose_name="Chek ichki cheti")

    font_name = models.CharField(max_length=10, default="18px", verbose_name="Markaz nomi shrifti")
    font_tagline = models.CharField(max_length=10, default="11px", verbose_name="Tagline shrifti")
    font_title = models.CharField(max_length=10, default="14px", verbose_name="Sarlavha shrifti")
    font_row = models.CharField(max_length=10, default="10px", verbose_name="Qator shrifti")
    font_amount_label = models.CharField(max_length=10, default="10px", verbose_name="To'lov yozuvi shrifti")
    font_amount = models.CharField(max_length=10, default="22px", verbose_name="Summa shrifti")
    font_balance = models.CharField(max_length=10, default="10px", verbose_name="Balans shrifti")
    font_thanks = models.CharField(max_length=10, default="14px", verbose_name="Rahmat shrifti")
    font_footer = models.CharField(max_length=10, default="10px", verbose_name="Footer shrifti")
    font_contact = models.CharField(max_length=10, default="9px", verbose_name="Kontakt shrifti")
    font_notes = models.CharField(max_length=10, default="10px", verbose_name="Izoh shrifti")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Chek sozlamasi"
        verbose_name_plural = "Chek sozlamalari"

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)

    @classmethod
    def get_instance(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj

    def __str__(self):
        return "Chek sozlamalari"


class SavedReceipt(models.Model):
    transaction = models.OneToOneField(Transaction, on_delete=models.SET_NULL, null=True, blank=True, related_name="saved_receipt", verbose_name="Tranzaksiya")
    receipt_html = models.TextField(verbose_name="Chek HTML")
    settings_snapshot = models.JSONField(default=dict, blank=True, verbose_name="Sozlamalar holati")
    created_by = models.ForeignKey("auth.User", on_delete=models.SET_NULL, null=True, blank=True, related_name="saved_receipts", verbose_name="Kim tomonidan")
    student_name = models.CharField(max_length=255, blank=True, default="", verbose_name="O'quvchi")
    amount = models.DecimalField(max_digits=12, decimal_places=2, verbose_name="Summa")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Saqlangan chek"
        verbose_name_plural = "Saqlangan cheklar"
        ordering = ["-created_at"]

    def __str__(self):
        return f"Chek #{self.transaction_id} - {self.student_name}"


class PaymentMethod(models.Model):
    name = models.CharField(max_length=100, unique=True, verbose_name="To'lov usuli nomi")
    icon = models.CharField(max_length=50, default="cash", verbose_name="Icon")
    color = models.CharField(max_length=20, default="#059669", verbose_name="Rang (hex)")
    custom_image = models.ImageField(upload_to="payment_icons/", blank=True, null=True, verbose_name="Maxsus rasm")
    is_active = models.BooleanField(default=True, verbose_name="Faol")
    order = models.PositiveIntegerField(default=0, verbose_name="Tartib")
    created_at = models.DateTimeField(auto_now_add=True)

    objects = ActiveManager()
    all_objects = models.Manager()

    def delete(self, *args, **kwargs):
        self.is_active = False
        self.save(update_fields=["is_active"])

    class Meta:
        verbose_name = "To'lov usuli"
        verbose_name_plural = "To'lov usullari"
        ordering = ["order", "name"]

    def __str__(self):
        return self.name


class IncomeCategory(models.Model):
    name = models.CharField(max_length=100, unique=True, verbose_name="Kategoriya nomi")
    is_active = models.BooleanField(default=True, verbose_name="Faol")
    order = models.PositiveIntegerField(default=0, verbose_name="Tartib")
    created_at = models.DateTimeField(auto_now_add=True)

    objects = ActiveManager()
    all_objects = models.Manager()

    def delete(self, *args, **kwargs):
        self.is_active = False
        self.save(update_fields=["is_active"])

    class Meta:
        verbose_name = "Kirim kategoriyasi"
        verbose_name_plural = "Kirim kategoriyalari"
        ordering = ["order", "name"]

    def __str__(self):
        return self.name


class Kassa(models.Model):
    owner = models.ForeignKey(
        "auth.User", on_delete=models.SET_NULL, null=True, blank=True, related_name="kassalar", verbose_name="Egasi"
    )
    name = models.CharField(max_length=255, verbose_name="Kassa nomi")
    is_active = models.BooleanField(default=True, verbose_name="Faol")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = ActiveManager()
    all_objects = models.Manager()

    def delete(self, *args, **kwargs):
        self.is_active = False
        self.save(update_fields=["is_active"])

    class Meta:
        verbose_name = "Kassa"
        verbose_name_plural = "Kassalar"

    def __str__(self):
        owner_name = (self.owner.get_full_name() or self.owner.username) if self.owner else "Noma'lum"
        return f"{self.name} ({owner_name})"

    @property
    def balance(self):
        from django.db.models import Sum
        income = KassaTransaction.objects.filter(
            kassa=self, transaction_type__in=["income", "payment", "transfer_in"]
        ).aggregate(total=Sum("amount"))["total"] or Decimal("0.00")
        expense = KassaTransaction.objects.filter(
            kassa=self, transaction_type__in=["expense", "transfer_out"]
        ).aggregate(total=Sum("amount"))["total"] or Decimal("0.00")
        return income - expense

    @property
    def today_income(self):
        from django.db.models import Sum
        today = date.today()
        return KassaTransaction.objects.filter(
            kassa=self, transaction_type__in=["income", "payment", "transfer_in"],
            created_at__date=today
        ).aggregate(total=Sum("amount"))["total"] or Decimal("0.00")

    @property
    def today_expense(self):
        from django.db.models import Sum
        today = date.today()
        return KassaTransaction.objects.filter(
            kassa=self, transaction_type__in=["expense", "transfer_out"],
            created_at__date=today
        ).aggregate(total=Sum("amount"))["total"] or Decimal("0.00")

    @property
    def last_operation(self):
        return KassaTransaction.objects.filter(kassa=self).order_by("-created_at").first()

    def income_by_method(self, method_name):
        from django.db.models import Sum
        return KassaTransaction.objects.filter(
            kassa=self, transaction_type__in=["income", "payment", "transfer_in"],
            payment_method__iexact=method_name
        ).aggregate(total=Sum("amount"))["total"] or Decimal("0.00")

    def expense_by_method(self, method_name):
        from django.db.models import Sum
        return KassaTransaction.objects.filter(
            kassa=self, transaction_type__in=["expense", "transfer_out"],
            payment_method__iexact=method_name
        ).aggregate(total=Sum("amount"))["total"] or Decimal("0.00")

    def all_income_breakdown(self):
        from django.db.models import Sum
        rows = KassaTransaction.objects.filter(
            kassa=self, transaction_type__in=["income", "payment", "transfer_in"]
        ).values("payment_method").annotate(total=Sum("amount")).order_by("-total")
        return {r["payment_method"] or "Noma'lum": r["total"] for r in rows}

    def all_expense_breakdown(self):
        from django.db.models import Sum
        rows = KassaTransaction.objects.filter(
            kassa=self, transaction_type__in=["expense", "transfer_out"]
        ).values("payment_method").annotate(total=Sum("amount")).order_by("-total")
        return {r["payment_method"] or "Noma'lum": r["total"] for r in rows}

    @property
    def total_income(self):
        from django.db.models import Sum
        return KassaTransaction.objects.filter(
            kassa=self, transaction_type__in=["income", "payment", "transfer_in"]
        ).aggregate(total=Sum("amount"))["total"] or Decimal("0.00")

    @property
    def total_expense(self):
        from django.db.models import Sum
        return KassaTransaction.objects.filter(
            kassa=self, transaction_type__in=["expense", "transfer_out"]
        ).aggregate(total=Sum("amount"))["total"] or Decimal("0.00")


class KassaTransaction(models.Model):
    class TransactionType(models.TextChoices):
        PAYMENT = "payment", "To'lov"
        INCOME = "income", "Kirim"
        EXPENSE = "expense", "Chiqim"
        TRANSFER_IN = "transfer_in", "Kassa o'tkazma (kirish)"
        TRANSFER_OUT = "transfer_out", "Kassa o'tkazma (chiqish)"
        REFUND = "refund", "Qaytarilgan pul"

    kassa = models.ForeignKey(
        Kassa, on_delete=models.SET_NULL, null=True, blank=True, related_name="transactions", verbose_name="Kassa"
    )
    transaction_type = models.CharField(
        max_length=20, choices=TransactionType.choices, verbose_name="Operatsiya turi"
    )
    amount = models.DecimalField(max_digits=12, decimal_places=2, verbose_name="Summa")
    balance_before = models.DecimalField(
        max_digits=12, decimal_places=2, default=Decimal("0.00"), verbose_name="Oldingi balans"
    )
    balance_after = models.DecimalField(
        max_digits=12, decimal_places=2, default=Decimal("0.00"), verbose_name="Yangi balans"
    )
    class ExpenseCategory(models.TextChoices):
        RENT = "arenda", "Arenda"
        SALARY = "maosh", "Maosh"
        UTILITY = "kommunal", "Kommunal"
        SUPPLIES = "kantselyariya", "Kantselyariya"
        OTHER = "boshqa", "Boshqa"

    expense_category = models.CharField(
        max_length=50, choices=ExpenseCategory.choices, blank=True, default="",
        verbose_name="Chiqim kategoriyasi"
    )
    income_category = models.CharField(
        max_length=100, blank=True, default="",
        verbose_name="Kirim kategoriyasi"
    )
    description = models.TextField(blank=True, default="", verbose_name="Sabab / Izoh")
    student = models.ForeignKey(
        "Student", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="kassa_transactions", verbose_name="O'quvchi"
    )
    payment_method = models.CharField(
        max_length=50, blank=True, default="", verbose_name="To'lov usuli"
    )
    created_by = models.CharField(
        max_length=255, blank=True, default="", verbose_name="Kim tomonidan"
    )
    created_by_user = models.ForeignKey(
        "auth.User", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="kassa_operations", verbose_name="Foydalanuvchi"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Kassa tranzaksiyasi"
        verbose_name_plural = "Kassa tranzaksiyalari"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.get_transaction_type_display()} - {self.amount} so'm ({self.kassa.name})"


class KassaTransfer(models.Model):
    from_kassa = models.ForeignKey(
        Kassa, on_delete=models.SET_NULL, null=True, blank=True, related_name="transfers_out", verbose_name="Yuboruvchi kassa"
    )
    to_kassa = models.ForeignKey(
        Kassa, on_delete=models.SET_NULL, null=True, blank=True, related_name="transfers_in", verbose_name="Qabul qiluvchi kassa"
    )
    amount = models.DecimalField(max_digits=12, decimal_places=2, verbose_name="Summa")
    description = models.TextField(blank=True, default="", verbose_name="Izoh")
    created_by = models.CharField(
        max_length=255, blank=True, default="", verbose_name="Kim tomonidan"
    )
    created_by_user = models.ForeignKey(
        "auth.User", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="kassa_transfers", verbose_name="Foydalanuvchi"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Kassa o'tkazmasi"
        verbose_name_plural = "Kassa o'tkazmalari"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.from_kassa} → {self.to_kassa}: {self.amount} so'm"


class ExpenseCategory(models.Model):
    name = models.CharField(max_length=100, unique=True, verbose_name="Kategoriya nomi")
    is_active = models.BooleanField(default=True, verbose_name="Faol")
    order = models.PositiveIntegerField(default=0, verbose_name="Tartib")
    created_at = models.DateTimeField(auto_now_add=True)

    objects = ActiveManager()
    all_objects = models.Manager()

    def delete(self, *args, **kwargs):
        self.is_active = False
        self.save(update_fields=["is_active"])

    class Meta:
        verbose_name = "Chiqim kategoriyasi"
        verbose_name_plural = "Chiqim kategoriyalari"
        ordering = ["order", "name"]

    def __str__(self):
        return self.name


class SmsHistory(models.Model):
    TYPE_CHOICES = [
        ("debt", "Qarz eslatma"),
        ("absence", "Davomat"),
        ("payment", "To'lov"),
    ]
    sms_type = models.CharField(max_length=20, choices=TYPE_CHOICES, verbose_name="SMS turi")
    recipient_name = models.CharField(max_length=255, verbose_name="Qabul qiluvchi")
    recipient_phone = models.CharField(max_length=20, verbose_name="Telefon")
    student_name = models.CharField(max_length=255, verbose_name="O'quvchi")
    message = models.TextField(verbose_name="Xabar matni")
    status = models.CharField(max_length=20, default="yuborildi", verbose_name="Holat")
    sent_by = models.ForeignKey("auth.User", on_delete=models.SET_NULL, null=True, blank=True, verbose_name="Yuborgan")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Yuborilgan vaqt")

    class Meta:
        verbose_name = "SMS tarixi"
        verbose_name_plural = "SMS tarixlari"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.student_name} → {self.recipient_phone} ({self.get_sms_type_display()})"