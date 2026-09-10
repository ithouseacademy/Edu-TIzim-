"""Web Push (sayt yopiq bo'lsa ham notification yetkazish) uchun yordamchi modul.

VAPID juftligi shu yerda saqlanadi. Xavfsizlik uchun uni settings/orqali
o'zgartirish mumkin (PUSH_VAPID_PUBLIC_KEY / PUSH_VAPID_PRIVATE_KEY).
"""

import json

import pywebpush

VAPID_PUBLIC_KEY = "BGn5tQe8oevfogWpYLFLm73Mgb07n8vmAs5yn3dhxGiuLjODMYqUaBsuqoFOsCHcgvae4mThRv6JJeSjn2cSr78"

VAPID_PRIVATE_KEY = """-----BEGIN PRIVATE KEY-----
MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgg9Fh5+VKoIqEP4jB
4dZZsqi/ghf+k5VPCS4vWgpbyrihRANCAARp+bUHvKHr36IFqWCxS5u9zIG9O5/L
5gLOcp93YcRori4zgzGKlGgbLqqBTrAh3IL2nuJk4Ub+iSXko59nEq+/
-----END PRIVATE KEY-----"""

VAPID_CLAIMS = {"sub": "mailto:admin@it-house-academy.edu"}

# Bildirishnoma bosilganda ochiladigan sahifa (frontend ichidagi marshrut)
PUSH_APP_PATH = "/#tasks"


def send_web_push(subscription, title, body, url=PUSH_APP_PATH):
    """Bitta obunaga push bildirishnoma yuboradi.

    Obuna eskirgan/uzilgan bo'lsa (404/410) uni o'chirib tashlaydi.
    """
    if not subscription or not subscription.endpoint:
        return False
    info = {
        "endpoint": subscription.endpoint,
        "keys": {"p256dh": subscription.p256dh, "auth": subscription.auth},
    }
    try:
        pywebpush.webpush(
            subscription_info=info,
            data=json.dumps({"title": title, "body": body, "url": url}),
            vapid_private_key=VAPID_PRIVATE_KEY,
            vapid_claims=VAPID_CLAIMS,
            timeout=10,
        )
        return True
    except pywebpush.WebPushException as exc:
        resp = getattr(exc, "response", None)
        if resp is not None and resp.status_code in (404, 410):
            try:
                subscription.delete()
            except Exception:
                pass
        return False
    except Exception:
        return False


def send_employee_web_push(employee, title, body, url=PUSH_APP_PATH):
    """Xodimning barcha pulli (bog'langan) qurilmalariga push yuboradi."""
    user = getattr(employee, "user", None)
    if not user:
        return False
    sent = False
    for sub in list(user.push_subscriptions.all()):
        if send_web_push(sub, title, body, url):
            sent = True
    return sent