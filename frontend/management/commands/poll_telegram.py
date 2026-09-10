import re
import time
import requests
from django.core.management.base import BaseCommand
from frontend.student_api import (
    BOT_TOKEN, REMINDER_BOT_TOKEN, send_telegram_message, send_telegram_keyboard,
    find_employee_by_phone, find_student_by_phone,
)


class Command(BaseCommand):
    help = "Telegram bot(dan) xabarlarni qabul qilish (student bot + eslatma bot)"

    def handle(self, *args, **options):
        bots = []
        if BOT_TOKEN:
            bots.append({"name": "Student bot", "token": BOT_TOKEN, "eslatma": False})
        if REMINDER_BOT_TOKEN and REMINDER_BOT_TOKEN != BOT_TOKEN:
            bots.append({"name": "Eslatma bot", "token": REMINDER_BOT_TOKEN, "eslatma": True})

        if not bots:
            self.stderr.write(self.style.ERROR(
                "BOT_TOKEN topilmadi! .env faylida BOT_TOKEN ni kiriting.\n"
                "Masalan: BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
            ))
            return

        for bot in bots:
            self.stdout.write((bot["name"] + ": webhook ochirilmoqda...\n"))
            self.stdout.flush()
            try:
                r = requests.get(f"https://api.telegram.org/bot{bot['token']}/deleteWebhook", timeout=5)
                self.stdout.write("Webhook: " + str(r.json().get("description", "ok")) + "\n")
            except Exception as e:
                self.stdout.write("Webhook xatolik: " + str(e) + "\n")
            self.stdout.flush()
            bot["last_id"] = 0

        fail_count = 0
        self.stdout.write("Poll ishga tushdi. Xabarlar kutilmoqda...\n")
        self.stdout.flush()

        while True:
            try:
                got = 0
                for bot in bots:
                    params = {"timeout": 5}
                    if bot["last_id"]:
                        params["offset"] = bot["last_id"] + 1
                    r = requests.get(
                        f"https://api.telegram.org/bot{bot['token']}/getUpdates",
                        params=params, timeout=10
                    )
                    data = r.json()
                    if not data.get("ok"):
                        continue
                    updates = data.get("result", [])
                    if updates:
                        self.stdout.write(bot["name"] + ": " + str(len(updates)) + " ta xabar\n")
                        self.stdout.flush()
                        got += len(updates)
                    for upd in updates:
                        bot["last_id"] = upd["update_id"]
                        self._process(upd, bot, self.stdout)
                # Muddati o'tgan topshiriqlarni avtomatik belgilash va eslatma
                try:
                    from frontend.views import mark_overdue_tasks_and_notify
                    mark_overdue_tasks_and_notify()
                except Exception:
                    pass
                if not got:
                    fail_count = 0
                time.sleep(2)
            except Exception as e:
                fail_count += 1
                backoff = min(30, 5 * fail_count)
                self.stdout.write("Xatolik (" + str(fail_count) + "): " + str(e) + "\n")
                self.stdout.write("Qayta urinish " + str(backoff) + " soniyadan keyin...\n")
                self.stdout.flush()
                time.sleep(backoff)

    def _process(self, upd, bot, stdout):
        # Eslatma boti: menyu, callback va bog'lanish umumiy handler orqali (webhook bilan bir xil)
        if bot["eslatma"]:
            from frontend.student_api import process_eslatma_update
            process_eslatma_update(upd)
            src = upd.get("message", {})
            if not src:
                src = ((upd.get("callback_query") or {}).get("message") or {})
            chat_id = str(src.get("chat", {}).get("id", ""))
            stdout.write("  Eslatma bot qayta ishlandi" + (" chat=" + chat_id if chat_id else "") + "\n")
            stdout.flush()
            return

        msg = upd.get("message", {})
        chat_id = str(msg.get("chat", {}).get("id", ""))
        text = (msg.get("text") or "").strip()
        contact = msg.get("contact")

        if not chat_id:
            return

        stdout.write("  Xabar: chat=" + chat_id + " text=" + text[:50] + "\n")
        stdout.flush()

        phone = ""
        if contact:
            phone = contact.get("phone_number", "")
            stdout.write("  Kontakt: " + phone + "\n")
            stdout.flush()
        elif text:
            if text.startswith("/start"):
                parts = text.split(maxsplit=1)
                phone = parts[1].strip() if len(parts) > 1 else ""
            else:
                phone = text

        token = bot["token"]

        if not phone and text and text.startswith("/start"):
            msg_text = (
                "👋 Assalomu alaykum! IT House Superapp botiga xush kelibsiz.\n\n"
                "Iltimos, telefon raqamingizni yuboring yoki quyidagi tugmani bosing:"
            )
            ask_keyboard = {
                "keyboard": [[{"text": "📱 Telefon raqamni yuborish", "request_contact": True}]],
                "resize_keyboard": True,
                "one_time_keyboard": True
            }
            send_telegram_keyboard(chat_id, msg_text, ask_keyboard, token=token)
            stdout.write("  /start ga javob yuborildi\n")
            stdout.flush()
            return

        if phone:
            # student (asosiy) bot: o'quvchi + xodim
            student = find_student_by_phone(phone)
            employee = find_employee_by_phone(phone)
            if student:
                student.telegram_chat_id = chat_id
                student.save(update_fields=["telegram_chat_id"])
                stdout.write("  Telefon tasdiqlandi: " + student.phone + "\n")
                stdout.flush()
            if employee:
                employee.telegram_chat_id = chat_id
                employee.save(update_fields=["telegram_chat_id"])
                stdout.write("  Xodim telefoni tasdiqlandi: " + employee.phone + "\n")
                stdout.flush()
            if student or employee:
                display_phone = (student.phone if student else employee.phone)
                remove_keyboard = {"remove_keyboard": True}
                send_telegram_keyboard(
                    chat_id,
                    "✅ Telefon raqamingiz tasdiqlandi! Sizga yuborilgan topshiriqlar endi telegramda ham ko'rinadi.\n\n"
                    "Eslatmalar va topshiriqlar alohida bot orqali keladi: @ithouseeslatma_bot\n"
                    "Unga ham raqamingizni yuboring.\n\n"
                    "Telefon: " + display_phone,
                    remove_keyboard, token=token,
                )
            else:
                send_telegram_message(chat_id, "❌ Bu raqam tizimda topilmadi. Avval ro'yxatdan o'ting.", token=token)
                stdout.write("  Telefon topilmadi: " + phone + "\n")
                stdout.flush()