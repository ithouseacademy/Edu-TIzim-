import json
import re

from django.db.models import Q
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.utils import timezone as use_tz

from .models import (
    Chat, ChatMember, Message, Student, Employee, Group,
    GlobalConfig, ensure_student_username,
)

MAX_FILE_SIZE = 25 * 1024 * 1024  # 25 MB
IMAGE_TYPES = ("image/jpeg", "image/png", "image/webp", "image/gif")
VIDEO_TYPES = ("video/mp4", "video/webm", "video/quicktime", "video/x-msvideo")
AUDIO_TYPES = ("audio/webm", "audio/mp4", "audio/mpeg", "audio/ogg", "audio/wav", "audio/x-m4a", "audio/aac")

TEXT_KEYS = {
    "photo": "Rasm",
    "video": "Video",
    "voice": "Ovozli xabar",
    "file": "Fayl",
}


def _actor_from_user(user):
    """Web-panel foydalanuvchisidan izni yaratadi (context processor uchun)."""
    if not user or not getattr(user, "is_authenticated", False):
        return None
    emp = None
    try:
        emp = user.employee_profile
    except Exception:
        emp = None
    if emp:
        return {
            "kind": "employee", "student": None, "employee": emp, "user": user,
            "pk": emp.pk, "name": f"{emp.first_name} {emp.last_name}".strip() or "Xodim",
            "username": "", "phone": emp.phone or "",
        }
    return {
        "kind": "user", "student": None, "employee": None, "user": user,
        "pk": user.pk, "name": (user.first_name + " " + user.last_name).strip() or user.username or "Admin",
        "username": "", "phone": "",
    }


def _current_actor(request):
    """API chaqiruvchisini aniqlaydi: student app (Token) yoki web panel (sesiya)."""
    auth = request.META.get("HTTP_AUTHORIZATION", "")
    if auth.startswith("Token "):
        from .models import VerificationCode
        vc = VerificationCode.objects.filter(code=auth[6:], is_used=True).first()
        if not vc:
            return None
        raw = re.sub(r"\D", "", vc.phone or "")
        digits9 = raw[-9:] if len(raw) >= 9 else raw
        st = Student.objects.filter(
            Q(phone=raw) | Q(phone="+" + raw) | Q(phone="998" + digits9) | Q(phone="+998" + digits9)
        ).first()
        if not st or not st.is_active:
            return None
        ensure_student_username(st)
        return {
            "kind": "student", "student": st, "employee": None, "user": None,
            "pk": st.pk, "name": f"{st.first_name} {st.last_name}".strip() or "O'quvchi",
            "username": st.username or "", "phone": st.phone or "",
        }

    user = getattr(request, "user", None)
    if not user or not getattr(user, "is_authenticated", False):
        return None
    emp = None
    try:
        emp = user.employee_profile
    except Exception:
        emp = None
    if emp:
        return {
            "kind": "employee", "student": None, "employee": emp, "user": user,
            "pk": emp.pk, "name": f"{emp.first_name} {emp.last_name}".strip() or "Xodim",
            "username": "", "phone": emp.phone or "",
        }
    return {
        "kind": "user", "student": None, "employee": None, "user": user,
        "pk": user.pk, "name": (user.first_name + " " + user.last_name).strip() or user.username or "Admin",
        "username": "", "phone": "",
    }


def _require_actor(request):
    actor = _current_actor(request)
    if not actor:
        return None, JsonResponse({"error": "Avtorizatsiya talab qilinadi"}, status=401)
    return actor, None


@csrf_exempt
def can_access_messaging(user):
    """Web-panelda kim «Xabarlar» bo'limini ko'ra oladi:
    super admin, messaging.view huquqi borlar va o'qituvchilar."""
    from .permissions import has_permission, is_super_admin
    if not user or not getattr(user, "is_authenticated", False):
        return False
    if is_super_admin(user):
        return True
    if has_permission(user, "messaging.view"):
        return True
    emp = None
    try:
        emp = user.employee_profile
    except Exception:
        emp = None
    if not emp:
        return False
    if emp.teacher_groups.filter(is_active=True).exists():
        return True
    if emp.group_assignments.filter(group__is_active=True).exists():
        return True
    if ChatMember.objects.filter(employee=emp).exists():
        return True
    return False


def _member_q(actor):
    if actor["kind"] == "student":
        return Q(student=actor["student"])
    if actor["kind"] == "employee":
        return Q(employee=actor["employee"])
    return Q(user=actor["user"])


def _scoped(request, queryset, path):
    """Xabarlar API'sida filial chegarasi (messaging_api import qilmaydi)."""
    from . import branch_scope

    return branch_scope.scope_related(request, queryset, path)


def _find_member(chat, actor):
    return ChatMember.objects.filter(chat=chat).filter(_member_q(actor)).first()


def get_study_group_chat(group):
    """Guruh uchun chatni oladi; bo'lmasa yaratadi."""
    chat = group.chats.filter(chat_type="group").first()
    if not chat:
        chat = Chat.objects.create(chat_type="group", title=(group.name or "")[:255], group=group)
    return chat


def _group_teachers(group):
    """Guruh o'qituvchilari (bosh o'qituvchi + tayinlanganlar)."""
    teachers = []
    if group.teacher and group.teacher.is_active and not group.teacher.is_deleted:
        teachers.append(group.teacher)
    for ta in group.teacher_assignments.select_related("teacher"):
        if ta.teacher and ta.teacher.is_active and not ta.teacher.is_deleted:
            teachers.append(ta.teacher)
    return teachers


def _group_admin_users():
    """Xabarlar bo'limiga kirish huquqi bor adminlar:
    boss admin (superuser) + 'messaging.view' huquqi berilganlar."""
    from django.contrib.auth.models import User
    from .permissions import has_permission, is_super_admin
    admins = []
    qs = User.objects.filter(is_active=True).filter(Q(is_staff=True) | Q(is_superuser=True))
    for u in qs.iterator():
        if not (is_super_admin(u) or has_permission(u, "messaging.view")):
            continue
        emp = None
        try:
            emp = u.employee_profile
        except Exception:
            emp = None
        if emp and emp.is_active and not emp.is_deleted:
            admins.append({"user": u, "employee": emp})
        else:
            admins.append({"user": u, "employee": None})
    return admins


def sync_group_chat(group, request=None):
    """Guruh a'zoligi o'zgarganida chatni avto yangilaydi:
    - yangi o'quvchi qo'shilsa -> chatga qo'shiladi (chat yo'q bo'lsa yaratiladi)
    - guruhdan chiqib ketsa -> chatdan o'chiriladi
    - guruh o'qituvchilari (bosh o'qituvchi + tayinlanganlar) avto qo'shiladi
    - xabarlar huquqi bor adminlar va boss admin avto qo'shiladi
    """
    if not group or not group.pk or not group.is_active:
        return None
    cfg = GlobalConfig.get_instance()
    chat = get_study_group_chat(group)

    active_students = list(group.students.filter(is_active=True, is_deleted=False))
    want_students = {st.pk for st in active_students}
    for st in active_students:
        _add_member(chat, student=st)

    now_members = list(chat.members.filter(student__isnull=False).select_related("student"))
    for m in now_members:
        if m.student_id not in want_students:
            m.delete()

    if cfg.teachers_in_group_chats:
        teachers = _group_teachers(group)
        for i, t in enumerate(teachers):
            _add_member(chat, employee=t, is_admin=(i == 0))
        teacher_ids = {t.pk for t in teachers}

        admins = _group_admin_users()
        admin_emp_ids = {a["employee"].pk for a in admins if a["employee"]}
        for a in admins:
            if a["employee"]:
                _add_member(chat, employee=a["employee"], is_admin=True)
            else:
                _add_member(chat, user=a["user"], is_admin=True)

        for m in chat.members.filter(employee__isnull=False).select_related("employee", "employee__role"):
            emp = m.employee
            if (
                emp and emp.role and emp.role.name == "O'qituvchi"
                and emp.pk not in teacher_ids and emp.pk not in admin_emp_ids
            ):
                m.delete()
    return chat


def _add_member(chat, *, student=None, employee=None, user=None, is_admin=False):
    q = Q()
    if student is not None:
        q = Q(student=student)
    elif employee is not None:
        q = Q(employee=employee)
    elif user is not None:
        q = Q(user=user)
    else:
        return None
    existing = ChatMember.objects.filter(chat=chat).filter(q).first()
    if existing:
        if is_admin and not existing.is_admin:
            existing.is_admin = True
            existing.save(update_fields=["is_admin"])
        return existing
    return ChatMember.objects.create(
        chat=chat, student=student, employee=employee, user=user, is_admin=is_admin
    )


def _member_name(m):
    if m.student and m.student.is_active:
        return f"{m.student.first_name} {m.student.last_name}".strip() or "O'quvchi"
    if m.employee and m.employee.is_active:
        return f"{m.employee.first_name} {m.employee.last_name}".strip() or "Xodim"
    if m.user and m.user.is_active:
        return (m.user.first_name + " " + m.user.last_name).strip() or m.user.username or "Admin"
    return ""


def _member_dict(m):
    if m.student:
        return {
            "id": m.student_id, "kind": "student", "name": f"{m.student.first_name} {m.student.last_name}".strip(),
            "username": m.student.username or "", "phone": m.student.phone or "", "is_admin": m.is_admin,
        }
    if m.employee:
        return {
            "id": m.employee_id, "kind": "employee", "name": f"{m.employee.first_name} {m.employee.last_name}".strip(),
            "username": "", "phone": m.employee.phone or "", "is_admin": m.is_admin,
        }
    if m.user:
        return {
            "id": m.user_id, "kind": "user",
            "name": (m.user.first_name + " " + m.user.last_name).strip() or m.user.username or "Admin",
            "username": "", "phone": "", "is_admin": m.is_admin,
        }
    return None


def _actor_member_kwargs(actor):
    if actor["kind"] == "student":
        return {"student": actor["student"]}
    if actor["kind"] == "employee":
        return {"employee": actor["employee"]}
    return {"user": actor["user"]}


def _abs_media(request, d):
    """relative media_url'ni absolute URL ga aylantiradi (SPA uchun)."""
    if isinstance(d, list):
        return [_abs_media(request, x) for x in d]
    if isinstance(d, dict):
        return {k: (_abs_media(request, v) if k == "media_url" and v and str(v).startswith("/") else v)
                for k, v in d.items()}
    return d


def _msg_dict(actor, msg):
    sender_kind = "student"
    sender_id = msg.student_id if msg.student else None
    sender_name = ""
    if msg.student:
        sender_kind = "student"
        sender_id = msg.student_id
        sender_name = f"{msg.student.first_name} {msg.student.last_name}".strip()
    elif msg.employee:
        sender_kind = "employee"
        sender_id = msg.employee_id
        sender_name = f"{msg.employee.first_name} {msg.employee.last_name}".strip()
    elif msg.user:
        sender_kind = "user"
        sender_id = msg.user_id
        sender_name = (msg.user.first_name + " " + msg.user.last_name).strip() or msg.user.username
    is_me = (msg.student_id and actor["kind"] == "student" and msg.student_id == actor["pk"]) or \
            (msg.employee_id and actor["kind"] == "employee" and msg.employee_id == actor["pk"]) or \
            (msg.user_id and actor["kind"] == "user" and msg.user_id == actor["pk"])
    return {
        "id": msg.id,
        "chat_id": msg.chat_id,
        "text": msg.text,
        "media_type": msg.media_type,
        "media_url": msg.media_file.url if msg.media_file else "",
        "media_duration": msg.media_duration,
        "sender_id": sender_id,
        "sender_kind": sender_kind,
        "sender_name": sender_name,
        "is_me": bool(is_me),
        "created_at": msg.created_at.astimezone(use_tz.get_current_timezone()).isoformat(),
    }


def _chat_dict(chat, actor):
    me = _find_member(chat, actor)
    members = list(chat.members.all())
    names = [n for n in (_member_name(m) for m in members) if n]
    last = chat.messages.filter(is_active=True).order_by("-id").first()
    unread = 0
    if last and me:
        base = chat.messages.filter(is_active=True, id__lte=last.pk)
        if me.last_read_at:
            base = base.filter(created_at__gt=me.last_read_at)
        if actor["kind"] == "student":
            base = base.exclude(student=actor["student"])
        elif actor["kind"] == "employee":
            base = base.exclude(employee=actor["employee"])
        else:
            base = base.exclude(user=actor["user"])
        unread = base.count()
    is_group = chat.chat_type == "group"
    return {
        "id": chat.id,
        "chat_type": chat.chat_type,
        "title": (chat.title or (names[0] if names else "Chat")) if is_group else (names[0] if names else "Chat"),
        "group_id": chat.group_id,
        "members_count": len(members),
        "members_preview": names[:3],
        "members": [_member_dict(m) for m in members if m and _member_dict(m)],
        "last_message": _msg_dict(actor, last) if last else None,
        "unread_count": unread,
        "last_msg_at": (last.created_at if last else chat.created_at).astimezone(use_tz.get_current_timezone()).isoformat(),
        "is_group_admin": bool(me and me.is_admin),
    }


def _chat_for_actor_or_error(actor, chat_id):
    chat = Chat.objects.filter(pk=chat_id).first()
    if not chat:
        return None, None, JsonResponse({"error": "Chat topilmadi"}, status=404)
    me = _find_member(chat, actor)
    if not me:
        return chat, None, JsonResponse({"error": "Siz bu chatga kirmagansiz"}, status=403)
    return chat, me, None


def _detect_media_type(uploaded, requested):
    if requested and requested != "auto":
        return requested
    ctype = (getattr(uploaded, "content_type", "") or "").lower()
    if ctype in IMAGE_TYPES:
        return "photo"
    if ctype in VIDEO_TYPES:
        return "video"
    if ctype in AUDIO_TYPES:
        return "voice"
    if uploaded:
        name = (getattr(uploaded, "name", "") or "").lower()
        if name.endswith((".jpg", ".jpeg", ".png", ".webp", ".gif")):
            return "photo"
        if name.endswith((".mp4", ".webm", ".mov", ".avi", ".mkv")):
            return "video"
        if name.endswith((".mp3", ".wav", ".ogg", ".m4a", ".aac", ".webm")):
            return "voice"
    return "file"


@csrf_exempt
def settings_api(request):
    """Messaging sozlamalari (o'quvchi ilovasi uchun feature-flaglar)."""
    actor, err = _require_actor(request)
    if err:
        return err
    cfg = GlobalConfig.get_instance()
    return JsonResponse({
        "enabled": cfg.messaging_enabled,
        "private_chats": cfg.student_private_chats,
        "group_chats": cfg.student_group_chats,
        "teachers_in_group_chats": cfg.teachers_in_group_chats,
        "role": actor["kind"],
    })


def _chats_view(request):
    actor, err = _require_actor(request)
    if err:
        return None, None, err
    cfg = GlobalConfig.get_instance()
    if not cfg.messaging_enabled:
        return None, None, JsonResponse({"error": "Xabarlar bo'limi hozircha yopiq"}, status=403)
    chats = list(
        Chat.objects.filter(members__in=ChatMember.objects.filter(_member_q(actor))).distinct()
    )
    records = [_chat_dict(c, actor) for c in chats]
    records.sort(key=lambda r: r["last_msg_at"], reverse=True)
    return actor, records, None


@csrf_exempt
def chats_list(request):
    actor, records, err = _chats_view(request)
    if err:
        return err
    return JsonResponse({"chats": records})


def _messages_view(request, chat_id):
    actor, err = _require_actor(request)
    if err:
        return None, None, None, err
    chat, me, err = _chat_for_actor_or_error(actor, chat_id)
    if err:
        return None, None, None, err
    after = request.GET.get("after")
    limit = int(request.GET.get("limit", 100))
    qs = Message.objects.filter(chat=chat, is_active=True)
    if after:
        try:
            qs = qs.filter(id__gt=int(after))
        except (TypeError, ValueError):
            pass
        msgs = list(qs.order_by("id")[:500])
    else:
        msgs = list(reversed(list(qs.order_by("-id")[:limit])))
    members = [m for m in (_member_dict(m) for m in chat.members.all()) if m]
    return actor, {"id": chat.id, "chat_type": chat.chat_type, "title": chat.title, "members": members, "messages": _abs_media(request, [_msg_dict(actor, m) for m in msgs]), "is_group_admin": bool(me and me.is_admin)}, me, None


@csrf_exempt
def chat_messages(request, chat_id):
    actor, data, me, err = _messages_view(request, chat_id)
    if err:
        return err
    return JsonResponse(data)


@csrf_exempt
def mark_read(request, chat_id):
    if request.method != "POST":
        return JsonResponse({"error": "POST so'rovi kerak"}, status=405)
    actor, err = _require_actor(request)
    if err:
        return err
    chat, me, err = _chat_for_actor_or_error(actor, chat_id)
    if err:
        return err
    me.last_read_at = use_tz.now()
    me.save(update_fields=["last_read_at"])
    return JsonResponse({"ok": True})


@csrf_exempt
def send_message(request):
    if request.method != "POST":
        return JsonResponse({"error": "POST so'rovi kerak"}, status=405)
    actor, err = _require_actor(request)
    if err:
        return err
    chat_id = request.POST.get("chat_id") or ""
    try:
        chat = Chat.objects.get(pk=int(chat_id))
    except (TypeError, ValueError, Chat.DoesNotExist):
        return JsonResponse({"error": "Chat topilmadi"}, status=404)
    me = _find_member(chat, actor)
    if not me:
        return JsonResponse({"error": "Siz bu chatga kirmagansiz"}, status=403)

    text = (request.POST.get("text") or "").strip()
    uploaded = request.FILES.get("media_file")
    media_type = request.POST.get("media_type") or "auto"
    duration = request.POST.get("media_duration")
    if not text and not uploaded:
        return JsonResponse({"error": "Xabar bo'sh bo'lishi mumkin emas"}, status=400)
    if len(text) > 5000:
        return JsonResponse({"error": "Xabar juda uzun (maksimal 5000 belgi)"}, status=400)

    media_type = _detect_media_type(uploaded, media_type)
    if uploaded:
        if uploaded.size > MAX_FILE_SIZE:
            return JsonResponse({"error": "Fayl 25 MB dan katta bo'lishi mumkin emas"}, status=400)
        allowed = ("photo", "video", "voice", "file")
        if media_type not in allowed:
            return JsonResponse({"error": "Noto'g'ri media turi"}, status=400)
        if media_type == "text":
            media_type = "file"
    else:
        media_type = "text"

    msg = Message.objects.create(
        chat=chat,
        text=text if text else "",
        media_type=media_type,
        media_file=uploaded if uploaded else None,
        media_duration=int(float(duration)) if duration else None,
        **_actor_member_kwargs(actor),
    )
    me.last_read_at = use_tz.now()
    me.save(update_fields=["last_read_at"])
    return JsonResponse({"success": True, "message": _abs_media(request, _msg_dict(actor, msg))})


@csrf_exempt
def search_users(request):
    actor, err = _require_actor(request)
    if err:
        return err
    q = (request.GET.get("q") or "").strip().lower()
    results = []

    def _search_students():
        qs = _scoped(request, Student.objects.filter(is_active=True, is_deleted=False), "branch")
        if actor["kind"] == "student":
            qs = qs.exclude(pk=actor["pk"])
        if q:
            qs = qs.filter(
                Q(first_name__icontains=q) | Q(last_name__icontains=q) |
                Q(username__icontains=q) | Q(phone__icontains=q)
            )
        return qs[:20]

    def _search_employees():
        qs = _scoped(request, Employee.objects.filter(is_active=True, is_deleted=False), "branches")
        if q:
            qs = qs.filter(Q(first_name__icontains=q) | Q(last_name__icontains=q) | Q(phone__icontains=q))
        return qs[:20]

    for st in _search_students():
        ensure_student_username(st)
        results.append({
            "id": st.pk, "kind": "student",
            "name": f"{st.first_name} {st.last_name}".strip(),
            "username": st.username or "", "phone": st.phone or "",
            "initials": (st.first_name[:1] + (st.last_name[:1] or "")).upper() or "O",
        })
    if actor["kind"] in ("employee", "user"):
        for e in _search_employees():
            results.append({
                "id": e.pk, "kind": "employee",
                "name": f"{e.first_name} {e.last_name}".strip(),
                "username": "", "phone": e.phone or "",
                "initials": (e.first_name[:1] + (e.last_name[:1] or "")).upper() or "X",
            })
    return JsonResponse({"results": results})


@csrf_exempt
def my_study_groups(request):
    actor, err = _require_actor(request)
    if err:
        return err
    if actor["kind"] == "student":
        groups = actor["student"].groups.filter(status__in=["aktiv", "kutilyotgan"], is_active=True).distinct()
    else:
        emp_groups = _scoped(
            request,
            Group.objects.filter(
                status__in=["aktiv", "kutilyotgan"], is_active=True,
                teacher=actor["employee"],
            ),
            "branch",
        )
        assign_groups = _scoped(
            request,
            Group.objects.filter(
                status__in=["aktiv", "kutilyotgan"], is_active=True,
                teacher_assignments__teacher=actor["employee"],
            ),
            "branch",
        )
        groups = (emp_groups | assign_groups).distinct() if actor["employee"] else Group.objects.none()
    data = []
    for g in groups:
        if g.is_date_overdue():
            continue
        data.append({
            "id": g.id,
            "name": g.name,
            "course": g.course.name if g.course else "",
            "members_count": g.students.filter(is_active=True).count(),
        })
    data.sort(key=lambda g: g["name"])
    return JsonResponse({"groups": data})


@csrf_exempt
def open_private(request, student_id):
    if request.method != "POST":
        return JsonResponse({"error": "POST so'rovi kerak"}, status=405)
    actor, err = _require_actor(request)
    if err:
        return err
    cfg = GlobalConfig.get_instance()
    if not cfg.messaging_enabled:
        return JsonResponse({"error": "Xabarlar bo'limi hozircha yopiq"}, status=403)
    if actor["kind"] == "student" and not cfg.student_private_chats:
        return JsonResponse({"error": "Shaxsiy chatlar hozircha yopiq"}, status=403)
    target = _scoped(
        request, Student.objects.filter(pk=student_id, is_active=True, is_deleted=False), "branch"
    ).first()
    if not target:
        return JsonResponse({"error": "O'quvchi topilmadi"}, status=404)
    if target == actor.get("student"):
        return JsonResponse({"error": "O'zingiz bilan chat ochib bo'lmaydi"}, status=400)

    chat = (
        Chat.objects.filter(chat_type="private", members__student=target)
        .filter(members__in=ChatMember.objects.filter(_member_q(actor)))
        .first()
    )
    if not chat:
        chat = Chat.objects.create(chat_type="private", title="")
        _add_member(chat, **_actor_member_kwargs(actor), is_admin=True)
        _add_member(chat, student=target)
    return JsonResponse({"chat": _chat_dict(chat, actor)})


@csrf_exempt
def open_group(request):
    if request.method != "POST":
        return JsonResponse({"error": "POST so'rovi kerak"}, status=405)
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        data = {}
    actor, err = _require_actor(request)
    if err:
        return err
    cfg = GlobalConfig.get_instance()
    if not cfg.messaging_enabled:
        return JsonResponse({"error": "Xabarlar bo'limi hozircha yopiq"}, status=403)
    if actor["kind"] == "student" and not cfg.student_group_chats:
        return JsonResponse({"error": "Guruh chat ochish hozircha yopiq"}, status=403)

    group_id = data.get("study_group_id")
    if group_id:
        group = _scoped(
        request, Group.objects.filter(pk=group_id, is_active=True), "branch"
    ).first()
        if not group:
            return JsonResponse({"error": "Guruh topilmadi"}, status=404)
        if actor["kind"] == "student" and not group.students.filter(pk=actor["pk"]).exists():
            return JsonResponse({"error": "Siz bu guruhda emassiz"}, status=403)

        chat = group.chats.filter(chat_type="group").first()
        if chat and _find_member(chat, actor):
            return JsonResponse({"chat": _chat_dict(chat, actor)})

        if chat and not _find_member(chat, actor):
            _add_member(chat, **_actor_member_kwargs(actor), is_admin=True)
            return JsonResponse({"chat": _chat_dict(chat, actor)})

        chat = Chat.objects.create(chat_type="group", title=group.name, group=group)
        for st in group.students.filter(is_active=True, is_deleted=False):
            _add_member(chat, student=st)
        _add_member(chat, **_actor_member_kwargs(actor), is_admin=True)
        if cfg.teachers_in_group_chats or actor["kind"] in ("employee", "user"):
            emps = set()
            if group.teacher and group.teacher.is_active:
                emps.add(group.teacher)
            for ta in group.teacher_assignments.select_related("teacher"):
                if ta.teacher and ta.teacher.is_active:
                    emps.add(ta.teacher)
            for e in emps:
                _add_member(chat, employee=e)
        if actor["kind"] == "employee" and actor["employee"]:
            _add_member(chat, employee=actor["employee"])
        return JsonResponse({"chat": _chat_dict(chat, actor)})

    title = (data.get("title") or "").strip()
    if not title:
        return JsonResponse({"error": "Guruh nomi kiritilmagan"}, status=400)
    student_ids = [int(i) for i in (data.get("student_ids") or []) if str(i).isdigit()]
    chat = Chat.objects.create(chat_type="group", title=title[:100], group=None)
    _add_member(chat, **_actor_member_kwargs(actor), is_admin=True)
    for sid in student_ids:
        st = _scoped(
        request, Student.objects.filter(pk=sid, is_active=True, is_deleted=False), "branch"
    ).first()
        if st:
            _add_member(chat, student=st)
    return JsonResponse({"chat": _chat_dict(chat, actor)})


@csrf_exempt
def add_members(request, chat_id):
    if request.method != "POST":
        return JsonResponse({"error": "POST so'rovi kerak"}, status=405)
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        data = {}
    actor, err = _require_actor(request)
    if err:
        return err
    chat, me, err = _chat_for_actor_or_error(actor, chat_id)
    if err:
        return err
    if chat.chat_type != "group":
        return JsonResponse({"error": "Faqat guruh chatga yangi a'zo qo'shish mumkin"}, status=400)
    if not me.is_admin:
        return JsonResponse({"error": "Faqat guruh admini a'zo qo'sha oladi"}, status=403)
    added = 0
    for sid in data.get("student_ids") or []:
        (
            _scoped(
                request,
                Student.objects.filter(pk=int(sid), is_active=True, is_deleted=False),
                "branch",
            ).first()
            if str(sid).isdigit()
            else None
        )
        if st and _add_member(chat, student=st):
            added += 1
    return JsonResponse({"ok": True, "added": added, "chat": _chat_dict(chat, actor)})


@csrf_exempt
def unread_total(actor):
    """Web panel context uchun umumiy o'qilmagan xabarlar soni."""
    chats = Chat.objects.filter(members__in=ChatMember.objects.filter(_member_q(actor))).distinct()
    total = 0
    for c in chats:
        me = _find_member(c, actor)
        qs = c.messages.filter(is_active=True)
        if me and me.last_read_at:
            qs = qs.filter(created_at__gt=me.last_read_at)
        if actor["kind"] == "student":
            qs = qs.exclude(student=actor["student"])
        elif actor["kind"] == "employee":
            qs = qs.exclude(employee=actor["employee"])
        else:
            qs = qs.exclude(user=actor["user"])
        total += qs.count()
    return total


@csrf_exempt
def unread_count_api(request):
    actor, err = _require_actor(request)
    if err:
        return err
    return JsonResponse({"count": unread_total(actor)})
