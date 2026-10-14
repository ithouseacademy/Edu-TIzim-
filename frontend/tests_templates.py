"""Shablonlarni statik tekshiruv: `{% load %}` yetishmaydigan filtrlar.

Django'da `{% load %}` child templatega avtomatik o'tmaydi, shuning uchun
bitta shablon ishlatsa, boshqasi `TemplateSyntaxError` beradi. Bu test
bunday xatolarni ishlab chiqishdan oldin ushlaydi.
"""

import pathlib
import re

from django.template import Template, TemplateSyntaxError
from django.test import SimpleTestCase

TEMPLATES_DIR = pathlib.Path(__file__).resolve().parent.parent / "templates"

# frontend/templatetags ichidagi filter va tag modullari
CUSTOM_LIBS = {
    "dict_filters": ["get_item", "get_key", "has_key", "spacesep",
                     "get_balance", "receipt_desc", "user_name"],
    "perm_tags": ["perm_tags"],
}


class TemplateLoadTests(SimpleTestCase):
    def _template_files(self):
        return sorted(TEMPLATES_DIR.glob("**/*.html"))

    def test_templates_dir_exists(self):
        self.assertTrue(TEMPLATES_DIR.exists(), "templates/ topilmadi")

    def test_no_custom_filter_without_load(self):
        """Har bir shablon o'z filtrini ishlatishidan oldin `load` qilishi kerak."""
        problems = []
        for path in self._template_files():
            text = path.read_text(encoding="utf-8")
            for lib, names in CUSTOM_LIBS.items():
                for name in names:
                    if not re.search(r"\|\s*%s\b" % re.escape(name), text):
                        continue
                    load_pattern = r"\{%\s*load\b[^%]*\b" + re.escape(lib) + r"\b"
                    if not re.search(load_pattern, text):
                        rel = path.relative_to(TEMPLATES_DIR)
                        problems.append("%s -> %s (load %s)" % (rel, name, lib))
        self.assertEqual(problems, [], "load qilinmagan filtrlar:\n" + "\n".join(problems))

    def test_templates_compile(self):
        """Barcha shablonlar sintaksis bo'yicha tuzilishi kerak."""
        errors = []
        for path in self._template_files():
            source = path.read_text(encoding="utf-8")
            try:
                Template(source)
            except TemplateSyntaxError as exc:
                rel = path.relative_to(TEMPLATES_DIR)
                errors.append("%s: %s" % (rel, exc))
            except Exception:  # noqa: BLE001 - boshqa xatolar backendga tegishli
                continue
        self.assertEqual(errors, [], "Shablon xatolari:\n" + "\n".join(errors))

    def test_referenced_templates_exist(self):
        """`render()` da ko'rsatilgan har bir shablon faylga borishi kerak."""
        app_root = TEMPLATES_DIR.parent
        render_re = re.compile(r"""render\(\s*request\s*,\s*["']([^"']+\.html)["']""")

        # Ma'lum: bu sahifalar allaqachon buzilgan (filial ishidan emas).
        #   - `teacher/*` — o'qituvchilar endi alohida React ilovasiga
        #     yo'naltiriladi, Django shablonlari qo'llanmaydi.
        #   - `absence_reason/delete` — o'chirish modal orqali amalga oshiriladi,
        #     alohida shablon kerak emas.
        # Ro'yxatga yangi shablon qo'shilsa, bu test darhol qizil bo'ladi.
        known_missing = {
            "teacher/dashboard.html",
            "teacher/my_groups.html",
            "teacher/group_detail.html",
            "teacher/attendance_desktop.html",
            "absence_reason/delete.html",
        }

        missing = {}
        for path in sorted(app_root.glob("frontend/*.py")):
            text = path.read_text(encoding="utf-8")
            for name in render_re.findall(text):
                if not (TEMPLATES_DIR / name).exists():
                    missing.setdefault(name, []).append(path.name)

        unexpected = sorted(set(missing) - known_missing)
        self.assertEqual(
            unexpected,
            [],
            "Kutilmagan yo'q shablonlar:\n"
            + "\n".join("%s (%s)" % (n, ", ".join(missing[n])) for n in unexpected),
        )