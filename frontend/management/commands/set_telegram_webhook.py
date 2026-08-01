import os
import requests
from django.core.management.base import BaseCommand
from django.conf import settings


class Command(BaseCommand):
    help = "Telegram bot webhookini sozlash"

    def handle(self, *args, **options):
        token = settings.BOT_TOKEN
        if not token:
            self.stdout.write(self.style.ERROR("BOT_TOKEN topilmadi!"))
            return

        url = "https://it-house-academt-edu-tizim-production.up.railway.app/api/telegram-webhook/"
        self.stdout.write(f"Webhook sozlanmoqda: {url}\n")
        try:
            r = requests.post(
                f"https://api.telegram.org/bot{token}/setWebhook",
                json={"url": url},
                timeout=10,
            )
            data = r.json()
            self.stdout.write(str(data) + "\n")
            if data.get("ok"):
                self.stdout.write(self.style.SUCCESS("Webhook muvaffaqiyatli o'rnatildi!"))
            else:
                self.stdout.write(self.style.ERROR("Webhook xatolik: " + str(data)))
        except Exception as e:
            self.stdout.write(self.style.ERROR("Xatolik: " + str(e)))
