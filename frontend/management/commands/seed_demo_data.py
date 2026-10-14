"""Demo ma'lumotlarini yaratadi: ko'plab guruh, o'quvchi, davomat va coin.

Ishlatish:
    python manage.py seed_demo_data                 # 8 ta yangi guruh, har biriga 12 o'quvchi
    python manage.py seed_demo_data --groups 12 --students-per-group 15
    python manage.py seed_demo_data --fill-existing # mavjud guruhlarni ham to'ldiradi
    python manage.py seed_demo_data --reset         # avval yaratilgan demo ma'lumotni tozalaydi

Har bir o'quvchiga coin tranzaksiyalari orqali turli balans (ball) beriladi,
shuning uchun leaderboard va hisobotlarda ballar har xil bo'lib ko'rinadi.
"""

import random
from datetime import date, time, timedelta
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from coins.models import (
    CoinBalance,
    CoinNotification,
    CoinReason,
    CoinTransaction,
    ShopCategory,
    ShopOrder,
    ShopProduct,
)
from coins.services import create_transaction
from frontend.models import (
    Attendance,
    Course,
    Employee,
    Group,
    GroupTeacherAssignment,
    GroupLog,
    LessonTime,
    Role,
    Room,
    Student,
    StudentLog,
)

DEMO_MARK = "demo"

MALE_NAMES = [
    "Abbos", "Alisher", "Aziz", "Bekzod", "Bobur", "Davron", "Diyor", "Farrux",
    "Hamza", "Ibrohim", "Ilhom", "Islom", "Javohir", "Kamol", "Laziz", "Murod",
    "Nodirbek", "Otabek", "Ozod", "Qodir", "Rasul", "Sardor", "Sirojiddin", "Temur",
    "Ulugbek", "Umid", "Xurshid", "Yusuf", "Zafar", "Bekzoda", "Jasur", "Ruslan",
]
FEMALE_NAMES = [
    "Amina", "Bibisora", "Dilnoza", "Dildora", "Feruza", "Gulbahor", "Gulnora",
    "Madina", "Malika", "Nilufar", "Nodira", "Omina", "Ozoda", "Sabina", "Sitora",
    "Suxona", "Umida", "Xadicha", "Yulduz", "Zarnigor", "Zebo", "Guli", "Kamola",
    "Munisa", "Nasiba", "Rayhona", "Sevara", "Shahnoza", "Tahmina", "Vasila",
]
LAST_NAMES = [
    "Aliyev", "Boboyev", "Ergashev", "Fazilov", "Hasanov", "Ibragimov", "Jurayev",
    "Kadirov", "Karimov", "Mahmudov", "Mansurov", "Mamatov", "Mirzayev", "Murodov",
    "Nazarov", "Normatov", "Olimov", "Omonov", "Qodirov", "Rahimov", "Rustamov",
    "Saidov", "Sattorov", "Sharipov", "Sultonov", "Tursunov", "Umarov", "Usmonov",
    "Xolmatov", "Yo'ldoshev", "Zokirov", "Iskandarov", "Bekmurodov", "Dostonov",
]
SCHOOLS = [
    "1-sonli umumiy o'rta ta'lim maktabi", "3-sonli umumiy o'rta ta'lim maktabi",
    "8-sonli umumiy o'rta ta'lim maktabi", "21-sonli umumiy o'rta ta'lim maktabi",
    "President maktabi", "Bilimlar maktabi", "Katta maktab",
]
REGIONS = ["Toshkent shahri", "Toshkent viloyati", "Samarqand", "Buxoro", "Farg'ona", "Andijon", "Namangan", "Qashqadaryo"]
UNIVERSITIES = [
    "Toshkent Davlat Texnika Universiteti", "Toshkent Milliy Universiteti",
    "SamDUIT", "Buxoro universiteti", "Farg'ona davlat universiteti",
    "O'zbekiston Milliy universiteti", "KOMU",
]
DAY_KEYS = [d[0] for d in LessonTime.DAY_CHOICES]
DAY_INDEX = {d: i for i, d in enumerate(DAY_KEYS)}
TIME_SLOTS = [
    ("08:00", "10:00"),
    ("09:00", "11:00"),
    ("10:00", "12:00"),
    ("11:30", "13:30"),
    ("13:00", "15:00"),
    ("14:00", "16:00"),
    ("15:00", "17:00"),
    ("16:00", "18:00"),
    ("17:30", "19:30"),
    ("18:30", "20:30"),
]
SHIFT_NAMES = ["1-smena", "2-smena", "guruh A", "guruh B", "kuchaytirilgan", "yakuniy", "ekspress", "boshlang'ich"]


def _phone(rnd, used):
    while True:
        phone = "90%08d" % rnd.randint(0, 99999999)
        if phone not in used:
            used.add(phone)
            return phone


def _username(rnd, used, index):
    base = "demo_%03d" % index
    username = base
    suffix = 1
    while username in used:
        username = "%s_%d" % (base, suffix)
        suffix += 1
    used.add(username)
    return username


class Command(BaseCommand):
    help = "Demo uchun guruhlar, o'quvchilar, davomat va coin ma'lumotlarini yaratadi"

    def add_arguments(self, parser):
        parser.add_argument("--groups", type=int, default=8, help="Yangi guruhlar soni (default: 8)")
        parser.add_argument("--students-per-group", type=int, default=12, help="Har guruhga o'quvchi soni (default: 12)")
        parser.add_argument("--teachers", type=int, default=6, help="Kamida shuncha o'qituvchi bo'lishi kerak (default: 6)")
        parser.add_argument("--fill-existing", action="store_true", help="Mavjud guruhlarni ham o'quvchilar bilan to'ldiradi")
        parser.add_argument("--attendance-days", type=int, default=21, help="Har guruh uchun oxirgi necha kunlik davomat (default: 21)")
        parser.add_argument("--seed", type=int, default=20260930, help="Random seed (takrorlanuvchan natija uchun)")
        parser.add_argument("--reset", action="store_true", help="Demo ma'lumotlarni tozalab, qaytadan yaratadi")
        parser.add_argument(
            "--deactivate-only",
            action="store_true",
            help="Faqat demo o'quvchilar va guruhlarni o'chiradi, qaytadan yaratmaydi",
        )

    # ------------------------------------------------------------------ reset
    def _reset(self):
        self.stdout.write("Eski demo ma'lumotlar tozalanmoqda...")
        students = Student.all_objects.filter(username__startswith=DEMO_MARK)
        n_students = students.count()
        demo_group_ids = set(
            GroupLog.objects.filter(created_by="Demo").values_list("group_id", flat=True)
        )
        students.update(is_active=False, is_deleted=True)
        groups = Group.all_objects.filter(pk__in=demo_group_ids)
        n_groups = groups.count()
        groups.update(is_active=False)
        LessonTime.objects.filter(group_id__in=demo_group_ids).delete()
        GroupTeacherAssignment.objects.filter(group_id__in=demo_group_ids).delete()
        StudentLog.objects.filter(student__username__startswith=DEMO_MARK).delete()
        ShopOrder.objects.filter(student__username__startswith=DEMO_MARK).delete()
        n_att = Attendance.objects.filter(student__username__startswith=DEMO_MARK).delete()[0]
        n_tx = CoinTransaction.objects.filter(student__username__startswith=DEMO_MARK).delete()[0]
        CoinBalance.objects.filter(student__username__startswith=DEMO_MARK).delete()
        self.stdout.write(
            f"  {n_students} o'quvchi, {n_groups} guruh, {n_att} davomat, {n_tx} coin tranzaksiyasi o'chirildi"
        )

    # ------------------------------------------------------------------ deactivate
    def _deactivate(self):
        """Barcha demo o'quvchi va guruhlarni o'chiradi (ma'lumotni o'chirmaydi, faol emas qiladi)."""
        self.stdout.write("Demo o'quvchilar va guruhlar o'chirilmoqda...")
        demo_group_ids = set(
            GroupLog.objects.filter(created_by="Demo").values_list("group_id", flat=True)
        )

        students = Student.all_objects.filter(username__startswith=DEMO_MARK, is_active=True)
        n_students = students.count()
        students.update(is_active=False, is_deleted=True)

        groups = Group.all_objects.filter(pk__in=demo_group_ids, is_active=True)
        n_groups = groups.count()
        groups.update(is_active=False)

        self.stdout.write(
            self.style.SUCCESS(f"  {n_students} o'quvchi, {n_groups} guruh o'chirildi")
        )

    # ------------------------------------------------------------------ helpers
    def _get_role(self):
        role, _ = Role.objects.get_or_create(name="O'qituvchi", defaults={"level": "o'qituvchi"})
        return role

    def _ensure_teachers(self, count, rnd):
        role = self._get_role()
        existing = list(
            Employee.all_objects.filter(role=role, is_deleted=False, is_active=True)
        )
        created = 0
        i = 0
        while len(existing) < count and i < 200:
            i += 1
            male = rnd.random() < 0.55
            first = rnd.choice(MALE_NAMES if male else FEMALE_NAMES)
            last = rnd.choice(LAST_NAMES)
            phone = _phone(rnd, self._used_phones)
            emp = Employee.objects.create(
                first_name=first,
                last_name=last,
                phone=phone,
                role=role,
                gender=Employee.Gender.MALE if male else Employee.Gender.FEMALE,
                percent=Decimal("30.00"),
            )
            existing.append(emp)
            created += 1
        if created:
            self.stdout.write(f"  {created} ta yangi o'qituvchi yaratildi")
        return existing

    def _ensure_rooms(self, count, rnd):
        rooms = list(Room.all_objects.filter(is_active=True))
        i = 1
        while len(rooms) < count and i < 500:
            i += 1
            name = "%d-xona" % i
            room, created = Room.objects.get_or_create(name=name, defaults={"is_active": True})
            if not room.is_active:
                room.is_active = True
                room.save(update_fields=["is_active"])
            rooms.append(room)
        return rooms

    def _ensure_shop(self):
        categories, _ = ShopCategory.objects.get_or_create(name="Kitoblar")
        categories2, _ = ShopCategory.objects.get_or_create(name="Kanselyariya")
        categories3, _ = ShopCategory.objects.get_or_create(name="Sovg'a")
        products = [
            ("Darslik (notebook)", categories, 25, 50),
            ("Qalam to'plami", categories2, 15, 80),
            ("Kalkulyator", categories2, 60, 15),
            ("IT kursi futbolkası", categories3, 120, 25),
            ("Sumka", categories3, 200, 10),
            ("Kurs video kursi (1 oy)", categories, 300, 999),
            ("Coffee", categories3, 30, 60),
            ("Stiker to'plami", categories2, 10, 100),
        ]
        created = 0
        for name, cat, price, stock in products:
            _, was_created = ShopProduct.objects.get_or_create(
                name=name,
                defaults={"category": cat, "coin_price": price, "stock": stock, "description": "Demo mahsulot"},
            )
            created += int(was_created)
        if created:
            self.stdout.write(f"  {created} ta shop mahsuloti yaratildi")

    def _create_group(self, *, name, course, level, room, teacher, days, start, end, rnd):
        price = level.daily_price if level else Decimal("150000.00")
        group = Group.objects.create(
            name=name,
            status=Group.Status.ACTIVE,
            course=course,
            level=level,
            room=room,
            teacher=teacher,
            education_type=rnd.choice([Group.EducationType.OFFLINE] * 4 + [Group.EducationType.ONLINE]),
            day_type=Group.DayType.EVERYDAY,
            days=",".join(days),
            start_date=start,
            end_date=end,
            lesson_price=price,
        )
        LessonTime.objects.create(
            group=group,
            days=",".join(days),
            start_time=time(*map(int, TIME_SLOTS[0][0].split(":"))),
            end_time=time(*map(int, TIME_SLOTS[0][1].split(":"))),
        )
        GroupTeacherAssignment.objects.create(
            group=group, teacher=teacher, start_date=start, end_date=end
        )
        GroupLog.objects.create(
            group=group,
            action="created",
            description=f"{group.name} (O'qituvchi: {teacher}, Kurs: {course})",
            created_by="Demo",
        )
        return group

    # ------------------------------------------------------------------ coins
    def _give_coins(self, student, group, teacher, rnd, reasons):
        """O'quvchiga turli coin tranzaksiyalari -> har xil balans (ball)."""
        target = rnd.randint(-40, 260)
        if target >= 0:
            reason = rnd.choice([r for r in reasons if r.reason_type == CoinReason.Type.BONUS])
            steps = max(1, target // max(reason.amount, 1))
        else:
            reason = rnd.choice([r for r in reasons if r.reason_type == CoinReason.Type.PENALTY])
            steps = max(1, abs(target) // max(abs(reason.amount), 1))

        balance = 0
        used = 0
        while used < steps:
            r = reason
            if used > 0 and rnd.random() < 0.4:
                pool = [x for x in reasons if x.reason_type == r.reason_type and x.pk != r.pk]
                if pool:
                    r = rnd.choice(pool)
            create_transaction(
                student=student,
                amount=r.amount,
                transaction_type=(
                    CoinTransaction.Type.BONUS if r.amount > 0 else CoinTransaction.Type.PENALTY
                ),
                reason=r,
                description="Demo ma'lumot",
                created_by=f"{teacher.first_name} {teacher.last_name}",
                created_by_employee=teacher,
                group=group,
                notify=False,
            )
            balance += r.amount
            used += 1

        # ba'zi o'quvchilar boshqa sabab bilan coin yutadi
        if rnd.random() < 0.25:
            winner = next((r for r in reasons if r.name == "Musobaqa g'olibi"), None)
            if winner:
                create_transaction(
                    student=student,
                    amount=winner.amount,
                    transaction_type=CoinTransaction.Type.BONUS,
                    reason=winner,
                    description="Demo ma'lumot",
                    created_by=f"{teacher.first_name} {teacher.last_name}",
                    created_by_employee=teacher,
                    group=group,
                    notify=False,
                )
                balance += winner.amount
        return balance

    # ------------------------------------------------------------------ main
    def handle(self, *args, **options):
        rnd = random.Random(options["seed"])
        n_groups = max(1, options["groups"])
        n_students = max(1, options["students_per_group"])
        n_teachers = max(1, options["teachers"])
        attendance_days = max(0, options["attendance_days"])

        if options["deactivate_only"]:
            self._deactivate()
            return

        if options["reset"]:
            self._reset()

        self.stdout.write(self.style.MIGRATE_HEADING("Demo ma'lumotlar tayyorlanmoqda..."))

        with transaction.atomic():
            self._used_phones = {
                p for p in Student.all_objects.values_list("phone", flat=True) if p
            } | {p for p in Employee.all_objects.values_list("phone", flat=True) if p}
            self._used_usernames = {
                u for u in Student.all_objects.values_list("username", flat=True) if u
            }

            reasons = list(CoinReason.objects.filter(is_active=True))
            if not reasons:
                self.stdout.write(self.style.ERROR("Faol coin sabablari yo'q! Avval sabab yarating."))
                return

            courses = list(Course.all_objects.filter(is_active=True))
            if not courses:
                self.stdout.write(self.style.ERROR("Faol kurslar yo'q! Avval kurs yarating."))
                return

            teachers = self._ensure_teachers(n_teachers, rnd)
            rooms = self._ensure_rooms(6, rnd)
            self._ensure_shop()

            # ---------------------------------------------------------- guruhlar
            new_groups = []
            today = date.today()
            for i in range(n_groups):
                course = courses[i % len(courses)]
                level = course.levels.filter(is_active=True).first()
                teacher = rnd.choice(teachers)
                room = rnd.choice(rooms) if rnd.random() < 0.85 else None
                shift = rnd.choice(SHIFT_NAMES)
                days = sorted(rnd.sample(DAY_KEYS, rnd.choice([2, 2, 3, 3, 4])), key=lambda d: DAY_INDEX[d])
                start_slot, end_slot = rnd.choice(TIME_SLOTS)
                start = today - timedelta(days=rnd.randint(20, 120))
                end = start + timedelta(days=rnd.choice([90, 120, 150, 180]))
                name = "%s / %s / %s-%s / %s" % (
                    course.name,
                    shift,
                    start_slot,
                    end_slot,
                    teacher.first_name,
                )
                group = self._create_group(
                    name=name, course=course, level=level, room=room, teacher=teacher,
                    days=days, start=start, end=end, rnd=rnd,
                )
                lt = group.lesson_times.first()
                if lt:
                    lt.start_time = time(*map(int, start_slot.split(":")))
                    lt.end_time = time(*map(int, end_slot.split(":")))
                    lt.save(update_fields=["start_time", "end_time"])
                new_groups.append(group)
            self.stdout.write(self.style.SUCCESS("  %d ta yangi guruh yaratildi" % len(new_groups)))

            # ---------------------------------------------------------- o'quvchilar
            target_groups = list(new_groups)
            if options["fill_existing"]:
                existing_groups = (
                    Group.all_objects.filter(is_active=True)
                    .exclude(pk__in=[g.pk for g in new_groups])
                    .order_by("pk")
                )
                target_groups += list(existing_groups)
            if not target_groups:
                self.stdout.write(self.style.WARNING("  Guruh topilmadi"))
                return

            created_students = 0
            idx = 0
            first_names = MALE_NAMES + FEMALE_NAMES
            for group in target_groups:
                teacher = group.teacher or rnd.choice(teachers)
                # ba'zi guruhlarga oldingi o'quvchilarni ham qo'shamiz
                existing = list(group.students.all())
                need = max(0, n_students - len(existing))
                for _ in range(need):
                    idx += 1
                    male = rnd.random() < 0.55
                    first = rnd.choice(MALE_NAMES if male else FEMALE_NAMES)
                    last = rnd.choice(LAST_NAMES)
                    student = Student.objects.create(
                        first_name=first,
                        last_name=last,
                        phone=_phone(rnd, self._used_phones),
                        username=_username(rnd, self._used_usernames, idx),
                        status=Student.Status.PENDING,
                        birth_date=date(rnd.randint(2003, 2012), rnd.randint(1, 12), rnd.randint(1, 28)),
                        school=rnd.choice(SCHOOLS),
                        education_language=rnd.choice(["O'zbekcha", "O'zbekcha", "Ruscha", "Inglizcha"]),
                        address_region=rnd.choice(REGIONS),
                        target_university=rnd.choice(UNIVERSITIES) if rnd.random() < 0.5 else None,
                        student_category=rnd.choice(["Oddiy", "Oddiy", "Chegirma", "Mavsumiy", "Sinov darsiga"]),
                        lesson_time=group.lesson_times.first().get_days_display() if group.lesson_times.exists() else "",
                        additional_info="Demo ma'lumot",
                    )
                    student.groups.add(group)
                    group.students.add(student)
                    student.desired_course.add(group.course)
                    StudentLog.objects.create(
                        student=student, group=group,
                        action=StudentLog.Action.JOINED, created_by="Demo",
                    )
                    created_students += 1
                    self._give_coins(student, group, teacher, rnd, reasons)
            self.stdout.write(self.style.SUCCESS("  %d ta yangi o'quvchi yaratildi" % created_students))

            # ---------------------------------------------------------- davomat + coin
            n_att = 0
            for group in target_groups:
                lesson_times = list(group.lesson_times.all())
                if not lesson_times:
                    continue
                lt = lesson_times[0]
                day_keys = [d.strip() for d in (lt.days or group.days or "").split(",") if d.strip()]
                if not day_keys:
                    continue
                teacher = group.teacher or rnd.choice(teachers)
                for offset in range(attendance_days):
                    day = today - timedelta(days=offset)
                    key = DAY_KEYS[day.weekday()]
                    if key not in day_keys:
                        continue
                    if group.start_date and day < group.start_date:
                        continue
                    for student in group.students.all():
                        r = rnd.random()
                        if r < 0.82:
                            status = Attendance.Status.PRESENT
                        elif r < 0.94:
                            status = Attendance.Status.ABSENT
                        else:
                            status = Attendance.Status.EXCUSED
                        att, _ = Attendance.objects.get_or_create(
                            group=group, student=student, date=day,
                            defaults={
                                "lesson_time": lt,
                                "status": status,
                                "teacher": teacher,
                                "created_by": "Demo",
                            },
                        )
                        n_att += 1
                        # Attendance signal coin avtomatik yaratadi
                        CoinTransaction.objects.filter(attendance=att).update(
                            created_by="Demo"
                        )
            self.stdout.write(self.style.SUCCESS("  %d ta davomat yozildi" % n_att))

            # ---------------------------------------------------------- shop buyurtmalari
            n_orders = 0
            products = list(ShopProduct.objects.filter(is_active=True, stock__gt=0))
            for student in Student.all_objects.filter(is_active=True, is_deleted=False):
                bal, _ = CoinBalance.objects.get_or_create(student=student, defaults={"balance": 0})
                if bal.balance < 30 or not products or rnd.random() > 0.25:
                    continue
                product = rnd.choice(products)
                qty = 1
                total = product.coin_price * qty
                if total > bal.balance:
                    continue
                order = ShopOrder.objects.create(
                    student=student, product=product, product_name=product.name,
                    product_price=product.coin_price, quantity=qty,
                    status=ShopOrder.Status.GIVEN, created_by="Demo",
                    given_at=timezone.now(),
                )
                product.stock -= qty
                product.save(update_fields=["stock"])
                create_transaction(
                    student=student, amount=-total,
                    transaction_type=CoinTransaction.Type.SHOP,
                    reason_name="Shop — %s sotib olindi" % product.name,
                    description="Order #%d — %s x %d" % (order.id, product.name, qty),
                    created_by="Demo", shop_order=order, notify=False,
                )
                n_orders += 1
            if n_orders:
                self.stdout.write(self.style.SUCCESS("  %d ta shop buyurtmasi yaratildi" % n_orders))

            self._spread_dates(rnd, attendance_days)

        # ------------------------------------------------------------------ summary
        from coins.services import leaderboard

        total_groups = Group.all_objects.filter(is_active=True).count()
        total_students = Student.all_objects.filter(is_active=True, is_deleted=False).count()
        self.stdout.write("")
        self.stdout.write(self.style.SUCCESS(
            "Jami: %d ta faol guruh, %d ta o'quvchi" % (total_groups, total_students)
        ))
        top = leaderboard(limit=10)
        if top:
            self.stdout.write(self.style.MIGRATE_HEADING("Leaderboard (top 10):"))
            for row in top:
                self.stdout.write(
                    "  %2d. %-28s %5d ball" % (row["rank"], row["student_name"], row["score"])
                )

    # ------------------------------------------------------------------ tarix
    def _spread_dates(self, rnd, attendance_days):
        """Demo yozuvlarni o'tmishga tarqatadi — bugungi hisobotlar sun'iy to'lishi oldi olinsa.

        auto_now_add maydonlarini .update() orqali o'zgartiramiz.
        """
        span = max(1, attendance_days)
        now = timezone.now()

        def stamp():
            days = rnd.randint(0, span - 1)
            return now - timedelta(
                days=days, hours=rnd.randint(0, 10), minutes=rnd.randint(0, 59)
            )

        def backdate(qs, field="created_at"):
            for obj in qs.only("id", field):
                setattr(obj, field, stamp())
                obj.save(update_fields=[field])

        demo_students = Student.all_objects.filter(username__startswith=DEMO_MARK)
        backdate(Attendance.objects.filter(student__in=demo_students))
        backdate(CoinTransaction.objects.filter(student__in=demo_students))
        backdate(CoinNotification.objects.filter(student__in=demo_students))
        backdate(ShopOrder.objects.filter(student__in=demo_students), "created_at")
        backdate(StudentLog.objects.filter(student__in=demo_students))
        self.stdout.write("  Demo yozuvlar o'tmishga tarqatildi")
