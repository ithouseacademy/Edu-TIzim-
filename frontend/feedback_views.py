"""Taklif va shikoyatlar (Feedback) admin bo'limi.

O'quvchilar mobil ilovadagi «Profil → Takliflar» orqali taklif / shikoyat
yuboradilar. Bu bo'limda:
- Super admin (is_superuser) hamma xabarni ko'ra oladi.
- 'feedback.view' huquqi berilgan adminlar xabarlarni ko'radi.
- 'feedback.respond' huquqi berilgan adminlar javob yozishi / o'chirishi mumkin.
- Yangi (yangi) xabarlar admin paneli yon panelidagi badge'da ko'rinadi.
"""

from django.contrib.auth.decorators import login_required
from django.db.models import Q
from django.http import JsonResponse
from django.shortcuts import render, redirect, get_object_or_404
from django.utils import timezone

from .models import Feedback
from .permissions import has_permission, is_super_admin


def _can_view(user):
    return is_super_admin(user) or has_permission(user, "feedback.view")


def _can_respond(user):
    return is_super_admin(user) or has_permission(user, "feedback.respond")


@login_required(login_url="login")
def feedback_list(request):
    if not _can_view(request.user):
        return redirect("dashboard")

    status_filter = request.GET.get("status", "")
    category_filter = request.GET.get("category", "")
    q = request.GET.get("q", "").strip()

    items = Feedback.objects.select_related("student").order_by("-created_at")
    if status_filter in {s for s, _ in Feedback.Status.choices}:
        items = items.filter(status=status_filter)
    if category_filter in {c for c, _ in Feedback.Category.choices}:
        items = items.filter(category=category_filter)
    if q:
        items = items.filter(
            Q(message__icontains=q) |
            Q(student__first_name__icontains=q) |
            Q(student__last_name__icontains=q)
        )

    new_count = Feedback.objects.filter(status=Feedback.Status.NEW).count()

    return render(request, "feedback/list.html", {
        "feedbacks": items[:200],
        "can_respond": _can_respond(request.user),
        "status_filter": status_filter,
        "category_filter": category_filter,
        "q": q,
        "status_choices": Feedback.Status.choices,
        "category_choices": Feedback.Category.choices,
        "new_count": new_count,
    })


@login_required(login_url="login")
def feedback_detail(request, pk):
    if not _can_view(request.user):
        return redirect("dashboard")

    feedback = get_object_or_404(Feedback.objects.select_related("student"), pk=pk)

    if feedback.status == Feedback.Status.NEW:
        feedback.status = Feedback.Status.READ
        feedback.save(update_fields=["status"])

    error = None
    if request.method == "POST":
        if not _can_respond(request.user):
            return redirect("feedback_list")
        response_text = request.POST.get("response", "").strip()
        if not response_text:
            error = "Javob matni bo'sh bo'lishi mumkin emas."
        else:
            feedback.admin_response = response_text
            feedback.status = Feedback.Status.ANSWERED
            feedback.responded_by = request.user
            feedback.responded_at = timezone.now()
            feedback.save(update_fields=["admin_response", "status", "responded_by", "responded_at"])
            return redirect("feedback_detail", pk=feedback.pk)

    return render(request, "feedback/detail.html", {
        "feedback": feedback,
        "can_respond": _can_respond(request.user),
        "error": error,
    })


@login_required(login_url="login")
def feedback_delete(request, pk):
    if request.method != "POST":
        return JsonResponse({"ok": False, "error": "Method not allowed"}, status=405)
    if not _can_respond(request.user):
        return JsonResponse({"ok": False, "error": "Ruxsat yo'q"}, status=403)
    feedback = get_object_or_404(Feedback, pk=pk)
    feedback.delete()
    return JsonResponse({"ok": True})


@login_required(login_url="login")
def feedback_badge(request):
    if not _can_view(request.user):
        return JsonResponse({"count": 0})
    count = Feedback.objects.filter(status=Feedback.Status.NEW).count()
    return JsonResponse({"count": count})