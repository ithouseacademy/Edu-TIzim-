"""Filial (branch) bo'yicha ma'lumotlarni ajratish.

Qoidalar:
  - `is_superuser` -> barcha filiallarni ko'radi va kerlihida bittasini tanlab
    butun tizimni o'sha filial ko'rinishiga o'tkazadi.
  - Oddiy admin: `AdminBranch` yozuvlari bo'lsa -> faqat o'sha filiallar.
    Yozuv yo'q bo'lsa -> cheklov yo'q (barcha filiallar ko'rinadi).
  - Xodim va o'quvchi o'z filiali doirasida qoladi: ular filialni
    almashtira olmaydi, joriy filial ularniki bo'lib qat'iy belgilanadi.

View ichida:

    from frontend.branch_scope import scope

    students = scope(request, Student.objects.filter(is_deleted=False))
    rooms = scope(request, Room.objects.filter(is_active=True))
"""

from django.db.models import Q

from .models import AdminBranch, Employee

SESSION_KEY = "current_branch_id"


# ============================================================
# FOYDALANUVCHI HUQUQLARI
# ============================================================

def _assigned_ids(user):
    """Admin uchun tayinlangan filial id'lari (bo'sh bo'lsa — cheklov yo'q)."""
    cached = getattr(user, "_cached_branch_ids", None)
    if cached is None:
        cached = list(
            user.admin_branches.filter(branch__is_active=True)
            .values_list("branch_id", flat=True)
            .distinct()
        )
        user._cached_branch_ids = cached
    return cached


def allowed_branch_ids(user):
    """Ko'ra oladigan filial id'lari. `None` = barcha filiallar ochiq.

    Tartib:
      1. Super admin  -> `None` (hammasi).
      2. `AdminBranch` yozuvlari bor admin -> aynan o'sha id'lar.
      3. Xodim akkaunti -> o'z tayinlangan filiallari (biriktirilmagan bo'lsa `None`).
      4. Oddiy admin (tayinlanmagan) -> `None` (hammasi) — eski tartib saqlanadi.
    """
    if user is None or not getattr(user, "is_authenticated", False):
        return []
    if getattr(user, "is_superuser", False):
        return None

    ids = _assigned_ids(user)
    if ids:
        return ids

    if is_branch_staff(user):
        emp = getattr(user, "employee_profile", None)
        if emp is not None:
            emp_ids = list(emp.branches.filter(is_active=True).values_list("id", flat=True))
            return emp_ids or []
        student = getattr(user, "student_profile", None)
        if student is not None:
            return [student.branch_id] if student.branch_id else []
        return []

    return None


def is_unrestricted(user):
    """Foydalanuvchi filial bo'yicha cheklanmaganmi?"""
    ids = allowed_branch_ids(user)
    return ids is None


def can_add_to_all_branches(user):
    """Foydalanuvchi «Barcha filiallar»ga qo'shish huquqiga egami?

    - Cheklovsiz (superuser yoki filialga biriktirilmagan admin) — ha,
      «Barcha filiallar» tanlovi ko'rsatiladi va shunday qo'shishi mumkin.
    - Biriktirilgan admin yoki xodim/o'quvchi — yo'q, faqat o'z filialiga
      qo'shadi va «Barcha filiallar» tanlovi ko'rsatilmaydi.
    """
    return allowed_branch_ids(user) is None


def _first_allowed_branch(user):
    """Ruxsat etilgan filiallarning birinchisi (yoki `None`)."""
    from frontend.models import Branch

    ids = allowed_branch_ids(user)
    if not ids:
        return None
    return Branch.objects.filter(pk__in=ids, is_active=True).order_by("name").first()


def default_add_branch(user, current=None):
    """Yangi yozuv yaratishda standart tanlanadigan filial.

    `current` — joriy tanlangan filial (None = barchasi). Ustuvorlik:
      1. Foydalanuvchi aniq filialni tanlagan bo'lsa — shu filial.
      2. Cheklangan foydalanuvchi — o'zining birinchi ruxsat etilgan filiali.
      3. Cheklovsiz — «Barcha filiallar» (None).
    """
    if current is not None:
        return current
    if can_add_to_all_branches(user):
        return None
    return _first_allowed_branch(user)


def resolve_added_branch(user, branch_id, current=None):
    """POST'dagi `branch_id` ni ruxsat doirasiga qarab hal qiladi.

    Cheklovsiz foydalanuvchi:
      - `branch_id` raqam bo'lsa -> o'sha filial.
      - bo'sh bo'lsa -> `current` (yoki None = «Barcha filiallar»).

    Cheklangan foydalanuvchi:
      - Faqat o'z ruxsat etilgan filiallaridan birini tanlay oladi.
      - «Barcha filiallar» (bo'sh) yoki boshqa filial berilsa ham — o'z
        filiali ishlatiladi (barchaga qo'shish huquqi yo'q).
    """
    from frontend.models import Branch

    ids = allowed_branch_ids(user)
    if ids is None:
        if branch_id and str(branch_id).isdigit():
            return Branch.objects.filter(pk=int(branch_id), is_active=True).first()
        return current
    if branch_id and str(branch_id).isdigit() and int(branch_id) in ids:
        return Branch.objects.filter(pk=int(branch_id), is_active=True).first()
    return _first_allowed_branch(user)


def is_branch_staff(user):
    """Foydalanuvchi xodim yoki o'quvchi akkaunti bilan kirganmi?"""
    if user is None or not getattr(user, "is_authenticated", False):
        return False
    for rel in ("employee_profile", "student_profile"):
        try:
            if getattr(user, rel, None) is not None:
                return True
        except Exception:
            continue
    return False


def can_switch_branch(user):
    """Filialni almashtirish mumkinmi? Xodim/o'quvchi — yo'q."""
    if user is None or not getattr(user, "is_authenticated", False):
        return False
    if getattr(user, "is_superuser", False):
        return True
    if is_branch_staff(user):
        return False
    return True


def available_branches(user):
    """Tanlash mumkin bo'lgan faol filiallar queryset'i."""
    from frontend.models import Branch

    ids = allowed_branch_ids(user)
    qs = Branch.objects.filter(is_active=True)
    if ids is not None:
        qs = qs.filter(id__in=ids)
    return qs.order_by("name")


def form_branches(user):
    """Formalarga beriladigan filial queryset'i (yoki `None` = cheklov yo'q).

    Cheklovsiz foydalanuvchida `None` qaytariladi — forma barcha faol
    filiallarni ko'rsatadi va `branch` ixtiyoriy qoladi. Cheklangan
    foydalanuvchida aniq ruxsat etilgan filiallar qaytariladi va `branch`
    maydoni majburiy bo'ladi.
    """
    if is_unrestricted(user):
        return None
    return available_branches(user)


def user_display_name(user):
    """Foydalanuvchini «Ism Familiya» ko'rinishida qaytaradi.

    Ustuvorlik: `Employee` ismi -> `User` ismi -> `username`.
    """
    if user is None:
        return ""
    emp = getattr(user, "employee_profile", None)
    if emp is not None:
        full = ("%s %s" % (emp.first_name or "", emp.last_name or "")).strip()
        if full:
            return full
    full = user.get_full_name().strip()
    return full or user.username


def branch_admin_map(include_unrestricted=False):
    """Admin -> ruxsat etilgan filial id'lari dict'i.

    Ruxsat ikkala manbadan olinadi:
      - `AdminBranch` (filial → administrator biriktirish sahifasi).
      - `Employee.branches` (xodimning o'z filiali).

    `include_unrestricted=True` bo'lsa, ikkala manbada ham yo'q adminlar uchun
    `None` qo'yiladi (barcha filiallarni boshqaradi) — `allowed_branch_ids` bilan mos.

    `include_unrestricted=False` (kassa/formalar uchun): faqat aniq biriktirilgan
    adminlar kiradi. Superuser uchun `None` qo'yiladi (u har qanday filialni
    boshqaradi). Biriktirilmagan oddiy admin dict'da bo'lmaydi — ya'ni u
    hech qanday filial egasi sifatida tanlanmaydi.
    """
    from django.contrib.auth.models import User

    result = {}
    for user_id, branch_id in AdminBranch.objects.values_list("user_id", "branch_id"):
        result.setdefault(user_id, set()).add(branch_id)

    for user_id, branch_id in Employee.objects.filter(
        branches__isnull=False
    ).values_list("user_id", "branches__id"):
        if user_id is None:
            continue
        result.setdefault(user_id, set()).add(branch_id)

    if include_unrestricted:
        assigned_ids = set(result)
        for user in User.objects.filter(is_staff=True).exclude(pk__in=assigned_ids):
            result.setdefault(user.pk, None)

    for superuser in User.objects.filter(is_superuser=True):
        result[superuser.pk] = None
    return {pk: (sorted(ids) if ids is not None else None) for pk, ids in result.items()}


def can_own_branch_kassa(user, branch):
    """Bu admin shu filial kassasining egasi bo'lishi mumkinmi?

    - `None` branch -> True (filialsiz kassa).
    - superuser -> True.
    - `AdminBranch` yoki `Employee.branches` da shu filial bor -> True.
    - Aks holda -> False (forma xatosi va JS orqali yashirish).
    """
    if branch is None:
        return True
    if getattr(user, "is_superuser", False):
        return True
    if AdminBranch.objects.filter(user=user, branch=branch).exists():
        return True
    return Employee.objects.filter(user=user, branches=branch).exists()


def branch_admin_users(branch, include_unrestricted=True):
    """Shu filialni boshqarishi mumkin bo'lgan adminlar queryset'i.

    Qoidalar:
      - `is_superuser` -> har qanday filialni boshqaradi.
      - `AdminBranch` shu filialga biriktirilgan adminlar.
      - `include_unrestricted` True bo'lsa, biriktirilmagan (barcha filiallarni
        ko'radigan) adminlar ham qo'shiladi — eski tartib saqlanadi.
    """
    from django.contrib.auth.models import User

    if branch is None:
        return User.objects.none()

    ids = set(
        AdminBranch.objects.filter(branch=branch).values_list("user_id", flat=True)
    )
    qs = User.objects.filter(Q(is_superuser=True) | Q(pk__in=ids))
    if include_unrestricted:
        unrestricted = (
            User.objects.filter(is_staff=True)
            .exclude(admin_branches__isnull=False)
            .distinct()
        )
        qs = qs | unrestricted
    return qs.order_by("username").distinct()


def has_branch_access(user, branch):
    """Foydalanuvchi shu filialni ko'ra oladimi?

    `branch is None` (filialsiz ma'lumot) faqat cheklovsiz adminlarga ochiq —
    aks holda ma'lumot hech qaysi filialga tegishli emasligi uchun yashiriladi.
    """
    ids = allowed_branch_ids(user)
    if ids is None:
        return True
    if branch is None:
        return False
    return branch.pk in ids


def default_branch_for(user):
    """O'quvchilar uchun ularning filiali — yangi obyektda shu tanlanadi."""
    student = getattr(user, "student_profile", None)
    if student is not None:
        return student.branch
    return None


def _employee_branch(user):
    emp = getattr(user, "employee_profile", None)
    if emp is None:
        return None
    return emp.branches.order_by("name").first()


def _branch_or_none(branch_id):
    from frontend.models import Branch

    return Branch.objects.filter(id=branch_id, is_active=True).first()


# ============================================================
# JORIY FILIAL (session)
# ============================================================

def get_current_branch(request):
    """Joriy tanlangan filial obyekti (None = «Barcha filiallar»).

    Xodim/o'quvchi uchun `None` qaytariladi: ular allaqachon
    `allowed_branch_ids` orqali o'z filiallariga cheklangan.
    """
    user = getattr(request, "user", None)
    if user is None or not getattr(user, "is_authenticated", False):
        return None

    if not can_switch_branch(user):
        return None

    raw = request.session.get(SESSION_KEY)
    if not raw:
        return None
    try:
        branch_id = int(raw)
    except (TypeError, ValueError):
        return None
    if branch_id == 0:
        return None
    branch = _branch_or_none(branch_id)
    if branch is None or not has_branch_access(user, branch):
        return None
    return branch


def set_current_branch(request, branch_id):
    """Session'dagi filialni o'zgartiradi. 0 / None -> «Barcha filiallar»."""
    user = getattr(request, "user", None)
    if not can_switch_branch(user):
        return get_current_branch(request)
    if not branch_id:
        request.session[SESSION_KEY] = 0
        return None
    try:
        branch_id = int(branch_id)
    except (TypeError, ValueError):
        return get_current_branch(request)
    if branch_id == 0:
        request.session[SESSION_KEY] = 0
        return None
    branch = _branch_or_none(branch_id)
    if branch is None or not has_branch_access(user, branch):
        return get_current_branch(request)
    request.session[SESSION_KEY] = branch_id
    return branch


def clear_current_branch(request):
    request.session.pop(SESSION_KEY, None)


# ============================================================
# QUERYSET FILTRLASH
# ============================================================

def branch_condition(request):
    """Filialga qarab quriladigan Q obyekti (None = filtr kerak emas)."""
    user = getattr(request, "user", None)
    if user is None or not getattr(user, "is_authenticated", False):
        return Q(pk__in=[])

    condition = None
    ids = allowed_branch_ids(user)
    if ids is not None:
        condition = Q(branch_id__in=ids)
    elif not can_switch_branch(user):
        # Xodim/o'quvchi: tayinlanmagan filial yo'q -> hech narsa ko'rinmaydi.
        return Q(pk__in=[])

    current = get_current_branch(request)
    if current is not None:
        current_q = Q(branch_id=current.pk)
        condition = current_q if condition is None else (condition & current_q)

    return condition


def scope_employees(request, queryset=None):
    """Xodimlar ro'yxatini filial bo'yicha cheklaydi.

    Xodim o'zida `branches` maydoni yo'q, shuning uchun `scope()` ishlamaydi:
    kerakli bo'lishi foydalanuvchining ruxsat etilgan filiallari bilan
    kesishgan xodimlarni qaytaradi.

    Superuser va cheklovsiz adminlar uchun hamma xodim qaytariladi.
    """
    from .models import Employee

    if queryset is None:
        queryset = Employee.objects.all()
    ids = allowed_branch_ids(request.user)
    if ids is not None:
        queryset = queryset.filter(branches__id__in=ids)
    current = get_current_branch(request)
    if current is not None:
        queryset = queryset.filter(branches=current)
    return queryset.distinct()


def scope_related(request, queryset, path, distinct=True):
    """Bog'lanish orqali filialga cheklaydi.

    Ko'p modelda `branch` maydoni yo'q, lekin filial boshqa maydon orqali
    aniqlanadi (masalan `Feedback.student.branch`). Bunday hollarda bu
    yordamchi ishlatiladi:

        feedbacks = scope_related(request, Feedback.objects.all(), "student")
        reminders = scope_related(request, Reminder.objects.all(), "employee__branches")

    `path` — bog'lanish yo'li. Uning oxiri `branches` (M2M) bo'lsa
    `distinct()` avtomatik qo'shiladi.
    """
    ids = allowed_branch_ids(request.user)
    if ids is None:
        return queryset
    return queryset.filter(**{"%s__id__in" % path: ids}).distinct()


def scope_path(request, queryset, path):
    """`Branch`ga olib boruvchi ORM yo'li orqali queryset'ni filialga cheklaydi.

    Modelda `branch` maydoni bo'lmasa, lekin unga bog'lanish orqali yetib
    borish mumkin bo'lsa ishlatiladi:

        lessons = scope_path(request, LessonTime.objects.all(), "group__branch")

    Joriy filial tanlangan bo'lsa faqat o'sha filial, aks holda foydalanuvchi
    ruxsat etilgan filiallar doirasi. Cheklovsiz foydalanuvchi (ruxsat
    `None` bo'lsa) uchun queryset o'zgarmaydi.
    """
    current = get_current_branch(request)
    if current is not None:
        return queryset.filter(**{path: current})
    ids = allowed_branch_ids(request.user)
    if ids is not None:
        return queryset.filter(**{path + "__in": ids})
    return queryset


def scope_courses(request, queryset=None):
    """Kurslarni filialga qarab cheklaydi."""
    from .models import Course

    if queryset is None:
        queryset = Course.objects.all()
    return scope_related(request, queryset, "branches")


def has_courses_access(user, course):
    """Foydalanuvchi shu kursni ko'ra oladimi?

    Cheklovsiz foydalanuvchi -> `True`.
    Cheklangan foydalanuvchi -> kurs kamida bittasiga biriktirilgan
    filial ruxsat etilgan filiallar orasida bo'lishi kerak.
    """
    ids = allowed_branch_ids(user)
    if ids is None:
        return True
    if course is None:
        return False
    course_branch_ids = set(course.branches.values_list("id", flat=True))
    return bool(course_branch_ids.intersection(ids))


def scope_course_levels(request, queryset=None):
    """Kurs darajalarini ularning kursi orqali filialga cheklaydi."""
    from .models import CourseLevel

    if queryset is None:
        queryset = CourseLevel.objects.all()
    return scope_related(request, queryset, "course__branches")


def branch_filter(request, prefix=""):
    """`Count(...)` / `Exists(...)` uchun `filter=` argumenti.

    Cheklov yo'q bo'lsa bo'sh `Q()` qaytaradi (hammasi mos keladi) —
    `None` qaytarib berish Django'da xato keltiradi.

    `prefix` — `branch` maydoni boshqa modelda bo'lsa (masalan
    `MarketingSurvey.students` -> `students__branch`), shu yo'lni bering.
    """
    condition = branch_condition(request)
    if condition is None:
        return Q()
    if not prefix:
        return condition

    # `branch_condition` to'g'ridan-to'g'ri `branch_id` ishlatadi, shuning uchun
    # M2M yoki bog'lanish orqali hisoblanadigan Count/Exists uchun alohida
    # quriladi: joriy filial bo'lsa — o'sha, aks holda ruxsat etilganlar.
    current = get_current_branch(request)
    if current is not None:
        return Q(**{"%sbranch" % prefix: current})
    ids = allowed_branch_ids(request.user)
    if ids is None:
        return Q()
    return Q(**{"%sbranch_id__in" % prefix: ids})


def shop_branch_q(request, prefix=""):
    """Shop/coin yozuvlarini filialga ajratadigan Q obyekti.

    - `prefix=""`         -> `branch` maydoni (ShopProduct, ShopCategory, CoinReason)
    - `prefix="student__"` -> `student__branch` (ShopOrder, CoinTransaction)

    `branch` bo'sh (NULL) yozuvlar barcha filiallar uchun umumiy hisoblanadi va
    hamma joyda ko'rinadi. Cheklov ham, joriy filial ham bo'lmasa `None`
    (filtrsiz) qaytariladi.
    """
    allowed = allowed_branch_ids(request.user)
    current = get_current_branch(request)
    field = prefix + "branch_id"
    if current is not None:
        return Q(**{prefix + "branch__isnull": True}) | Q(**{field: current.pk})
    if allowed is not None:
        if not allowed:
            return Q(pk__in=[])
        return Q(**{prefix + "branch__isnull": True}) | Q(**{field + "__in": allowed})
    return None


def scope_shop(request, queryset, prefix=""):
    """`shop_branch_q` bo'yicha queryset'ni filtrlash (filtr bo'lmasa o'zgarmas)."""
    condition = shop_branch_q(request, prefix=prefix)
    return queryset.filter(condition) if condition is not None else queryset


def scope(request, queryset):
    """Queryset'ni foydalanuvchining filialiga qarab filtrlaydi."""
    condition = branch_condition(request)
    if condition is None:
        return queryset
    return queryset.filter(condition)


def scope_ids(request, model):
    """Filialga ruxsat etilgan obyektlar id'lari ro'yxati."""
    return list(scope(request, model.objects.all()).values_list("id", flat=True))


def default_branch(request):
    """Yangi obyekt yaratishda avtomatik tanlanadigan filial."""
    return get_current_branch(request)


def ensure_access(request, obj):
    """Obyekt foydalanuvchining filial doirasida yoki yo'qligini tekshiradi."""
    user = getattr(request, "user", None)
    branch = getattr(obj, "branch", None)
    if not has_branch_access(user, branch):
        return False
    current = get_current_branch(request)
    if current is not None and (branch is None or branch.pk != current.pk):
        return False
    return True