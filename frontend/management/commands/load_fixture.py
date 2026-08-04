from pathlib import Path

from django.apps import apps
from django.conf import settings
from django.core.management import call_command
from django.core.management.base import BaseCommand
from django.core.management.color import no_style
from django.db import connection


class Command(BaseCommand):
    help = 'Load frontend/fixtures/initial_data.json only if the database is empty'

    def handle(self, *args, **options):
        Student = apps.get_model('frontend', 'Student')
        fixture = str(Path(settings.BASE_DIR) / 'frontend' / 'fixtures' / 'initial_data.json')

        if Student.objects.exists():
            self.stdout.write('Database already has data, skipping fixture load')
            return

        call_command('loaddata', fixture, verbosity=1)

        if connection.vendor == 'postgresql':
            reset_sql = connection.ops.sequence_reset_sql(no_style(), apps.get_models())
            with connection.cursor() as cursor:
                for sql in reset_sql:
                    cursor.execute(sql)

        self.stdout.write(self.style.SUCCESS('Initial data loaded successfully'))
