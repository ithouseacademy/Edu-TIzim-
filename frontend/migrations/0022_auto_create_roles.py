from django.db import migrations


DEFAULT_ROLES = [
    ("Administrator", "superadmin"),
    ("O'qituvchi", "teacher"),
    ("Support Teacher", "support_teacher"),
]


def create_default_roles(apps, schema_editor):
    Role = apps.get_model("frontend", "Role")
    for name, level in DEFAULT_ROLES:
        Role.objects.get_or_create(name=name, defaults={"level": level})


def remove_default_roles(apps, schema_editor):
    Role = apps.get_model("frontend", "Role")
    Role.objects.filter(name__in=[r[0] for r in DEFAULT_ROLES]).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("frontend", "0021_alter_verificationcode_code"),
    ]

    operations = [
        migrations.RunPython(create_default_roles, remove_default_roles),
    ]
