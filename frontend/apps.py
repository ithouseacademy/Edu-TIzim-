import os
import sys
import threading
from django.apps import AppConfig
from django.db.models.signals import post_migrate


class FrontendConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'frontend'

    def ready(self):
        # Keep the registry in sync with the DB whenever migrations/startup run.
        post_migrate.connect(self._sync_permissions, sender=self)

        in_child = os.environ.get('RUN_MAIN') == 'true'
        if 'runserver' in sys.argv and in_child:
            # runserver: telegram poll va davomat eslatma tekshiruvi alohida thread'da ishlaydi.
            threading.Thread(target=self._start_poll, daemon=True).start()
            threading.Thread(target=self._start_reminder_scheduler, daemon=True).start()
        elif 'gunicorn' in sys.argv:
            # Production (Railway): davomat eslatmasi tekshiruvi har 45 soniyada
            # (webhook/poll o'rniga, delay aniq ushlanishi uchun).
            threading.Thread(target=self._start_reminder_scheduler, daemon=True).start()

    def _sync_permissions(self, **kwargs):
        try:
            from frontend.permissions import sync_permissions
            sync_permissions()
        except Exception:
            # Tables may not exist yet (e.g., before first migrate). Safe to ignore.
            pass

    def _start_poll(self):
        import time
        time.sleep(1)
        from frontend.management.commands.poll_telegram import Command
        cmd = Command()
        cmd.stdout = sys.stdout
        cmd.stderr = sys.stderr
        cmd.handle()

    def _start_reminder_scheduler(self):
        import time
        time.sleep(3)
        while True:
            try:
                from django.db import close_old_connections
                from frontend.views import check_attendance_reminders
                check_attendance_reminders()
                close_old_connections()
            except Exception:
                try:
                    from django.db import close_old_connections
                    close_old_connections()
                except Exception:
                    pass
            # 45 soniya: dars start + delay vaqtiga (masalan 10 daqiqa) yaqin
            # yuborish uchun yetarli darajada tez-tez tekshiradi.
            time.sleep(45)
