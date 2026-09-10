from django import template
from decimal import Decimal

register = template.Library()

@register.filter
def get_item(dictionary, key):
    if dictionary is None:
        return None
    return dictionary.get(key)

@register.filter
def get_key(dictionary, key):
    """Return value or empty dict for chained lookups"""
    if dictionary is None:
        return {}
    return dictionary.get(key, {})

@register.filter
def has_key(dictionary, key):
    if dictionary is None:
        return False
    return key in dictionary

@register.filter
def spacesep(value):
    """Add space as thousand separator: 10000000 -> 10 000 000"""
    try:
        from decimal import Decimal
        v = int(Decimal(str(value)))
        return f"{v:,}".replace(",", " ")
    except (ValueError, TypeError):
        return value

@register.filter
def get_balance(student):
    try:
        return student.balance
    except:
        from ..models import StudentBalance
        balance, _ = StudentBalance.objects.get_or_create(student=student, defaults={"balance": Decimal('0.00')})
        return balance

@register.filter
def receipt_desc(value):
    """Ichki kodlarni (pt:full|pm:2026-08|df:2026-07:sabab) o'qishga qulay matnga aylantiradi"""
    if not value:
        return ""
    s = str(value)
    if "pt:" not in s and "pm:" not in s and "df:" not in s:
        return s
    months, deferred = [], []
    for token in s.split("|"):
        token = token.strip()
        if not token or token.startswith("pt:"):
            continue
        if token.startswith("pm:"):
            months.extend([m.strip() for m in token[3:].split(",") if m.strip()])
        elif token.startswith("df:"):
            rest = token[3:].strip()
            if ":" in rest:
                m, sabab = rest.split(":", 1)
                deferred.append(f"{m} ({sabab})" if sabab else m)
            else:
                deferred.append(rest)
    out = []
    if months:
        out.append("To'langan oy(lar): " + ", ".join(months))
    if deferred:
        out.append("Kechirilgan oy(lar): " + ", ".join(deferred))
    return "; ".join(out)
