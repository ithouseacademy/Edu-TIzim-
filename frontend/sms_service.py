import os
import json
import logging
import requests
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

TEXTUP_AUTH_URL = "https://api-auth.textup.uz/v1/login"
TEXTUP_SMS_URL = "https://sms-api.textup.uz/v1/send"

_token_cache = {
    "access_token": None,
    "expires_at": None,
}

ABSENCE_TEMPLATE_ID = os.getenv("TEXTUP_DAVOMAT_TEMPLATE_ID", "")
PAYMENT_TEMPLATE_ID = os.getenv("TEXTUP_TOLOV_TEMPLATE_ID", "")
DEBT_TEMPLATE_ID = os.getenv("TEXTUP_DEBT_TEMPLATE_ID", "")

DEFAULT_ACADEMY_NAME = "IT House"
DEFAULT_PHONE = "550552727"


def _sanitize_signature(sig):
    import re
    sig = re.sub(r'[^\w\s]', '', sig).strip()
    sig = re.sub(r'\s+', ' ', sig)
    parts = sig.split()
    if len(parts) > 3:
        parts = parts[:3]
    return ' '.join(parts)


def _save_sms_history(sms_type, recipient_name, recipient_phone, student_name, message, status, user=None):
    try:
        from .models import SmsHistory
        SmsHistory.objects.create(
            sms_type=sms_type,
            recipient_name=recipient_name or "-",
            recipient_phone=recipient_phone or "-",
            student_name=student_name,
            message=message,
            status=status,
            sent_by=user,
        )
    except Exception as e:
        logger.error(f"SmsHistory saqlashda xatolik: {e}")


def _get_sms_signature():
    try:
        from .models import ReceiptSettings
        settings = ReceiptSettings.get_instance()
        sig = (settings.sms_signature or "").strip()
        if sig:
            return _sanitize_signature(sig)
        name = settings.academy_name or DEFAULT_ACADEMY_NAME
        phone = (settings.phone or "").replace("+", "").replace(" ", "").replace("-", "")
        if phone.startswith("998") and len(phone) > 9:
            phone = phone[3:]
        if not phone:
            phone = DEFAULT_PHONE
        return _sanitize_signature(f"{name} {phone}")
    except Exception:
        return f"{DEFAULT_ACADEMY_NAME} {DEFAULT_PHONE}"


def _get_credentials():
    email = os.getenv("TEXTUP_EMAIL", "")
    password = os.getenv("TEXTUP_PASSWORD", "")
    user_id = os.getenv("TEXTUP_USER_ID", "")
    return email, password, user_id


def _login():
    email, password, _ = _get_credentials()
    if not email or not password:
        logger.error("TEXTUP_EMAIL yoki TEXTUP_PASSWORD .env faylda topilmadi")
        return None
    try:
        resp = requests.post(
            TEXTUP_AUTH_URL,
            json={"email": email, "password": password},
            timeout=10,
        )
        if resp.status_code == 200:
            data = resp.json()
            token = data.get("accessToken")
            if token:
                _token_cache["access_token"] = token
                _token_cache["expires_at"] = datetime.now() + timedelta(hours=23)
                return token
        logger.error(f"TextUP login xatolik: {resp.status_code} - {resp.text}")
    except Exception as e:
        logger.error(f"TextUP login exception: {e}")
    return None


def _get_token():
    if _token_cache["access_token"] and _token_cache["expires_at"]:
        if datetime.now() < _token_cache["expires_at"]:
            return _token_cache["access_token"]
    return _login()


def _send_single_sms(message, recipient_phone, student_name, user_id, token, label="", template_id=None):
    payload = {
        "message": message,
        "userId": user_id,
        "name": label or f"SMS - {student_name}",
        "recipients": [recipient_phone],
    }
    if template_id is None:
        tpl = ABSENCE_TEMPLATE_ID
    else:
        tpl = template_id
    if tpl:
        payload["templateId"] = tpl

    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }

    try:
        resp = requests.post(TEXTUP_SMS_URL, json=payload, headers=headers, timeout=10)
        if resp.status_code in (200, 201):
            logger.info(f"SMS yuborildi: {student_name} -> {recipient_phone}")
            return True
        elif resp.status_code == 401:
            _token_cache["access_token"] = None
            _token_cache["expires_at"] = None
            token = _get_token()
            if token:
                headers["Authorization"] = f"Bearer {token}"
                resp = requests.post(TEXTUP_SMS_URL, json=payload, headers=headers, timeout=10)
                if resp.status_code in (200, 201):
                    logger.info(f"SMS yuborildi (retry): {student_name} -> {recipient_phone}")
                    return True
            logger.error(f"SMS retry xatolik: {resp.status_code} - {resp.text}")
        else:
            logger.error(f"SMS xatolik: {resp.status_code} - {resp.text}")
    except Exception as e:
        logger.error(f"SMS exception: {e}")
    return False


def send_absence_sms(student, group=None, date_str=None, created_by=""):
    if not date_str:
        date_str = datetime.now().strftime("%d.%m.%Y")

    _, _, user_id = _get_credentials()
    if not user_id:
        logger.error("TEXTUP_USER_ID topilmadi")
        return False

    token = _get_token()
    if not token:
        logger.error("TextUP token olinmadi, SMS yuborib bo'lmadi")
        return False

    student_name = f"{student.first_name} {student.last_name}"
    group_name = group.course.name if group and group.course else "dars"
    signature = _get_sms_signature()

    sent = False
    user_obj = None
    if created_by:
        from django.contrib.auth.models import User
        try:
            user_obj = User.objects.filter(username=created_by).first()
        except Exception:
            pass

    if student.father_phone and student.father_full_name:
        message = f"Hurmatli  {student.father_full_name} ! Sizning farzandingiz {student_name}   {date_str} kuni {group_name}  darsiga kelmadi. {signature}"
        ok = _send_single_sms(message, student.father_phone, student_name, user_id, token, f"Davomat - {student_name} (ota)")
        if ok:
            sent = True
        _save_sms_history("absence", student.father_full_name, student.father_phone, student_name, message, "yuborildi" if ok else "xatolik", user_obj)

    if student.mother_phone and student.mother_full_name:
        message = f"Hurmatli  {student.mother_full_name} ! Sizning farzandingiz {student_name}   {date_str} kuni {group_name}  darsiga kelmadi. {signature}"
        ok = _send_single_sms(message, student.mother_phone, student_name, user_id, token, f"Davomat - {student_name} (ona)")
        if ok:
            sent = True
        _save_sms_history("absence", student.mother_full_name, student.mother_phone, student_name, message, "yuborildi" if ok else "xatolik", user_obj)

    if not sent:
        logger.warning(f"{student} uchun ota-ona nomeri yoki ismi topilmadi, SMS yuborilmadi")

    return sent


def send_payment_received_sms(student, amount):
    _, _, user_id = _get_credentials()
    if not user_id:
        logger.error("TEXTUP_USER_ID topilmadi")
        return False

    token = _get_token()
    if not token:
        logger.error("TextUP token olinmadi, SMS yuborib bo'lmadi")
        return False

    student_name = f"{student.first_name} {student.last_name}"
    amount_str = f"{amount:,.0f}".replace(",", " ")
    amount_raw = f"{amount:,.0f}".replace(",", "")
    signature = _get_sms_signature()
    sent = False

    if student.father_phone and student.father_full_name:
        message = f"Hurmatli {student_name} hisobingizga {amount_raw} so'm to'lov qabul qilindi, {signature}"
        ok = _send_single_sms(message, student.father_phone, student_name, user_id, token, f"To'lov - {student_name} (ota)", PAYMENT_TEMPLATE_ID)
        if ok:
            sent = True
        _save_sms_history("payment", student.father_full_name, student.father_phone, student_name, message, "yuborildi" if ok else "xatolik")

    if student.mother_phone and student.mother_full_name:
        message = f"Hurmatli {student_name} hisobingizga {amount_raw} so'm to'lov qabul qilindi, {signature}"
        ok = _send_single_sms(message, student.mother_phone, student_name, user_id, token, f"To'lov - {student_name} (ona)", PAYMENT_TEMPLATE_ID)
        if ok:
            sent = True
        _save_sms_history("payment", student.mother_full_name, student.mother_phone, student_name, message, "yuborildi" if ok else "xatolik")

    if not sent:
        logger.warning(f"{student} uchun ota-ona nomeri yoki ismi topilmadi, to'lov SMS yuborilmadi")

    return sent


def send_debt_reminder_sms(student):
    _, _, user_id = _get_credentials()
    if not user_id:
        logger.error("TEXTUP_USER_ID topilmadi")
        return False

    token = _get_token()
    if not token:
        logger.error("TextUP token olinmadi, SMS yuborib bo'lmadi")
        return False

    student_name = f"{student.first_name} {student.last_name}"
    signature = _get_sms_signature()
    sent = False

    if student.father_phone and student.father_full_name:
        message = f"Hurmatli {student_name} joriy oy to'lovi qilinishi kerak. Darsga kelishda to'lov esingizdan chiqmasin. {signature}"
        if _send_single_sms(message, student.father_phone, student_name, user_id, token, f"Qarz - {student_name} (ota)", DEBT_TEMPLATE_ID):
            sent = True

    if student.mother_phone and student.mother_full_name:
        message = f"Hurmatli {student_name} joriy oy to'lovi qilinishi kerak. Darsga kelishda to'lov esingizdan chiqmasin. {signature}"
        if _send_single_sms(message, student.mother_phone, student_name, user_id, token, f"Qarz - {student_name} (ona)", DEBT_TEMPLATE_ID):
            sent = True

    if not sent:
        logger.warning(f"{student} uchun ota-ona nomeri yoki ismi topilmadi, qarz SMS yuborilmadi")

    return sent


def send_bulk_debt_reminders(user=None):
    from .models import Student, StudentBalance, SmsHistory
    from decimal import Decimal

    debtors = Student.objects.filter(
        is_active=True, is_deleted=False,
        balance__balance__lt=Decimal('0.00')
    ).select_related('balance')

    sent_count = 0
    failed_count = 0
    skipped_count = 0

    _, _, user_id = _get_credentials()
    token = _get_token()

    for student in debtors:
        student_name = f"{student.first_name} {student.last_name}"
        signature = _get_sms_signature()
        message = f"Hurmatli {student_name} joriy oy to'lovi qilinishi kerak. Darsga kelishda to'lov esingizdan chiqmasin. {signature}"

        has_father = student.father_phone and student.father_full_name
        has_mother = student.mother_phone and student.mother_full_name

        if not has_father and not has_mother:
            skipped_count += 1
            SmsHistory.objects.create(
                sms_type="debt",
                recipient_name="-",
                recipient_phone="-",
                student_name=student_name,
                message="Telefon raqami mavjud emas",
                status="otkazildi",
                sent_by=user,
            )
            continue

        if has_father:
            ok = False
            try:
                if user_id and token:
                    ok = _send_single_sms(message, student.father_phone, student_name, user_id, token, f"Qarz - {student_name} (ota)", DEBT_TEMPLATE_ID)
            except Exception as e:
                logger.error(f"SMS xatolik (ota {student.father_full_name}): {e}")
                ok = False
            SmsHistory.objects.create(
                sms_type="debt",
                recipient_name=student.father_full_name,
                recipient_phone=student.father_phone,
                student_name=student_name,
                message=message,
                status="yuborildi" if ok else "xatolik",
                sent_by=user,
            )
            if ok:
                sent_count += 1
            else:
                failed_count += 1

        if has_mother:
            ok = False
            try:
                if user_id and token:
                    ok = _send_single_sms(message, student.mother_phone, student_name, user_id, token, f"Qarz - {student_name} (ona)", DEBT_TEMPLATE_ID)
            except Exception as e:
                logger.error(f"SMS xatolik (ona {student.mother_full_name}): {e}")
                ok = False
            SmsHistory.objects.create(
                sms_type="debt",
                recipient_name=student.mother_full_name,
                recipient_phone=student.mother_phone,
                student_name=student_name,
                message=message,
                status="yuborildi" if ok else "xatolik",
                sent_by=user,
            )
            if ok:
                sent_count += 1
            else:
                failed_count += 1

    return {
        "total_debtors": debtors.count(),
        "sent": sent_count,
        "failed": failed_count,
        "skipped": skipped_count,
    }
