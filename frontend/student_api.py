import json
import random
import re
import string
from functools import wraps
from datetime import datetime, date, timedelta, time
from django.conf import settings
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.contrib.auth.models import User
from django.contrib.auth import authenticate
from django.db.models import Count, Q
from django.utils import timezone
from decimal import Decimal
from datetime import timedelta
from .models import Student, Group, LessonTime, Attendance, VerificationCode, Employee, StudentBalance, Transaction


def generate_code():
    return str(random.randint(100000, 999999))


def generate_token():
    return ''.join(random.choices(string.ascii_letters + string.digits, k=64))


def normalize_phone(phone):
    phone = re.sub(r'\D', '', phone)
    if len(phone) == 9:
        phone = '998' + phone
    if phone.startswith('998') and len(phone) >= 12:
        phone = phone[:12]
    return phone


def student_required(view_func):
    @wraps(view_func)
    def wrapper(request, *args, **kwargs):
        auth_header = request.META.get("HTTP_AUTHORIZATION", "")
        token = ""
        if auth_header.startswith("Token "):
            token = auth_header[6:]
        if not token:
            return JsonResponse({"error": "Avtorizatsiya talab qilinadi"}, status=401)
        try:
            vc = VerificationCode.objects.filter(code=token, is_used=True).first()
            if not vc:
                return JsonResponse({"error": "Noto'g'ri token"}, status=401)
            raw_phone = re.sub(r'\D', '', vc.phone or "")
            digits9 = raw_phone[-9:] if len(raw_phone) >= 9 else raw_phone
            student = Student.objects.filter(
                Q(phone=raw_phone) |
                Q(phone='+' + raw_phone) |
                Q(phone='998' + digits9) |
                Q(phone='+998' + digits9)
            ).first()
            if not student:
                return JsonResponse({"error": "O'quvchi topilmadi"}, status=404)
            request.student = student
            return view_func(request, *args, **kwargs)
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)
    return wrapper


BOT_TOKEN = settings.BOT_TOKEN


def send_telegram_message(chat_id, text):
    try:
        import requests
        requests.post(
            f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage",
            json={"chat_id": chat_id, "text": text}
        )
    except:
        pass


def send_telegram_keyboard(chat_id, text, keyboard):
    try:
        import requests
        requests.post(
            f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage",
            json={"chat_id": chat_id, "text": text, "reply_markup": keyboard}
        )
    except:
        pass


@csrf_exempt
def telegram_webhook(request):
    if request.method != "POST":
        return JsonResponse({"error": "POST so'rovi kerak"}, status=405)
    try:
        data = json.loads(request.body)
    except:
        return JsonResponse({"error": "Noto'g'ri JSON"}, status=400)

    message = data.get("message", {})
    chat_id = str(message.get("chat", {}).get("id", ""))
    text = (message.get("text") or "").strip()
    contact = message.get("contact")

    if not chat_id:
        return JsonResponse({"ok": False})

    phone = ""
    if contact:
        phone = contact.get("phone_number", "")
    elif text:
        if text.startswith("/start"):
            parts = text.split(maxsplit=1)
            phone = parts[1].strip() if len(parts) > 1 else ""
        else:
            phone = text

    if not phone and text and text.startswith("/start"):
        ask_keyboard = {
            "keyboard": [[{"text": "📱 Telefon raqamni yuborish", "request_contact": True}]],
            "resize_keyboard": True,
            "one_time_keyboard": True
        }
        send_telegram_keyboard(chat_id,
            "👋 Assalomu alaykum! IT House Superapp botiga xush kelibsiz.\n\n"
            "Iltimos, telefon raqamingizni yuboring yoki quyidagi tugmani bosing:",
            ask_keyboard
        )
        return JsonResponse({"ok": True})

    if phone:
        raw = re.sub(r'\D', '', phone)
        digits9 = raw[-9:] if len(raw) >= 9 else raw
        student = Student.objects.filter(
            Q(phone=raw) | Q(phone='+' + raw) | Q(phone='998' + digits9) | Q(phone='+998' + digits9)
        ).first()
        if student:
            student.telegram_chat_id = chat_id
            student.save()
            remove_keyboard = {"remove_keyboard": True}
            send_telegram_keyboard(chat_id,
                "✅ Telefon raqamingiz tasdiqlandi! Endi ilovadan tasdiqlash kodi olishingiz mumkin.",
                remove_keyboard
            )
        else:
            send_telegram_message(chat_id, "❌ Bu raqam tizimda topilmadi. Avval ro'yxatdan o'ting.")

    return JsonResponse({"ok": True})


@csrf_exempt
def send_code(request):
    if request.method != "POST":
        return JsonResponse({"error": "POST so'rovi kerak"}, status=405)
    try:
        data = json.loads(request.body)
    except:
        return JsonResponse({"error": "Noto'g'ri JSON"}, status=400)

    phone = data.get("phone", "").strip()
    if not phone:
        return JsonResponse({"error": "Telefon raqam kiritilmagan"}, status=400)

    raw = re.sub(r'\D', '', phone)
    digits9 = raw[-9:] if len(raw) >= 9 else raw
    student = Student.objects.filter(
        Q(phone=raw) | Q(phone='+' + raw) | Q(phone='998' + digits9) | Q(phone='+998' + digits9)
    ).first()
    if not student:
        return JsonResponse({"error": "Bu nomer qabulga berilmagan"}, status=404)

    phone = '+' + raw[-12:] if len(raw) >= 12 else '+' + raw
    code = generate_code()
    VerificationCode.objects.create(phone=phone, code=code)

    if student.telegram_chat_id:
        send_telegram_message(student.telegram_chat_id, f"🔐 Tasdiqlash kodingiz: {code}")
    else:
        admin_chats = ["8541380592"]
        for chat in admin_chats:
            send_telegram_message(chat, f"📞 {phone} uchun tasdiqlash kodi: {code}")

    data = {
        "success": True,
        "message": "Tasdiqlash kodi yuborildi",
        "telegram_connected": bool(student.telegram_chat_id),
    }
    return JsonResponse(data)


@csrf_exempt
def verify_code(request):
    if request.method != "POST":
        return JsonResponse({"error": "POST so'rovi kerak"}, status=405)
    try:
        data = json.loads(request.body)
    except:
        return JsonResponse({"error": "Noto'g'ri JSON"}, status=400)

    phone = data.get("phone", "").strip()
    code = data.get("code", "").strip()

    if not phone or not code:
        return JsonResponse({"error": "Telefon raqam va kod kiritilmagan"}, status=400)

    raw = re.sub(r'\D', '', phone)
    digits9 = raw[-9:] if len(raw) >= 9 else raw
    phone_search = [raw, '+' + raw, '998' + digits9, '+998' + digits9]

    vc = VerificationCode.objects.filter(phone__in=phone_search, code=code, is_used=False).first()
    if not vc:
        return JsonResponse({"error": "Noto'g'ri kod"}, status=400)

    created_at = vc.created_at if vc.created_at else timezone.now()
    if (timezone.now() - created_at).total_seconds() > 300:
        return JsonResponse({"error": "Kod muddati tugagan"}, status=400)

    vc.is_used = True
    vc.save()

    token = generate_token()
    VerificationCode.objects.create(phone=vc.phone, code=token, is_used=True)

    student = Student.objects.filter(
        Q(phone=raw) | Q(phone='+' + raw) | Q(phone='998' + digits9) | Q(phone='+998' + digits9)
    ).first()
    student_data = None
    has_password = False

    if student and student.user:
        has_password = student.user.has_usable_password()

    if student:
        balance, _ = StudentBalance.objects.get_or_create(student=student, defaults={"balance": Decimal('0.00')})
        debt = abs(balance.balance) if balance.balance < 0 else 0
        student_data = {
            "id": student.id,
            "first_name": student.first_name,
            "last_name": student.last_name,
            "phone": student.phone,
            "has_password": has_password,
            "balance": float(balance.balance),
            "balance_str": f"{balance.balance:,.0f} so'm",
            "debt": float(debt),
            "debt_str": f"{debt:,.0f} so'm" if debt else "0 so'm",
        }

    return JsonResponse({
        "success": True,
        "message": "Kod tasdiqlandi",
        "token": token,
        "student": student_data,
        "has_password": has_password,
    })


@csrf_exempt
def set_password(request):
    if request.method != "POST":
        return JsonResponse({"error": "POST so'rovi kerak"}, status=405)
    try:
        data = json.loads(request.body)
    except:
        return JsonResponse({"error": "Noto'g'ri JSON"}, status=400)

    phone = data.get("phone", "").strip()
    password = data.get("password", "")
    confirm_password = data.get("confirm_password", "")

    if not phone or not password:
        return JsonResponse({"error": "Telefon raqam va parol kiritilmagan"}, status=400)

    if password != confirm_password:
        return JsonResponse({"error": "Parollar mos kelmadi"}, status=400)

    if len(password) < 6:
        return JsonResponse({"error": "Parol kamida 6 belgidan iborat bo'lishi kerak"}, status=400)

    raw = re.sub(r'\D', '', phone)
    digits9 = raw[-9:] if len(raw) >= 9 else raw
    phone = '+' + raw[-12:] if len(raw) >= 12 else '+' + raw
    student = Student.objects.filter(
        Q(phone=raw) | Q(phone='+' + raw) | Q(phone='998' + digits9) | Q(phone='+998' + digits9)
    ).first()
    if not student:
        student = Student.objects.create(phone=phone, first_name="", last_name="")
        created = True
    else:
        created = False

    if student.user:
        user = student.user
        user.set_password(password)
        user.save()
    else:
        username = f"student_{phone.replace('+', '').replace(' ', '')}"
        user = User.objects.create_user(
            username=username,
            password=password,
        )
        student.user = user
        student.save()

    return JsonResponse({
        "success": True,
        "message": "Parol muvaffaqiyatli o'rnatildi",
    })


@csrf_exempt
def student_login(request):
    if request.method != "POST":
        return JsonResponse({"error": "POST so'rovi kerak"}, status=405)
    try:
        data = json.loads(request.body)
    except:
        return JsonResponse({"error": "Noto'g'ri JSON"}, status=400)

    phone = data.get("phone", "").strip()
    password = data.get("password", "")

    if not phone or not password:
        return JsonResponse({"error": "Telefon raqam va parol kiritilmagan"}, status=400)

    raw = re.sub(r'\D', '', phone)
    digits9 = raw[-9:] if len(raw) >= 9 else raw
    student = Student.objects.filter(
        Q(phone=raw) | Q(phone='+' + raw) | Q(phone='998' + digits9) | Q(phone='+998' + digits9)
    ).first()
    if not student or not student.user:
        return JsonResponse({"error": "Foydalanuvchi topilmadi. Avval ro'yxatdan o'ting"}, status=400)

    user = authenticate(username=student.user.username, password=password)
    if not user:
        return JsonResponse({"error": "Telefon raqam yoki parol noto'g'ri"}, status=400)

    norm_phone = '+' + raw[-12:] if len(raw) >= 12 else '+' + raw
    token = generate_token()
    VerificationCode.objects.create(phone=norm_phone, code=token, is_used=True)

    groups_data = []
    for g in student.groups.filter(status__in=["aktiv", "kutilyotgan"]).select_related("course", "room", "teacher"):
        groups_data.append({
            "id": g.id,
            "name": g.name,
            "course": g.course.name if g.course else "",
            "room": g.room.name if g.room else "",
            "teacher": f"{g.teacher.first_name} {g.teacher.last_name}" if g.teacher else "",
        })

    balance, _ = StudentBalance.objects.get_or_create(student=student, defaults={"balance": Decimal('0.00')})
    debt = abs(balance.balance) if balance.balance < 0 else 0

    return JsonResponse({
        "success": True,
        "token": token,
        "student": {
            "id": student.id,
            "first_name": student.first_name,
            "last_name": student.last_name,
            "phone": student.phone,
            "balance": float(balance.balance),
            "balance_str": f"{balance.balance:,.0f} so'm",
            "debt": float(debt),
            "debt_str": f"{debt:,.0f} so'm" if debt else "0 so'm",
        },
        "groups": groups_data,
    })


@student_required
def profile(request):
    student = request.student
    groups_data = []
    for g in student.groups.filter(status__in=["aktiv", "kutilyotgan"]).select_related("course", "room", "teacher"):
        lesson_times = []
        for lt in g.lesson_times.all():
            lesson_times.append({
                "days": lt.days,
                "start_time": lt.start_time.strftime("%H:%M") if lt.start_time else "",
                "end_time": lt.end_time.strftime("%H:%M") if lt.end_time else "",
            })
        groups_data.append({
            "id": g.id,
            "name": g.name,
            "course": g.course.name if g.course else "",
            "room": g.room.name if g.room else "",
            "teacher": f"{g.teacher.first_name} {g.teacher.last_name}" if g.teacher else "",
            "lesson_times": lesson_times,
            "start_date": g.start_date.isoformat() if g.start_date else "",
            "end_date": g.end_date.isoformat() if g.end_date else "",
        })

    balance, _ = StudentBalance.objects.get_or_create(student=student, defaults={"balance": Decimal('0.00')})
    debt = abs(balance.balance) if balance.balance < 0 else 0

    recent_transactions = Transaction.objects.filter(student=student).select_related("group").order_by("-created_at")[:20]
    transactions_data = []
    for t in recent_transactions:
        transactions_data.append({
            "id": t.id,
            "amount": float(t.amount),
            "amount_str": f"{'+' if t.amount >= 0 else ''}{t.amount:,.0f} so'm",
            "balance_after": float(t.balance_after),
            "balance_after_str": f"{t.balance_after:,.0f} so'm",
            "type": t.transaction_type,
            "type_display": t.get_transaction_type_display(),
            "group": t.group.name if t.group else "",
            "description": t.description or "",
            "created_by": t.created_by or "",
            "created_at": t.created_at.astimezone(timezone.get_current_timezone()).strftime("%d.%m.%Y %H:%M"),
        })

    return JsonResponse({
        "student": {
            "id": student.id,
            "first_name": student.first_name,
            "last_name": student.last_name,
            "phone": student.phone,
            "birth_date": student.birth_date.isoformat() if student.birth_date else "",
            "father_full_name": student.father_full_name or "",
            "father_phone": student.father_phone or "",
            "mother_full_name": student.mother_full_name or "",
            "mother_phone": student.mother_phone or "",
            "balance": float(balance.balance),
            "balance_str": f"{balance.balance:,.0f} so'm",
            "debt": float(debt),
            "debt_str": f"{debt:,.0f} so'm" if debt else "0 so'm",
        },
        "groups": groups_data,
        "transactions": transactions_data,
    })


@student_required
def today_classes(request):
    student = request.student
    now = datetime.now()
    current_time = now.time()
    weekday_map = {0: "dushanba", 1: "seshanba", 2: "chorshanba", 3: "payshanba", 4: "juma", 5: "shanba", 6: "yakshanba"}
    today_uz = weekday_map[now.weekday()]
    today = date.today()

    groups = student.groups.filter(status__in=["aktiv", "kutilyotgan"]).select_related("course", "room", "teacher").prefetch_related("lesson_times")

    classes = []
    for g in groups:
        if g.is_date_overdue():
            continue
        for lt in g.lesson_times.all():
            days_list = [d.strip().lower() for d in lt.days.split(",") if d.strip()]
            if today_uz not in days_list:
                continue

            status = "upcoming"
            if lt.start_time and lt.end_time:
                if lt.start_time <= current_time <= lt.end_time:
                    status = "ongoing"
                elif lt.end_time < current_time:
                    status = "finished"

            attendance = Attendance.objects.filter(
                student=student, group=g, date=today
            ).first()
            attendance_status = ""
            if attendance:
                attendance_status = attendance.status

            classes.append({
                "id": f"{g.id}_{lt.id}",
                "group_id": g.id,
                "subject": g.course.name if g.course else g.name,
                "teacher": f"{g.teacher.first_name} {g.teacher.last_name}" if g.teacher else "",
                "room": g.room.name if g.room else "",
                "group_name": g.name,
                "start_time": lt.start_time.strftime("%H:%M") if lt.start_time else "",
                "end_time": lt.end_time.strftime("%H:%M") if lt.end_time else "",
                "status": status,
                "attendance_status": attendance_status,
            })

    classes.sort(key=lambda c: c["start_time"])

    return JsonResponse({
        "date": today.isoformat(),
        "weekday": today_uz,
        "classes": classes,
    })


@student_required
def schedule(request):
    student = request.student
    weekday_map = {0: "dushanba", 1: "seshanba", 2: "chorshanba", 3: "payshanba", 4: "juma", 5: "shanba", 6: "yakshanba"}
    days_uz = ["dushanba", "seshanba", "chorshanba", "payshanba", "juma", "shanba", "yakshanba"]
    days_uz_labels = {
        "dushanba": "Dushanba", "seshanba": "Seshanba", "chorshanba": "Chorshanba",
        "payshanba": "Payshanba", "juma": "Juma", "shanba": "Shanba", "yakshanba": "Yakshanba"
    }

    groups = student.groups.filter(status__in=["aktiv", "kutilyotgan"]).select_related("course", "room", "teacher").prefetch_related("lesson_times")

    schedule_data = {}
    for day_key in days_uz:
        schedule_data[day_key] = {"label": days_uz_labels[day_key], "lessons": []}

    for g in groups:
        if g.is_date_overdue():
            continue
        for lt in g.lesson_times.all():
            days_list = [d.strip().lower() for d in lt.days.split(",") if d.strip()]
            for day_key in days_list:
                if day_key in schedule_data:
                    schedule_data[day_key]["lessons"].append({
                        "group_id": g.id,
                        "group_name": g.name,
                        "subject": g.course.name if g.course else g.name,
                        "teacher": f"{g.teacher.first_name} {g.teacher.last_name}" if g.teacher else "",
                        "room": g.room.name if g.room else "",
                        "start_time": lt.start_time.strftime("%H:%M") if lt.start_time else "",
                        "end_time": lt.end_time.strftime("%H:%M") if lt.end_time else "",
                    })

    for day_key in days_uz:
        schedule_data[day_key]["lessons"].sort(key=lambda c: c["start_time"])

    return JsonResponse({"schedule": schedule_data})


@student_required
def attendance_history(request):
    student = request.student
    today = date.today()
    month_start = date(today.year, today.month, 1)

    attendances = Attendance.objects.filter(
        student=student, date__gte=month_start, date__lte=today
    )

    total = attendances.count()
    present = attendances.filter(status="present").count()
    absent = attendances.filter(status="absent").count()
    excused = attendances.filter(status="excused").count()

    percentage = round((present / total * 100)) if total else 0

    records = []
    for a in attendances.order_by("-date"):
        records.append({
            "date": a.date.isoformat(),
            "status": a.status,
            "group": a.group.name if a.group else "",
        })

    return JsonResponse({
        "total": total,
        "present": present,
        "absent": absent,
        "excused": excused,
        "percentage": percentage,
        "records": records,
    })


@student_required
def monthly_calendar(request):
    student = request.student
    year = int(request.GET.get("year", date.today().year))
    month = int(request.GET.get("month", date.today().month))

    import calendar as cal_module
    _, last_day = cal_module.monthrange(year, month)
    month_start = date(year, month, 1)
    month_end = date(year, month, last_day)

    groups = student.groups.filter(status__in=["aktiv", "kutilyotgan"]).prefetch_related("lesson_times")

    lesson_weekdays = set()
    global_start = month_end
    global_end = month_start
    for g in groups:
        if g.start_date and g.start_date < global_start:
            global_start = g.start_date
        if g.end_date and g.end_date > global_end:
            global_end = g.end_date
        for lt in g.lesson_times.all():
            for d_name in lt.days.split(","):
                d_name = d_name.strip().lower()
                weekday_map = {"dushanba": 0, "seshanba": 1, "chorshanba": 2, "payshanba": 3, "juma": 4, "shanba": 5, "yakshanba": 6}
                if d_name in weekday_map:
                    lesson_weekdays.add(weekday_map[d_name])

    lesson_dates = []
    d = max(month_start, global_start)
    actual_end = min(month_end, global_end)
    while d <= actual_end:
        if d.weekday() in lesson_weekdays:
            lesson_dates.append(d.isoformat())
        d += timedelta(days=1)

    attendances = Attendance.objects.filter(
        student=student, date__gte=month_start, date__lte=month_end
    )
    attendance_map = {}
    for a in attendances:
        attendance_map[a.date.isoformat()] = a.status

    return JsonResponse({
        "year": year,
        "month": month,
        "lesson_dates": lesson_dates,
        "attendance_map": attendance_map,
    })


@student_required
def student_balance_api(request):
    student = request.student
    balance, _ = StudentBalance.objects.get_or_create(student=student, defaults={"balance": Decimal('0.00')})
    debt = abs(balance.balance) if balance.balance < 0 else 0
    return JsonResponse({
        "balance": float(balance.balance),
        "debt": float(debt),
        "balance_str": f"{balance.balance:,.0f} so'm",
        "debt_str": f"{debt:,.0f} so'm" if debt else "0 so'm",
    })


@student_required
def student_transactions_api(request):
    student = request.student
    limit = int(request.GET.get("limit", 50))
    transactions = Transaction.objects.filter(student=student).select_related("group").order_by("-created_at")[:limit]
    data = []
    for t in transactions:
        data.append({
            "id": t.id,
            "amount": float(t.amount),
            "amount_str": f"{'+' if t.amount >= 0 else ''}{t.amount:,.0f} so'm",
            "balance_after": float(t.balance_after),
            "balance_after_str": f"{t.balance_after:,.0f} so'm",
            "type": t.transaction_type,
            "type_display": t.get_transaction_type_display(),
            "group": t.group.name if t.group else "",
            "description": t.description or "",
            "created_by": t.created_by or "",
            "created_at": t.created_at.astimezone(timezone.get_current_timezone()).strftime("%d.%m.%Y %H:%M"),
        })
    return JsonResponse({"transactions": data})
