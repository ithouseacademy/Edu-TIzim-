from django.core.management.base import BaseCommand
from frontend.permissions import sync_permissions


class Command(BaseCommand):
    help = 'Sync permission registry into the Permission model'

    def handle(self, *args, **options):
        created = sync_permissions()
        self.stdout.write(self.style.SUCCESS(f'Permissions synced. Created/updated: {created}'))
