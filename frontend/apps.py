import os
import sys
import threading
from django.apps import AppConfig


class FrontendConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'frontend'

    def ready(self):
        in_child = os.environ.get('RUN_MAIN') == 'true'
        if 'runserver' in sys.argv and in_child:
            thread = threading.Thread(target=self._start_poll, daemon=True)
            thread.start()

    def _start_poll(self):
        import time
        time.sleep(1)
        from frontend.management.commands.poll_telegram import Command
        cmd = Command()
        cmd.stdout = sys.stdout
        cmd.stderr = sys.stderr
        cmd.handle()
