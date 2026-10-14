from django.db import migrations


def sync_coin_permissions(apps, schema_editor):
    """Coin/Shop huquqlarini Permission jadvaliga sinxronlaydi.

    frontend.permissions.PERMISSION_REGISTRY yagona manba bo'lib, bu yerda yangi
    coin/shop huquqlari bazadagi Permission yozuvlariga aylantiramiz.
    """
    try:
        from frontend.permissions import sync_permissions
        sync_permissions()
    except Exception:
        # Migratsiya mustaqil ishlashi uchun xatoni e'tiborsiz qoldirish.
        pass


class Migration(migrations.Migration):

    dependencies = [
        ("coins", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(sync_coin_permissions, migrations.RunPython.noop),
    ]