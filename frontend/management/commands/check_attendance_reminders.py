from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Davomat eslatmalarini yuboradi (EslatmaReminderSetting yoqilgan bo'lsa)"

    def handle(self, *args, **options):
        from frontend.views import check_attendance_reminders
        sent = check_attendance_reminders()
        msg = f"Davomat eslatmasi: {sent} ta yuborildi" if sent else "Davomat eslatmasi: yuboriladigan guruh yo'q"
        self.stdout.write(self.style.SUCCESS(msg))