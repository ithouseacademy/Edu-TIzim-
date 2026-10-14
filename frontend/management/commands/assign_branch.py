"""Eski ma'lumotlarni filialga biriktirish.

Misollar:

    # Avval holatni ko'rish
    python manage.py assign_branch --show

    # Barcha filialga tegishilmagan ma'lumotni «Markaziy» filialiga ko'chirish
    python manage.py assign_branch --branch "Markaziy filial"

    # Butun jadvalni ko'chirish (guruh, o'quvchi, xona, kassa)
    python manage.py assign_branch --branch "Markaziy filial" --models all

    # Xodimga filial tayinlash
    python manage.py assign_branch --employee "Alisher Karimov" --branch "Markaziy filial"
"""

from django.core.management.base import BaseCommand, CommandError
from django.db.models import Q

from frontend.models import AdminBranch, Branch, Employee, Group, Kassa, Room, Student

MODELS = {
    "group": (Group, "Guruh"),
    "student": (Student, "O'quvchi"),
    "room": (Room, "Xona"),
    "kassa": (Kassa, "Kassa"),
}


class Command(BaseCommand):
    help = "Filialga biriktirilmagan ma'lumotlarni ko'rsatadi yoki berilgan filialga ko'chiradi."

    def add_arguments(self, parser):
        parser.add_argument("--branch", type=str, help="Ma'lumotlar biriktiriladigan filial nomi")
        parser.add_argument("--models", type=str, default="all",
                            help="all | group,student,room,kassa (vergul bilan)")
        parser.add_argument("--employee", type=str, help="Xodim ismi/familiyasi — unga filial tayinlash")
        parser.add_argument("--admin", type=str, help="Admin username — unga filial boshqaruvini berish")
        parser.add_argument("--show", action="store_true", help="Faqat statistikani ko'rsatish, o'zgartirmaslik")

    def handle(self, *args, **options):
        selected = self._selected_models(options["models"])
        branch = self._resolve_branch(options["branch"])

        if options["employee"]:
            self._assign_employee(options["employee"], branch, options["show"])
        if options["admin"]:
            self._assign_admin(options["admin"], branch, options["show"])

        if not options["employee"] and not options["admin"]:
            self._report(selected, branch, options["show"])

    # ------------------------------------------------------------------
    def _selected_models(self, raw):
        raw = (raw or "all").strip().lower()
        if raw == "all":
            return list(MODELS)
        keys = [k.strip() for k in raw.split(",") if k.strip()]
        unknown = [k for k in keys if k not in MODELS]
        if unknown:
            raise CommandError("Noma'lum model: %s. Muvjud: %s" % (", ".join(unknown), ", ".join(MODELS)))
        return keys

    def _resolve_branch(self, name):
        if not name:
            return None
        branch = Branch.objects.filter(name__iexact=name.strip()).first()
        if branch is None:
            branch = Branch.objects.filter(name__icontains=name.strip()).first()
        if branch is None:
            raise CommandError("Filial topilmadi: %s" % name)
        return branch

    def _assign_employee(self, raw, branch, show_only):
        employee = Employee.objects.filter(
            Q(first_name__icontains=raw) | Q(last_name__icontains=raw)
        ).first()
        if employee is None:
            raise CommandError("Xodim topilmadi: %s" % raw)
        if branch is None:
            self.stdout.write(
                "Xodim %s hozir filiallari: %s"
                % (employee, ", ".join(b.name for b in employee.branches.all()) or "yo'q")
            )
            return
        if show_only:
            self.stdout.write("[DRY-RUN] %s → %s biriktirilardi" % (employee, branch))
            return
        employee.branches.add(branch)
        self.stdout.write(self.style.SUCCESS("%s → %s biriktirildi" % (employee, branch)))

    def _assign_admin(self, username, branch, show_only):
        from django.contrib.auth.models import User

        admin = User.objects.filter(username=username).first()
        if admin is None:
            raise CommandError("Admin topilmadi: %s" % username)
        if admin.is_superuser:
            self.stdout.write("%s — super admin, allaqachon barcha filiallarni ko'radi" % username)
            return
        if branch is None:
            self.stdout.write(
                "%s filiallari: %s"
                % (username, ", ".join(b.name for b in branch_scope_options(admin)) or "yo'q")
            )
            return
        if show_only:
            self.stdout.write("[DRY-RUN] %s → %s boshqaruvi berilardi" % (username, branch))
            return
        AdminBranch.objects.get_or_create(user=admin, branch=branch, defaults={"granted_by": admin})
        self.stdout.write(self.style.SUCCESS("%s ga %s filiali biriktirildi" % (username, branch)))

    def _report(self, selected, branch, show_only):
        counts = {}
        for key in selected:
            model, label = MODELS[key]
            counts[key] = (label, model.objects.filter(branch__isnull=True).count())

        self.stdout.write("Filialga biriktirilmagan ma'lumotlar:")
        for key, (label, count) in counts.items():
            self.stdout.write("  %-10s %6d ta" % (label, count))

        if branch is None:
            self.stdout.write("")
            self.stdout.write("O'zgartirish uchun --branch nomini bering.")
            return

        if show_only:
            self.stdout.write("")
            self.stdout.write("[DRY-RUN] %s ga ko'chirilardi:" % branch.name)
            for key, (label, count) in counts.items():
                if count:
                    self.stdout.write("  %-10s %6d ta" % (label, count))
            return

        total = 0
        for key in selected:
            model, label = MODELS[key]
            updated = model.objects.filter(branch__isnull=True).update(branch=branch)
            total += updated
            if updated:
                self.stdout.write("  %-10s %6d ta yangilandi" % (label, updated))
        self.stdout.write(self.style.SUCCESS("Jami %d ta yozuv %s filialiga biriktirildi" % (total, branch.name)))


def branch_scope_options(user):
    from frontend.models import Branch

    return Branch.objects.filter(admin_users=user)