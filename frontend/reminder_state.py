"""Eslatmalarning o'qilgan holati bilan ishlash uchun yagona joy.

- «Hammaga» (send_to_all / employee=None) eslatmalar HAR BIR foydalanuvchi
  uchun alohida hisoblanadi (ReminderRead). Biri o'qisa — boshqasi uchun
  o'qilgan bo'lib qolmaydi.
- Kimlik sifatida `user` ishlatiladi — employee_profile'siz admin/manager ham
  o'qiy oladi. Legacy/bot holatlarida `employee` ham saqlanadi.
- Shaxsiy eslatmalar (employee belgilangan) uchun Reminder.is_read ishlatiladi.
"""
from django.utils import timezone

from .models import Reminder, ReminderRead


def _identity_qs(qs, user, emp):
    """ReminderRead queryset'ni joriy foydalanuvchi kimligicha filtrlaydi."""
    if user is not None:
        return qs.filter(user=user)
    if emp is not None:
        return qs.filter(employee=emp)
    return qs.none()


def general_read_ids_for(user=None, emp=None):
    qs = ReminderRead.objects.filter(is_read=True)
    return set(_identity_qs(qs, user, emp).values_list("reminder_id", flat=True))


def own_unread_count_for(emp):
    if not emp:
        return 0
    return Reminder.objects.filter(employee=emp, is_active=True, is_read=False).count()


def general_unread_count_for(user=None, emp=None):
    read_ids = general_read_ids_for(user, emp)
    return Reminder.objects.filter(employee__isnull=True, is_active=True).exclude(pk__in=read_ids).count()


def unread_count_for(user=None, emp=None):
    return own_unread_count_for(emp) + general_unread_count_for(user, emp)


def reader_count(reminder):
    """General eslatmani necha nafar foydalanuvchi o'qiganini qaytaradi."""
    return ReminderRead.objects.filter(reminder=reminder, is_read=True).count()


def is_read_for(user, emp, reminder):
    """Joriy ko'ruvchi nuqtayi nazaridan eslatma o'qilganmi?"""
    if reminder.employee_id is None:
        qs = ReminderRead.objects.filter(reminder=reminder, is_read=True)
        return _identity_qs(qs, user, emp).exists()
    return reminder.is_read


def mark_read_for(user, emp, reminder, admin=False):
    """Eslatmani joriy foydalanuvchi uchun «O'qilgan» qiladi (per-user).

    Admin (hatto employee_profile'siz ham) «hammaga» eslatmani o'zi uchun
    o'qilgan qila oladi; shaxsiy eslatmani esa egasi yoki admin belgilay oladi.
    """
    if not user and not emp:
        return False
    if reminder.employee_id is None:
        kwargs = {"reminder": reminder}
        if user is not None:
            kwargs["user"] = user
            kwargs["employee"] = emp
        else:
            kwargs["employee"] = emp
        ReminderRead.objects.update_or_create(
            **kwargs,
            defaults={"is_read": True, "read_at": timezone.now(), "employee": emp, "user": user},
        )
    else:
        if admin or (emp and reminder.employee_id == emp.id):
            Reminder.objects.filter(pk=reminder.pk).update(is_read=True, read_at=timezone.now())
    return True