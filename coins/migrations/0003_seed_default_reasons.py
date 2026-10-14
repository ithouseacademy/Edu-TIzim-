from django.db import migrations


DEFAULT_REASONS = [
    ("Faol qatnashish", "BONUS", 5),
    ("Uy vazifasini bajardi", "BONUS", 5),
    ("To'g'ri javob", "BONUS", 3),
    ("Intizom va tartib", "BONUS", 5),
    ("Musobaqa g'olibi", "BONUS", 10),
    ("Uy vazifasini bajarmadi", "PENALTY", -5),
    ("Darsga kechikdi", "PENALTY", -3),
    ("Intizom buzilishi", "PENALTY", -10),
    ("Darsga tayyorgarlik yo'q", "PENALTY", -5),
]


def seed_default_reasons(apps, schema_editor):
    CoinReason = apps.get_model("coins", "CoinReason")
    for name, reason_type, amount in DEFAULT_REASONS:
        CoinReason.objects.get_or_create(
            name=name,
            reason_type=reason_type,
            defaults={"amount": amount, "is_active": True},
        )


def unseed_default_reasons(apps, schema_editor):
    CoinReason = apps.get_model("coins", "CoinReason")
    for name, reason_type, _amount in DEFAULT_REASONS:
        CoinReason.objects.filter(
            name=name, reason_type=reason_type, coin_transactions__isnull=True
        ).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("coins", "0002_sync_permissions"),
    ]

    operations = [
        migrations.RunPython(seed_default_reasons, unseed_default_reasons),
    ]
