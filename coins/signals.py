"""Davomat o'zgarishlarida avtomatik coin yaratish.

Signal orqali Attendance saqlanganda coin tizimi sinhronlanadi:
  - yangi davomat -> coin beriladi/olinadi
  - davomat o'zgarsa -> oldingisi REVERSAL, yangisi avtomatik
Idempotent: holat o'zgarmagan bo'lsa hech narsa qilinmaydi.
"""

from django.db.models.signals import pre_save, post_save
from django.dispatch import receiver

from frontend.models import Attendance


@receiver(pre_save, sender=Attendance)
def _attendance_pre_save(sender, instance, **kwargs):
    try:
        if instance.pk:
            old = Attendance.objects.filter(pk=instance.pk).values_list("status", flat=True).first()
            instance._coin_old_status = old
        else:
            instance._coin_old_status = None
    except Exception:
        instance._coin_old_status = None


@receiver(post_save, sender=Attendance)
def _attendance_post_save(sender, instance, **kwargs):
    from .services import process_attendance_coin
    old_status = getattr(instance, "_coin_old_status", None)
    process_attendance_coin(instance, old_status=old_status)