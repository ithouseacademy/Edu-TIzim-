from django.db import migrations


def seed_payment_methods(apps, schema_editor):
    PaymentMethod = apps.get_model("frontend", "PaymentMethod")
    defaults = [
        {"name": "Naqd", "icon": "fas fa-money-bill-wave", "color": "#059669", "order": 0, "is_active": True},
        {"name": "Karta", "icon": "fas fa-credit-card", "color": "#2563eb", "order": 1, "is_active": True},
    ]
    for d in defaults:
        PaymentMethod.objects.get_or_create(name=d["name"], defaults=d)


def reverse_seed(apps, schema_editor):
    PaymentMethod = apps.get_model("frontend", "PaymentMethod")
    PaymentMethod.objects.filter(name__in=["Naqd", "Karta"]).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("frontend", "0038_add_paymentmethod"),
    ]

    operations = [
        migrations.RunPython(seed_payment_methods, reverse_seed),
    ]
