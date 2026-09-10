import os
import requests
from django.core.management.base import BaseCommand
from django.conf import settings


class Command(BaseCommand):
    help = "Telegram bot(dan) webhookini sozlash (student bot + eslatma bot)"

    def handle(self, *args, **options):
        base = os.getenv(
            "WEBHOOK_BASE_URL", "https://edutizim.ithouse.academy"
        ).rstrip("/")

        bots = []
        if settings.BOT_TOKEN:
            bots.append({
                "name": "Student bot",
                "token": settings.BOT_TOKEN,
                "url": base + "/api/telegram-webhook/",
            })
        if settings.REMINDER_BOT_TOKEN and settings.REMINDER_BOT_TOKEN != settings.BOT_TOKEN:
            bots.append({
                "name": "Eslatma bot",
                "token": settings.REMINDER_BOT_TOKEN,
                "url": base + "/api/telegram-webhook/eslatma/",
            })

        if not bots:
            self.stdout.write(self.style.ERROR("BOT_TOKEN topilmadi!"))
            return

        for bot in bots:
            self.stdout.write(f"{bot['name']} webhook sozlanmoqda: {bot['url']}\n")
            try:
                r = requests.post(
                    f"https://api.telegram.org/bot{bot['token']}/setWebhook",
                    json={"url": bot["url"]},
                    timeout=10,
                )
                data = r.json()
                self.stdout.write(str(data) + "\n")
                if data.get("ok"):
                    self.stdout.write(self.style.SUCCESS(bot["name"] + " webhook muvaffaqiyatli o'rnatildi!"))
                else:
                    self.stdout.write(self.style.ERROR(bot["name"] + " webhook xatolik: " + str(data)))
            except Exception as e:
                self.stdout.write(self.style.ERROR(bot["name"] + " xatolik: " + str(e)))