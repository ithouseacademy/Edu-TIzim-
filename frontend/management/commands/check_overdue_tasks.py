from django.core.management.base import BaseCommand
from frontend.views import mark_overdue_tasks_and_notify


class Command(BaseCommand):
    help = "Muddati o'tgan topshiriqlarni «Bajarilmadi» qilib belgilaydi va eslatma yuboradi"

    def handle(self, *args, **options):
        flipped = mark_overdue_tasks_and_notify()
        if flipped:
            self.stdout.write(self.style.SUCCESS(f"{flipped} ta topshiriq «Bajarilmadi» deb belgilandi (muddat o'tdi)"))
        else:
            self.stdout.write("Muddat o'tgan topshiriq yo'q.")