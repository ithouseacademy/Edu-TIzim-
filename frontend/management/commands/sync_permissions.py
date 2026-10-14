"""PERMISSION_REGISTRY'dagi ruxsatlarni bazadagi `Permission` jadvaliga yozish.

Yangi ruxsat qo'shilganda (masalan `cashbox.approve`) uni DB'ga kiritadi.
"""

from django.core.management.base import BaseCommand

from frontend.permissions import sync_permissions


class Command(BaseCommand):
    help = "PERMISSION_REGISTRY ni bazadagi Permission jadvaliga sinxronlaydi"

    def handle(self, *args, **options):
        created = sync_permissions()
        from frontend.permissions import PERMISSION_REGISTRY

        self.stdout.write(
            self.style.SUCCESS(
                "Sinxronlandi: %d ta ruxsat (yangi: %d)"
                % (len(PERMISSION_REGISTRY), created)
            )
        )