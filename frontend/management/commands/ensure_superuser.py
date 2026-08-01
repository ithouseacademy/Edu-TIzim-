import os
from django.core.management.base import BaseCommand
from django.contrib.auth.models import User


class Command(BaseCommand):
    help = 'Create superuser from environment variables'

    def handle(self, *args, **options):
        phone = os.getenv('SUPERUSER_PHONE')
        password = os.getenv('SUPERUSER_PASSWORD')

        if not phone or not password:
            self.stdout.write('SUPERUSER_PHONE or SUPERUSER_PASSWORD not set, skipping')
            return

        if not User.objects.filter(username=phone).exists():
            User.objects.create_superuser(username=phone, password=password)
            self.stdout.write(f'Superuser created: {phone}')
        else:
            self.stdout.write(f'Superuser already exists: {phone}')
