import re
import requests
from django.core.management.base import BaseCommand
from django.db.models import Q
from frontend.student_api import BOT_TOKEN, send_telegram_message, send_telegram_keyboard
from frontend.models import Student


class Command(BaseCommand):
    help = "Telegram botdan kelgan xabarlarni qabul qilish"

    def handle(self, *args, **options):
        if not BOT_TOKEN:
            self.stderr.write(self.style.ERROR(
                "BOT_TOKEN topilmadi! .env faylida BOT_TOKEN ni kiriting.\n"
                "Masalan: BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
            ))
            return

        self.stdout.write("Webhook ochirilmoqda...\n")
        self.stdout.flush()
        try:
            r = requests.get(f"https://api.telegram.org/bot{BOT_TOKEN}/deleteWebhook", timeout=5)
            self.stdout.write("Webhook: " + str(r.json().get("description", "ok")) + "\n")
        except Exception as e:
            self.stdout.write("Webhook xatolik: " + str(e) + "\n")
        self.stdout.flush()

        last_id = 0
        self.stdout.write("Poll ishga tushdi. Xabarlar kutilmoqda...\n")
        self.stdout.flush()

        while True:
            try:
                params = {"timeout": 5}
                if last_id:
                    params["offset"] = last_id + 1
                r = requests.get(
                    f"https://api.telegram.org/bot{BOT_TOKEN}/getUpdates",
                    params=params, timeout=10
                )
                data = r.json()
                if not data.get("ok"):
                    self.stdout.write("API xatolik: " + str(data) + "\n")
                    self.stdout.flush()
                    continue

                updates = data.get("result", [])
                if updates:
                    self.stdout.write(str(len(updates)) + " ta xabar olindi\n")
                    self.stdout.flush()

                for upd in updates:
                    last_id = upd["update_id"]
                    msg = upd.get("message", {})
                    chat_id = str(msg.get("chat", {}).get("id", ""))
                    text = (msg.get("text") or "").strip()
                    contact = msg.get("contact")

                    if not chat_id:
                        continue

                    self.stdout.write("  Xabar: chat=" + chat_id + " text=" + text[:50] + "\n")
                    self.stdout.flush()

                    phone = ""
                    if contact:
                        phone = contact.get("phone_number", "")
                        self.stdout.write("  Kontakt: " + phone + "\n")
                        self.stdout.flush()
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
                        self.stdout.write("  /start ga javob yuborildi\n")
                        self.stdout.flush()
                        continue

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
                                "✅ Telefon raqamingiz tasdiqlandi! Endi ilovadan tasdiqlash kodi olishingiz mumkin.\n\n"
                                "Telefon: " + student.phone,
                                remove_keyboard
                            )
                            self.stdout.write("  Telefon tasdiqlandi: " + student.phone + "\n")
                            self.stdout.flush()
                        else:
                            send_telegram_message(chat_id,
                                "❌ Bu raqam tizimda topilmadi. Avval ro'yxatdan o'ting."
                            )
                            self.stdout.write("  Telefon topilmadi: " + phone + "\n")
                            self.stdout.flush()

            except Exception as e:
                self.stdout.write("Xatolik: " + str(e) + "\n")
                self.stdout.flush()
