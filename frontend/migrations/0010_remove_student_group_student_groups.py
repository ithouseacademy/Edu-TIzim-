from django.db import migrations, models


def migrate_group_data(apps, schema_editor):
    Student = apps.get_model("frontend", "Student")
    for student in Student.objects.exclude(group_id__isnull=True):
        student.groups.add(student.group_id)


class Migration(migrations.Migration):

    dependencies = [
        ('frontend', '0009_room_group_teacher_group_room'),
    ]

    operations = [
        migrations.AddField(
            model_name='student',
            name='groups',
            field=models.ManyToManyField(blank=True, related_name='students', to='frontend.group', verbose_name='Guruhlar'),
        ),
        migrations.RunPython(migrate_group_data, migrations.RunPython.noop),
        migrations.RemoveField(
            model_name='student',
            name='group',
        ),
    ]
