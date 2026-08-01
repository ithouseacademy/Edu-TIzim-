from django.db import migrations, transaction


def add_support_teacher(apps, schema_editor):
    Role = apps.get_model("frontend", "Role")
    Role.objects.get_or_create(name="Support Teacher", defaults={"level": "support_teacher"})


def remove_support_teacher(apps, schema_editor):
    Role = apps.get_model("frontend", "Role")
    Role.objects.filter(name="Support Teacher").delete()


class Migration(migrations.Migration):

    dependencies = [
        ("frontend", "0022_auto_create_roles"),
    ]

    operations = [
        migrations.RunPython(add_support_teacher, remove_support_teacher),
    ]
