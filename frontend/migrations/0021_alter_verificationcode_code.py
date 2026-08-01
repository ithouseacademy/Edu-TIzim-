from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('frontend', '0020_student_telegram_chat_id'),
    ]

    operations = [
        migrations.AlterField(
            model_name='verificationcode',
            name='code',
            field=models.CharField(max_length=128, verbose_name='Tasdiqlash kodi'),
        ),
    ]
