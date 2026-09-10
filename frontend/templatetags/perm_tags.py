from django import template

register = template.Library()


@register.filter(name="perm")
def has_perm(user, codename):
    """Usage: {% if request.user|perm:'payment.create' %} ... {% endif %}"""
    from frontend.permissions import has_permission
    return has_permission(user, codename)


@register.filter(name="get_item")
def get_item(dictionary, key):
    """Usage: {{ dict|get_item:'key' }} — dict'dan kalit bo'yicha qiymat olish."""
    try:
        return dictionary.get(key)
    except AttributeError:
        return None


@register.simple_tag(takes_context=True)
def can(context, codename):
    """Usage: {% can 'payment.create' as x %}{% if x %}...{% endif %}"""
    request = context.get("request")
    user = getattr(request, "user", None)
    from frontend.permissions import has_permission
    return has_permission(user, codename)
