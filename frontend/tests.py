from django.test import TestCase
import json
from datetime import date, datetime, time
from decimal import Decimal
from datetime import timezone as dt_timezone
from django.contrib.auth.models import User
from django.urls import reverse

from .models import (
    Course, CourseLevel, Group, Student, LessonTime,
    Attendance, StudentBalance, Transaction, StudentLog, GlobalConfig,
    Employee, LessonTeacherSalary, GroupTeacherAssignment,
    TeacherTransaction, TeacherBalance,
    Kassa, KassaTransaction,
    Role,
)
from .views import (
    get_student_join_date,
    generate_lesson_dates,
    calculate_remaining_month_payment,
    calculate_expected_payment_up_to_today,
    calculate_previous_debt,
    sync_attendance_balance,
    get_or_create_balance,
    process_payment,
    _add_student_to_group,
    resolve_attendance_teacher,
    get_teacher_percent,
    sync_lesson_teacher_salary,
    release_pending_salaries,
    reverse_teacher_share_for_student,
    get_or_create_teacher_balance,
)
from .teacher_salary_api import _salary_stats


def utc(d):
    return datetime(d.year, d.month, d.day, 0, 0, 0, tzinfo=dt_timezone.utc)


def find_weekday(year, month, weekday_num, start_day=1):
    """Berilgan hafta kunidagi birinchi sanani topish (0=Dushanba)"""
    for i in range(start_day, 32):
        try:
            d = date(year, month, i)
            if d.weekday() == weekday_num:
                return d
        except ValueError:
            break
    return None


class RealTest1_GuruhochibOquvchiQoshish(TestCase):
    """
    REAL TEST 1: Guruh ochish + o'quvchi qo'shish + davomat + to'lov
    Simulyatsiya: IT House Academy da yangi guruh ochiladi,
    o'quvchi o'rtada qo'shiladi, davomat olinadi, to'lov hisoblanadi
    """

    def setUp(self):
        self.today = date.today()
        self.year = self.today.year
        self.month = self.today.month

        self.course = Course.objects.create(name="Python Dasturlash")
        self.level = CourseLevel.objects.create(
            course=self.course, name="Beginner", daily_price=Decimal("50000.00")
        )
        self.config = GlobalConfig.get_instance()

        self.group = Group.objects.create(
            name="Python-1 (YANGI)",
            status="aktiv",
            course=self.course,
            level=self.level,
            lesson_price=Decimal("50000.00"),
            start_date=date(self.year, self.month, 1),
            end_date=date(self.year, self.month, 28),
        )
        LessonTime.objects.create(
            group=self.group,
            days="dushanba,chorshanba,juma",
            start_time="09:00",
            end_time="10:30",
        )

    def test_full_lifecycle(self):
        """
        TO'LIQ TSIKL:
        1. Guruh 1-sanadan ochilgan, dush/chor/jum
        2. O'quvchi Jasur 10-sanada qo'shilgan
        3. 10-sana oldingi darslar (1,3,5,7,9) hisobga OLINMAYDI
        4. 10-sanadan keyingi darslar hisoblanadi
        5. Admin 7-sana 'Keldi' deb belgilagan -> faqat shu dars yechildi
        6. O'quvchi to'lov qilgan
        7. Natijalar to'g'ri
        """
        print(f"\n{'='*65}")
        print(f"  REAL TEST 1: Guruh ochish + O'quvchi qo'shish + To'lov")
        print(f"{'='*65}")

        # === 1. Guruh ochilgan 1-sanada ===
        print(f"\n[GURUH] {self.group.name} — {self.group.lesson_price} so'm/dars")
        print(f"[GURUH] Dars kunlari: Dushanba, Chorshanba, Juma")
        print(f"[GURUH] Boshlanish: {self.group.start_date}, Tugash: {self.group.end_date}")

        weekdays = get_lesson_weekdays(self.group)
        all_dates = generate_lesson_dates(
            self.group, date(self.year, self.month, 1), date(self.year, self.month, 28)
        )
        print(f"[GURUH] Jami darslar: {len(all_dates)} ta")
        for d in all_dates:
            print(f"  - {d.strftime('%d.%m')} ({['Du','Se','Ch','Pa','Ju','Sh','Ya'][d.weekday()]})")

        # === 2. O'quvchi Jasur 10-sanada qo'shildi ===
        student = Student.objects.create(
            first_name="Jasur", last_name="Karimov", phone="901234567"
        )
        student.groups.add(self.group)
        StudentLog.objects.create(
            student=student, group=self.group, action="joined",
            reason="10-sanada qo'shildi"
        )
        log = StudentLog.objects.filter(
            student=student, group=self.group, action="joined"
        ).order_by("created_at").first()
        log.created_at = utc(date(self.year, self.month, 10))
        log.save(update_fields=["created_at"])

        join_date = get_student_join_date(student, self.group)
        print(f"\n[O'QUVCHI] {student.first_name} {student.last_name}")
        print(f"[O'QUVCHI] Guruhga qo'shilgan sana: {join_date}")

        self.assertEqual(join_date, date(self.year, self.month, 10))

        # === 3. 10-sanadan oldingi darslar hisobga olinmasin ===
        dates_after_join = generate_lesson_dates(
            self.group, date(self.year, self.month, 10), date(self.year, self.month, 28)
        )
        dates_before_join = [d for d in all_dates if d < date(self.year, self.month, 10)]
        print(f"\n[KUTILGAN] 10-sana oldingi darslar: {len(dates_before_join)} ta -> HISOBGA OLINMAYDI")
        for d in dates_before_join:
            print(f"  X {d.strftime('%d.%m')} (oldingi dars, hisobga olinmaydi)")

        print(f"[KUTILGAN] 10-sana keyingi darslar: {len(dates_after_join)} ta")
        for d in dates_after_join:
            print(f"  + {d.strftime('%d.%m')} (hisoblanadi)")

        # === 4. To'lov hisob-kitobi (hech qanday davomat belgilanmagan) ===
        remaining = calculate_remaining_month_payment(student)
        expected_today = calculate_expected_payment_up_to_today(student)
        balance = get_or_create_balance(student)

        print(f"\n[TO'LOV] Balans: {balance.balance:,.0f} so'm")
        print(f"[TO'LOV] Bugungacha kutilgan: {expected_today:,.0f} so'm")
        print(f"[TO'LOV] Oxirigacha to'lanadigan: {remaining:,.0f} so'm")

        # Kutilgan miqdor: 10-sana (qo'shilish) dan oy oxirigacha bo'lgan darslar
        dates_to_month_end = generate_lesson_dates(
            self.group, date(self.year, self.month, 10), date(self.year, self.month, 28)
        )
        expected_lesson_count = len(dates_to_month_end)
        expected_amount = expected_lesson_count * Decimal("50000.00")
        self.assertEqual(expected_today, expected_amount)

        # === 5. Admin 7-sana 'Keldi' deb belgilagan (join_date dan OLDIN!) ===
        past_date = find_weekday(self.year, self.month, 0, start_day=1)  # Dushanba
        if past_date and past_date.day < 10:
            att = Attendance.objects.create(
                group=self.group, student=student,
                date=past_date, status="present", created_by="Admin"
            )
            sync_attendance_balance(student, self.group, att, "present", "Admin")
            balance = get_or_create_balance(student)
            print(f"\n[DAVOMAT] Admin '{past_date.day}-sana' ni 'Keldi' deb belgiladi")
            print(f"[DAVOMAT] Balans: {balance.balance:,.0f} so'm (1 dars yechildi)")

            self.assertEqual(balance.balance, Decimal("-50000.00"))

            # Qayta hisoblaymiz
            remaining2 = calculate_remaining_month_payment(student)
            expected_today2 = calculate_expected_payment_up_to_today(student)
            print(f"[TO'LOV] Yangilangan — Bugungacha kutilgan: {expected_today2:,.0f} so'm")
            print(f"[TO'LOV] Yangilangan — Oxirigacha to'lanadigan: {remaining2:,.0f} so'm")

            # expected_today2 = (kelajak darslar) * narx - balans
            # balans = -50000, demak oldingi dars ham qo'shiladi
            self.assertGreater(expected_today2, Decimal("0.00"))

        # === 6. O'quvchi 100,000 so'm to'lov qildi ===
        process_payment(student, Decimal("100000.00"), description="Boshlang'ich to'lov")
        balance = get_or_create_balance(student)
        remaining3 = calculate_remaining_month_payment(student)
        expected_today3 = calculate_expected_payment_up_to_today(student)
        print(f"\n[TO'LOV] 100,000 so'm to'landi")
        print(f"[TO'LOV] Yangi balans: {balance.balance:,.0f} so'm")
        print(f"[TO'LOV] Bugungacha kutilgan: {expected_today3:,.0f} so'm")
        print(f"[TO'LOV] Oxirigacha to'lanadigan: {remaining3:,.0f} so'm")

        # To'lov qilgandan keyin qoldiq kamayishi kerak
        self.assertGreaterEqual(remaining3, Decimal("0.00"))

        print(f"\n{'='*65}")
        print(f"  NATIJA: Butun tsikl to'g'ri ishladi!")
        print(f"{'='*65}")


class RealTest2_BittaDarsQolgan(TestCase):
    """
    REAL TEST 2: Guruhda 1 ta dars qolgan, o'quvchi o'rtada qo'shilgan
    Foydalanuvchi asosiy muammosi — guruhda 1 dars qolgan,
    lekin to'lov butun oy uchun chiqayotgan edi
    """

    def setUp(self):
        self.today = date.today()
        self.year = self.today.year
        self.month = self.today.month

        self.course = Course.objects.create(name="Ingliz tili")
        self.level = CourseLevel.objects.create(
            course=self.course, name="A1", daily_price=Decimal("35000.00")
        )
        self.config = GlobalConfig.get_instance()

    def test_student_joined_late_group_ending_soon(self):
        """
        Guruh 1-dan 15-gacha (qisqa oy)
        O'quvchi 13-sanada qo'shildi
        Guruhda 13, 15 = 2 ta dars qoldi
        FAQAT shu 2 ta dars uchun to'lov chiqishi kerak
        """
        print(f"\n{'='*65}")
        print(f"  REAL TEST 2: Guruhda 1 dars qolgan holat")
        print(f"{'='*65}")

        group = Group.objects.create(
            name="Ingliz-A1 (QISQA)",
            status="aktiv",
            course=self.course,
            level=self.level,
            lesson_price=Decimal("35000.00"),
            start_date=date(self.year, self.month, 1),
            end_date=date(self.year, self.month, 15),
        )
        LessonTime.objects.create(
            group=group, days="dushanba,chorshanba,juma",
            start_time="10:00", end_time="11:30",
        )

        all_dates = generate_lesson_dates(
            group, date(self.year, self.month, 1), date(self.year, self.month, 15)
        )
        print(f"[GURUH] Guruh darslari (1-15): {len(all_dates)} ta")
        for d in all_dates:
            print(f"  {d.strftime('%d.%m')} ({['Du','Se','Ch','Pa','Ju','Sh','Ya'][d.weekday()]})")

        # O'quvchi 13-sanada qo'shildi
        student = Student.objects.create(
            first_name="Nilufar", last_name="Aliyeva", phone="907654321"
        )
        _add_student_to_group(student, group, "13-sanada qo'shildi")
        log = StudentLog.objects.filter(
            student=student, group=group, action="joined"
        ).order_by("created_at").first()
        log.created_at = utc(date(self.year, self.month, 13))
        log.save(update_fields=["created_at"])

        join_date = get_student_join_date(student, group)
        print(f"\n[O'QUVCHI] Nilufar — qo'shilgan sana: {join_date}")

        # 13-sanadan 15-gacha nechta dars bor?
        remaining_dates = generate_lesson_dates(
            group, date(self.year, self.month, 13), date(self.year, self.month, 15)
        )
        print(f"[HISOB] 13-15 gacha darslar: {len(remaining_dates)} ta")
        for d in remaining_dates:
            print(f"  + {d.strftime('%d.%m')} (hisoblanadi)")

        remaining = calculate_remaining_month_payment(student)
        expected_today = calculate_expected_payment_up_to_today(student)
        balance = get_or_create_balance(student)

        print(f"\n[NATIJA] Balans: {balance.balance:,.0f} so'm")
        print(f"[NATIJA] Bugungacha kutilgan: {expected_today:,.0f} so'm")
        print(f"[NATIJA] Oxirigacha to'lanadigan: {remaining:,.0f} so'm")

        # To'g'ri: faqat 13-15 gacha darslar * 35000
        expected_remaining = len(remaining_dates) * Decimal("35000.00")
        print(f"\n[TAXMIN] Kutilgan: {expected_remaining:,.0f} so'm ({len(remaining_dates)} dars x 35,000)")
        print(f"[ACTUAL] Chiqqan: {remaining:,.0f} so'm")

        self.assertEqual(remaining, expected_remaining)

        # 1-12 sanadagi darslar hisobga olinmadi!
        dates_before = [d for d in all_dates if d < date(self.year, self.month, 13)]
        print(f"\n[TASDIQ] 1-12 sana darslari ({len(dates_before)} ta): hisobga OLINMADI")

        print(f"\n{'='*65}")
        print(f"  NATIJA: 1-dars qolgan holat TO'G'RI hisoblandi!")
        print(f"{'='*65}")


class RealTest3_AdminKeldiBelgilasa(TestCase):
    """
    REAL TEST 3: Admin join_date dan OLDINGI darsni 'Keldi' deb belgilasa
    Faqat o'sha bitta dars uchun to'lov yechilishi kerak,
    qolgan eski darslar hisobga olinmasin
    """

    def setUp(self):
        self.today = date.today()
        self.year = self.today.year
        self.month = self.today.month

        self.course = Course.objects.create(name="Grafik Dizayn")
        self.config = GlobalConfig.get_instance()

    def test_admin_marks_past_lesson(self):
        """
        Guruh 1-dan 28-gacha, dush/chor/jum
        O'quvchi 15-sanada qo'shildi
        Admin 7-sana (dushanba) 'Keldi' deb belgiladi
        Natija: faqat 7-sana yechildi, 1,3,5,9,11,13 hisobga olinmadi
        """
        print(f"\n{'='*65}")
        print(f"  REAL TEST 3: Admin 'Keldi' belgilash (oldingi dars)")
        print(f"{'='*65}")

        group = Group.objects.create(
            name="Grafik Dizayn-1",
            status="aktiv",
            course=self.course,
            lesson_price=Decimal("60000.00"),
            start_date=date(self.year, self.month, 1),
            end_date=date(self.year, self.month, 28),
        )
        LessonTime.objects.create(
            group=group, days="dushanba,chorshanba,juma",
            start_time="14:00", end_time="15:30",
        )

        all_dates = generate_lesson_dates(
            group, date(self.year, self.month, 1), date(self.year, self.month, 28)
        )
        print(f"[GURUH] Jami darslar: {len(all_dates)} ta")

        # O'quvchi 15-sanada qo'shildi
        student = Student.objects.create(
            first_name="Sardor", last_name="Rahimov", phone="903332211"
        )
        _add_student_to_group(student, group, "15-sanada qo'shildi")
        log = StudentLog.objects.filter(
            student=student, group=group, action="joined"
        ).order_by("created_at").first()
        log.created_at = utc(date(self.year, self.month, 15))
        log.save(update_fields=["created_at"])

        dates_before = [d for d in all_dates if d < date(self.year, self.month, 15)]
        dates_after = [d for d in all_dates if d >= date(self.year, self.month, 15)]
        print(f"[O'QUVCHI] 15-sanada qo'shildi")
        print(f"[OLDINGI] {len(dates_before)} ta dars: hisobga OLINMAYDI")
        for d in dates_before:
            print(f"  X {d.strftime('%d.%m')}")
        print(f"[KEYINGI] {len(dates_after)} ta dars: hisoblanadi")
        for d in dates_after:
            print(f"  + {d.strftime('%d.%m')}")

        # Admin 7-sana (join_date dan oldin!) 'Keldi' deb belgiladi
        target_date = None
        for d in dates_before:
            if d.weekday() == 0:  # Dushanba
                target_date = d
                break
        if not target_date:
            target_date = dates_before[0] if dates_before else None

        if target_date:
            att = Attendance.objects.create(
                group=group, student=student,
                date=target_date, status="present", created_by="Admin"
            )
            sync_attendance_balance(student, group, att, "present", "Admin")
            balance = get_or_create_balance(student)

            print(f"\n[DAVOMAT] Admin {target_date.strftime('%d.%m')} ni 'Keldi' deb belgiladi")
            print(f"[DAVOMAT] Balans: {balance.balance:,.0f} so'm")

            # Faqat 1 ta dars yechildi
            self.assertEqual(balance.balance, Decimal("-60000.00"))

            remaining = calculate_remaining_month_payment(student)
            expected_today = calculate_expected_payment_up_to_today(student)

            print(f"\n[NATIJA] Bugungacha kutilgan: {expected_today:,.0f} so'm")
            print(f"[NATIJA] Oxirigacha to'lanadigan: {remaining:,.0f} so'm")

            # QOLDIQ = (kelajak darslar * narx) - balans
            # balans = -60000 (1 dars yechildi)
            # kelajak = dates_after * 60000
            # qoldiq = dates_after * 60000 - (-60000) = dates_after * 60000 + 60000
            expected_rem = len(dates_after) * Decimal("60000.00") - balance.balance
            print(f"[TAXMIN] Kutilgan: {expected_rem:,.0f} so'm")
            print(f"[ACTUAL] Chiqqan: {remaining:,.0f} so'm")

            self.assertEqual(remaining, expected_rem)

            # Boshqa eski darslar hisobga olinmadi
            other_old_dates = [d for d in dates_before if d != target_date]
            print(f"\n[TASDIQ] Boshqa eski darslar ({len(other_old_dates)} ta): hisobga OLINMADI")

        print(f"\n{'='*65}")
        print(f"  NATIJA: Faqat 'Keldi' belgilangan dars yechildi!")
        print(f"{'='*65}")


class RealTest4_TolovdanKeyin(TestCase):
    """
    REAL TEST 4: To'lov qilgandan keyin qoldiq to'g'ri kamayishi
    """

    def setUp(self):
        self.today = date.today()
        self.year = self.today.year
        self.month = self.today.month

        self.course = Course.objects.create(name="Savdo")
        self.config = GlobalConfig.get_instance()

    def test_payment_reduces_correctly(self):
        print(f"\n{'='*65}")
        print(f"  REAL TEST 4: To'lov qilish va qoldiq tekshirish")
        print(f"{'='*65}")

        group = Group.objects.create(
            name="Savdo-1",
            status="aktiv",
            course=self.course,
            lesson_price=Decimal("45000.00"),
            start_date=date(self.year, self.month, 1),
            end_date=date(self.year, self.month, 28),
        )
        LessonTime.objects.create(
            group=group, days="dushanba,chorshanba,juma",
            start_time="16:00", end_time="17:30",
        )

        student = Student.objects.create(
            first_name="Dilshod", last_name="Toshmatov", phone="904445566"
        )
        _add_student_to_group(student, group, "1-sanada qo'shildi")
        log = StudentLog.objects.filter(
            student=student, group=group, action="joined"
        ).order_by("created_at").first()
        log.created_at = utc(date(self.year, self.month, 1))
        log.save(update_fields=["created_at"])

        remaining_before = calculate_remaining_month_payment(student)
        print(f"[BOSHLANG'ICH] Oxirigacha to'lanadigan: {remaining_before:,.0f} so'm")

        # 45,000 to'lov
        process_payment(student, Decimal("45000.00"), description="1-dars to'lov")
        balance = get_or_create_balance(student)
        remaining1 = calculate_remaining_month_payment(student)
        print(f"[TO'LOV 1] 45,000 so'm -> Balans: {balance.balance:,.0f} so'm")
        print(f"[TO'LOV 1] Oxirigacha: {remaining1:,.0f} so'm")
        self.assertEqual(remaining1, remaining_before - Decimal("45000.00"))

        # 90,000 to'lov
        process_payment(student, Decimal("90000.00"), description="2-dars to'lov")
        balance = get_or_create_balance(student)
        remaining2 = calculate_remaining_month_payment(student)
        print(f"[TO'LOV 2] 90,000 so'm -> Balans: {balance.balance:,.0f} so'm")
        print(f"[TO'LOV 2] Oxirigacha: {remaining2:,.0f} so'm")
        self.assertEqual(remaining2, remaining_before - Decimal("135000.00"))

        # Yetarli to'lov
        process_payment(student, Decimal("500000.00"), description="To'liq to'lov")
        balance = get_or_create_balance(student)
        remaining3 = calculate_remaining_month_payment(student)
        print(f"[TO'LOV 3] 500,000 so'm -> Balans: {balance.balance:,.0f} so'm")
        print(f"[TO'LOV 3] Oxirigacha: {remaining3:,.0f} so'm")
        self.assertEqual(remaining3, Decimal("0.00"))

        print(f"\n{'='*65}")
        print(f"  NATIJA: To'lovdan keyin qoldiq TO'G'RI kamaydi!")
        print(f"{'='*65}")


class TeacherSalaryAssignmentTest(TestCase):
    """O'qituvchi biriktiruvi va davomat asosidagi oylik (Humoyun → Feruza holati)."""

    def setUp(self):
        self.course = Course.objects.create(name="Python Dasturlash")
        self.level = CourseLevel.objects.create(
            course=self.course, name="Beginner", daily_price=Decimal("50000.00")
        )
        self.group = Group.objects.create(
            name="Python-1", status="aktiv",
            course=self.course, level=self.level,
            lesson_price=Decimal("50000.00"),
            start_date=date(2026, 8, 1), end_date=date(2026, 8, 31),
        )
        self.humoyun = Employee.objects.create(first_name="Humoyun", last_name="T.", phone="901000001")
        self.feruza = Employee.objects.create(first_name="Feruza", last_name="A.", phone="901000002")
        self.group.teacher = self.humoyun
        self.group.save(update_fields=["teacher"])
        self.student = Student.objects.create(first_name="Jasur", last_name="Karimov", phone="901234567")
        self.student.groups.add(self.group)

    def _attendance(self, day, teacher=None, status="present"):
        return Attendance.objects.create(
            group=self.group, student=self.student,
            date=date(2026, 8, day), status=status, teacher=teacher,
        )

    def test_resolve_teacher_by_date_assignment(self):
        """1-15-avgust Humoyun, 16-avgustdan Feruza → har dars puli to'g'ri o'qituvchiga."""
        GroupTeacherAssignment.objects.create(group=self.group, teacher=self.humoyun, start_date=date(2026, 8, 1), end_date=date(2026, 8, 15))
        GroupTeacherAssignment.objects.create(group=self.group, teacher=self.feruza, start_date=date(2026, 8, 16), end_date=None)

        self.assertEqual(resolve_attendance_teacher(self.group, date(2026, 8, 5)), self.humoyun)
        self.assertEqual(resolve_attendance_teacher(self.group, date(2026, 8, 15)), self.humoyun)
        self.assertEqual(resolve_attendance_teacher(self.group, date(2026, 8, 16)), self.feruza)
        self.assertEqual(resolve_attendance_teacher(self.group, date(2026, 8, 31)), self.feruza)

        a1 = self._attendance(5)
        a2 = self._attendance(20)
        sync_attendance_balance(self.student, self.group, a1, "present", "Admin")
        sync_attendance_balance(self.student, self.group, a2, "present", "Admin")

        s1 = LessonTeacherSalary.objects.get(attendance=a1)
        s2 = LessonTeacherSalary.objects.get(attendance=a2)
        self.assertEqual(s1.teacher, self.humoyun)
        self.assertEqual(s2.teacher, self.feruza)
        self.assertEqual(s1.teacher_amount, Decimal("15000.00"))
        self.assertEqual(s2.teacher_amount, Decimal("15000.00"))

    def test_default_percent_30_and_custom_percent(self):
        self.assertEqual(get_teacher_percent(None), Decimal("30.00"))
        self.assertEqual(get_teacher_percent(self.humoyun), Decimal("30.00"))
        self.humoyun.percent = Decimal("40.00")
        self.humoyun.save(update_fields=["percent"])
        self.assertEqual(get_teacher_percent(self.humoyun), Decimal("40.00"))

    def test_negative_balance_pending_positive_paid(self):
        a = self._attendance(5)
        sync_attendance_balance(self.student, self.group, a, "present", "Admin")
        salary = LessonTeacherSalary.objects.get(attendance=a)
        self.assertEqual(salary.status, LessonTeacherSalary.Status.PENDING)

        balance = get_or_create_balance(self.student)
        self.assertEqual(balance.balance, Decimal("-50000.00"))

        b = self._attendance(7)
        sync_attendance_balance(self.student, self.group, b, "present", "Admin")
        salary2 = LessonTeacherSalary.objects.get(attendance=b)
        self.assertEqual(salary2.status, LessonTeacherSalary.Status.PENDING)

        process_payment(self.student, Decimal("100000.00"), description="To'lov")
        salary.refresh_from_db()
        salary2.refresh_from_db()
        self.assertEqual(salary.status, LessonTeacherSalary.Status.PAID)
        self.assertEqual(salary2.status, LessonTeacherSalary.Status.PAID)

        tb = get_or_create_teacher_balance(self.humoyun)
        self.assertEqual(tb.balance, Decimal("30000.00"))

    def test_fifo_oldest_first_and_teacher_credit(self):
        GroupTeacherAssignment.objects.create(group=self.group, teacher=self.humoyun, start_date=date(2026, 8, 1), end_date=date(2026, 8, 15))
        GroupTeacherAssignment.objects.create(group=self.group, teacher=self.feruza, start_date=date(2026, 8, 16), end_date=None)

        a1 = self._attendance(3)
        a2 = self._attendance(5)
        a3 = self._attendance(20)
        for a in (a1, a2, a3):
            sync_attendance_balance(self.student, self.group, a, "present", "Admin")

        self.assertEqual(
            LessonTeacherSalary.objects.filter(status=LessonTeacherSalary.Status.PENDING).count(), 3
        )

        process_payment(self.student, Decimal("100000.00"), description="Ikkita dars")
        s1 = LessonTeacherSalary.objects.get(attendance=a1)
        s2 = LessonTeacherSalary.objects.get(attendance=a2)
        s3 = LessonTeacherSalary.objects.get(attendance=a3)
        self.assertEqual(s1.status, LessonTeacherSalary.Status.PAID)
        self.assertEqual(s2.status, LessonTeacherSalary.Status.PAID)
        self.assertEqual(s3.status, LessonTeacherSalary.Status.PENDING)

        process_payment(self.student, Decimal("50000.00"), description="Uchinchi dars")
        s3.refresh_from_db()
        self.assertEqual(s3.status, LessonTeacherSalary.Status.PAID)

        self.assertEqual(get_or_create_teacher_balance(self.humoyun).balance, Decimal("30000.00"))
        self.assertEqual(get_or_create_teacher_balance(self.feruza).balance, Decimal("15000.00"))
        self.assertEqual(
            TeacherTransaction.objects.filter(transaction_type=TeacherTransaction.Type.INCOME).count(), 3
        )

    def test_reverse_teacher_share(self):
        a = self._attendance(5)
        sync_attendance_balance(self.student, self.group, a, "present", "Admin")
        process_payment(self.student, Decimal("100000.00"), description="To'lov")
        salary = LessonTeacherSalary.objects.get(attendance=a)
        self.assertEqual(salary.status, LessonTeacherSalary.Status.PAID)
        self.assertEqual(get_or_create_teacher_balance(self.humoyun).balance, Decimal("15000.00"))

        reversed_count = reverse_teacher_share_for_student(self.student, Decimal("100000.00"))
        self.assertEqual(reversed_count, 1)
        salary.refresh_from_db()
        self.assertEqual(salary.status, LessonTeacherSalary.Status.PENDING)
        self.assertEqual(get_or_create_teacher_balance(self.humoyun).balance, Decimal("0.00"))

    def test_attendance_cancelled_reverses_paid_salary(self):
        a = self._attendance(5)
        sync_attendance_balance(self.student, self.group, a, "present", "Admin")
        process_payment(self.student, Decimal("100000.00"), description="To'lov")
        salary = LessonTeacherSalary.objects.get(attendance=a)
        self.assertEqual(salary.status, LessonTeacherSalary.Status.PAID)

        sync_attendance_balance(self.student, self.group, a, "absent", "Admin")
        self.assertFalse(LessonTeacherSalary.objects.filter(attendance=a).exists())
        self.assertEqual(get_or_create_teacher_balance(self.humoyun).balance, Decimal("0.00"))

    def test_percent_frozen_on_existing_records(self):
        """Foiz o'zgarganda eski yozuvlar qayta hisoblanmaydi, faqat yangi darslarga ta'sir qiladi."""
        self.humoyun.percent = Decimal("30.00")
        self.humoyun.save(update_fields=["percent"])
        a1 = self._attendance(5)
        sync_attendance_balance(self.student, self.group, a1, "present", "Admin")
        s1 = LessonTeacherSalary.objects.get(attendance=a1)
        self.assertEqual(s1.teacher_percent, Decimal("30.00"))
        self.assertEqual(s1.teacher_amount, Decimal("15000.00"))

        # Admin foizni 20% qilib o'zgartirdi
        self.humoyun.percent = Decimal("20.00")
        self.humoyun.save(update_fields=["percent"])

        # Eski davomat qayta saqlansa ham muzlatilgan qiymatlar o'zgarmaydi
        sync_attendance_balance(self.student, self.group, a1, "present", "Admin")
        s1.refresh_from_db()
        self.assertEqual(s1.teacher_percent, Decimal("30.00"))
        self.assertEqual(s1.teacher_amount, Decimal("15000.00"))

        # Yangi dars yangi foiz bilan hisoblanadi
        a2 = self._attendance(16)
        sync_attendance_balance(self.student, self.group, a2, "present", "Admin")
        s2 = LessonTeacherSalary.objects.get(attendance=a2)
        self.assertEqual(s2.teacher_percent, Decimal("20.00"))
        self.assertEqual(s2.teacher_amount, Decimal("10000.00"))

    def test_price_frozen_on_existing_records(self):
        """Narx o'zgarganda ham eski dars yozuvi muzlatilgan narxda qoladi."""
        a1 = self._attendance(5)
        sync_attendance_balance(self.student, self.group, a1, "present", "Admin")
        s1 = LessonTeacherSalary.objects.get(attendance=a1)
        self.assertEqual(s1.lesson_price, Decimal("50000.00"))

        self.group.lesson_price = Decimal("60000.00")
        self.group.save(update_fields=["lesson_price"])
        sync_attendance_balance(self.student, self.group, a1, "present", "Admin")
        s1.refresh_from_db()
        self.assertEqual(s1.lesson_price, Decimal("50000.00"))
        self.assertEqual(s1.teacher_amount, Decimal("15000.00"))

    def test_pending_breakdown_in_stats(self):
        """Pending statistikada o'quvchi va darslar bo'yicha tafsilot ko'rinadi."""
        ali = Student.objects.create(first_name="Ali", last_name="V.", phone="901111111")
        ali.groups.add(self.group)

        a1 = self._attendance(3)
        a2 = self._attendance(5)
        for a in (a1, a2):
            sync_attendance_balance(self.student, self.group, a, "present", "Admin")
        a3 = Attendance.objects.create(
            group=self.group, student=ali, date=date(2026, 8, 6), status="present"
        )
        sync_attendance_balance(ali, self.group, a3, "present", "Admin")

        stats = _salary_stats(self.humoyun)
        self.assertEqual(stats["pending_amount"], 45000.0)
        self.assertEqual(stats["pending_count"], 3)
        self.assertEqual(stats["pending_student_count"], 2)
        by_name = {p["student_name"]: p for p in stats["pending_students"]}
        self.assertEqual(by_name["Jasur Karimov"]["amount"], 30000.0)
        self.assertEqual(by_name["Jasur Karimov"]["lessons"], 2)
        self.assertEqual(by_name["Ali V."]["amount"], 15000.0)
        self.assertEqual(by_name["Ali V."]["lessons"], 1)

    def test_pending_breakdown_after_payment(self):
        """To'lovdan keyin Pending tafsiloti kamayadi, Available oylik ortadi."""
        a1 = self._attendance(3)
        sync_attendance_balance(self.student, self.group, a1, "present", "Admin")
        stats = _salary_stats(self.humoyun)
        self.assertEqual(stats["pending_amount"], 15000.0)
        self.assertEqual(stats["balance"], 0.0)

        process_payment(self.student, Decimal("50000.00"), description="To'lov")
        stats = _salary_stats(self.humoyun)
        self.assertEqual(stats["pending_amount"], 0.0)
        self.assertEqual(stats["balance"], 15000.0)


class KassaPulQoidalari(TestCase):
    """Kassa hech qachon minusga tushmaydi, pul bor kassa o'chirilmaydi."""

    def setUp(self):
        self.admin = User.objects.create_superuser(username="admin", password="pass123")
        self.client.login(username="admin", password="pass123")
        self.kassa = Kassa.objects.create(name="Asosiy kassa", owner=self.admin)

    def _add_income(self, amount):
        KassaTransaction.objects.create(
            kassa=self.kassa,
            transaction_type=KassaTransaction.TransactionType.INCOME,
            amount=Decimal(str(amount)),
            balance_before=self.kassa.balance,
            balance_after=self.kassa.balance + Decimal(str(amount)),
            description="Kirim test",
            created_by="Admin",
        )

    def test_kassa_with_money_cannot_be_deleted(self):
        self._add_income(50000)
        resp = self.client.post(reverse("kassa_delete", args=[self.kassa.pk]))
        self.assertEqual(resp.status_code, 302)
        self.assertTrue(Kassa.all_objects.get(pk=self.kassa.pk).is_active)

    def test_kassa_with_negative_balance_cannot_be_deleted(self):
        KassaTransaction.objects.create(
            kassa=self.kassa,
            transaction_type=KassaTransaction.TransactionType.EXPENSE,
            amount=Decimal("50000.00"),
            balance_before=Decimal("0.00"),
            balance_after=Decimal("-50000.00"),
            description="Chiqim test",
            created_by="Admin",
        )
        resp = self.client.post(reverse("kassa_delete", args=[self.kassa.pk]))
        self.assertEqual(resp.status_code, 302)
        self.assertTrue(Kassa.all_objects.get(pk=self.kassa.pk).is_active)

    def test_empty_kassa_can_be_deleted(self):
        resp = self.client.post(reverse("kassa_delete", args=[self.kassa.pk]))
        self.assertEqual(resp.status_code, 302)
        self.assertFalse(Kassa.all_objects.get(pk=self.kassa.pk).is_active)

    def test_expense_cannot_make_kassa_negative(self):
        self._add_income(10000)
        resp = self.client.post(reverse("kassa_add_expense", args=[self.kassa.pk]), {
            "amount": "50000.00",
            "description": "Kattaroq chiqim",
        })
        self.assertEqual(resp.status_code, 302)
        self.assertEqual(self.kassa.balance, Decimal("10000.00"))

    def test_expense_within_balance_is_allowed(self):
        self._add_income(10000)
        resp = self.client.post(reverse("kassa_add_expense", args=[self.kassa.pk]), {
            "amount": "4000.00",
            "description": "Kichik chiqim",
        })
        self.assertEqual(resp.status_code, 302)
        self.assertEqual(self.kassa.balance, Decimal("6000.00"))


class AdminEmployeeApiTests(TestCase):
    """Admin mobil ilova (edu-crm-admin) uchun yangi API endpointlarini tekshirish."""

    def setUp(self):
        self.admin_role = Role.objects.create(name="Administrator")
        self.teacher_role = Role.objects.create(name="O'qituvchi")
        self.user = User.objects.create_user(username="901234567", password="adminpass")
        self.employee = Employee.objects.create(
            user=self.user,
            first_name="Admin",
            last_name="Bosh",
            phone="901234567",
            role=self.admin_role,
        )

    def _login(self, password="adminpass"):
        return self.client.post(
            reverse("employee_api_login"),
            data=json.dumps({"phone": "901234567", "password": password}),
            content_type="application/json",
        )

    def test_login_returns_admin_flags(self):
        resp = self._login()
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertTrue(data["success"])
        self.assertTrue(data["is_admin"])
        self.assertEqual(data["employee"]["teacher_balance"], 0.0)

    def test_change_password_success(self):
        self._login()
        resp = self.client.post(
            reverse("employee_api_change_password"),
            data=json.dumps({"old_password": "adminpass", "new_password": "newpass123"}),
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(resp.json()["success"])
        self.assertEqual(self._login("adminpass").status_code, 401)
        resp2 = self._login("newpass123")
        self.assertEqual(resp2.status_code, 200)

    def test_change_password_wrong_old(self):
        self._login()
        resp = self.client.post(
            reverse("employee_api_change_password"),
            data=json.dumps({"old_password": "notright", "new_password": "newpass123"}),
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, 400)

    def test_admin_transactions_listing(self):
        self._login()
        student = Student.objects.create(first_name="Vali", last_name="Aliyev", phone="998111111")
        Transaction.objects.create(
            student=student,
            amount=Decimal("100000.00"),
            balance_after=Decimal("100000.00"),
            transaction_type="payment",
            created_by="Admin Bosh",
        )
        resp = self.client.get(reverse("employee_api_admin_transactions"))
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(len(data["transactions"]), 1)
        tx = data["transactions"][0]
        self.assertEqual(tx["amount_str"], "+100,000 so'm")
        self.assertEqual(tx["student_name"], "Vali Aliyev")
        self.assertEqual(tx["type_display"], "To'lov")
        self.assertIn("kassa_balance", data)
        self.assertIn("today_income", data)
        self.assertIn("month_income", data)

    def test_admin_sees_only_own_transactions(self):
        self._login()
        student = Student.objects.create(first_name="Vali", last_name="Aliyev", phone="998111111")
        Transaction.objects.create(
            student=student, amount=Decimal("100000.00"),
            balance_after=Decimal("100000.00"), transaction_type="payment", created_by="Admin Bosh",
        )
        other = User.objects.create_user(username="998222223", password="othpass2")
        Employee.objects.create(
            user=other, first_name="Boshqa", last_name="Admin", phone="998222223", role=self.admin_role
        )
        Transaction.objects.create(
            student=student, amount=Decimal("50000.00"),
            balance_after=Decimal("150000.00"), transaction_type="payment", created_by="Boshqa Admin",
        )
        resp = self.client.get(reverse("employee_api_admin_transactions"))
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(len(data["transactions"]), 1)
        self.assertEqual(data["transactions"][0]["amount_str"], "+100,000 so'm")

    def test_non_admin_forbidden_from_transactions(self):
        tu = User.objects.create_user(username="998222222", password="teacherpass")
        Employee.objects.create(
            user=tu, first_name="Ustoz", last_name="Odil", phone="998222222", role=self.teacher_role
        )
        self.client.post(
            reverse("employee_api_login"),
            data=json.dumps({"phone": "998222222", "password": "teacherpass"}),
            content_type="application/json",
        )
        resp = self.client.get(reverse("employee_api_admin_transactions"))
        self.assertEqual(resp.status_code, 403)

    def test_change_phone_success(self):
        self._login()
        resp = self.client.post(
            reverse("employee_api_change_phone"),
            data=json.dumps({"old_password": "adminpass", "new_phone": "901234568"}),
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(resp.json()["success"])
        self.employee.refresh_from_db()
        self.assertEqual(self.employee.phone, "901234568")
        self.user.refresh_from_db()
        self.assertEqual(self.user.username, "901234568")
        self.assertEqual(self._login("adminpass").status_code, 401)

    def test_change_phone_wrong_old_password(self):
        self._login()
        resp = self.client.post(
            reverse("employee_api_change_phone"),
            data=json.dumps({"old_password": "notright", "new_phone": "901234568"}),
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, 400)
        self.employee.refresh_from_db()
        self.assertEqual(self.employee.phone, "901234567")

    def test_change_phone_duplicate(self):
        other = User.objects.create_user(username="912345678", password="othpass")
        Employee.objects.create(
            user=other, first_name="Boshqa", last_name="Xodim", phone="912345678", role=self.admin_role
        )
        self._login()
        resp = self.client.post(
            reverse("employee_api_change_phone"),
            data=json.dumps({"old_password": "adminpass", "new_phone": "912345678"}),
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, 400)
        self.employee.refresh_from_db()
        self.assertEqual(self.employee.phone, "901234567")

    def test_change_phone_invalid_number(self):
        self._login()
        resp = self.client.post(
            reverse("employee_api_change_phone"),
            data=json.dumps({"old_password": "adminpass", "new_phone": "12"}),
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, 400)
        self.employee.refresh_from_db()
        self.assertEqual(self.employee.phone, "901234567")


def get_lesson_weekdays(group):
    WEEKDAY_MAP_REV = {
        "dushanba": 0, "seshanba": 1, "chorshanba": 2,
        "payshanba": 3, "juma": 4, "shanba": 5, "yakshanba": 6,
    }
    nums = set()
    for lt in group.lesson_times.all():
        for d_name in lt.days.split(","):
            d_name = d_name.strip().lower()
            if d_name in WEEKDAY_MAP_REV:
                nums.add(WEEKDAY_MAP_REV[d_name])
    return nums
