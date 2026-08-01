import re
from django import forms
from django.contrib.auth.models import User
from django.db.models import Q
from .models import Course, CourseLevel, Group, Student, MarketingSurvey, LessonTime, Branch, Room, Role, Position, Employee, Kassa, KassaTransaction, KassaTransfer, ExpenseCategory, IncomeCategory


class LoginForm(forms.Form):
    phone = forms.CharField(
        max_length=20,
        widget=forms.TextInput(attrs={
            "placeholder": "XX XXX XX XX",
            "class": "form-control phone-input",
        }),
        label="Telefon raqam",
    )
    password = forms.CharField(
        widget=forms.PasswordInput(attrs={"placeholder": "Parol", "class": "form-control"}),
        label="Parol",
    )


class CourseForm(forms.ModelForm):
    class Meta:
        model = Course
        fields = ["name"]
        widgets = {
            "name": forms.TextInput(attrs={"class": "form-control", "placeholder": "Kurs nomini kiriting"}),
        }


class CourseLevelForm(forms.ModelForm):
    class Meta:
        model = CourseLevel
        fields = ["course", "name", "daily_price"]
        widgets = {
            "course": forms.Select(attrs={"class": "form-control"}),
            "name": forms.TextInput(attrs={"class": "form-control", "placeholder": "Daraja nomi (masalan: Elementary)"}),
            "daily_price": forms.NumberInput(attrs={"class": "form-control", "placeholder": "Kunlik narx (so'm)", "min": "0"}),
        }


class GroupForm(forms.ModelForm):
    start_date = forms.DateField(
        required=False,
        input_formats=["%Y-%m-%d", "%d.%m.%Y", "%d/%m/%Y"],
        widget=forms.DateInput(attrs={"class": "form-control", "type": "date"}, format="%Y-%m-%d"),
        label="Boshlanish sanasi",
    )
    end_date = forms.DateField(
        required=False,
        input_formats=["%Y-%m-%d", "%d.%m.%Y", "%d/%m/%Y"],
        widget=forms.DateInput(attrs={"class": "form-control", "type": "date"}, format="%Y-%m-%d"),
        label="Tugash sanasi",
    )

    class Meta:
        model = Group
        fields = ["name", "status", "course", "level", "education_type", "day_type", "room", "teacher", "telegram_link", "start_date", "end_date"]
        widgets = {
            "name": forms.TextInput(attrs={"class": "form-control", "placeholder": "Guruh nomini kiriting"}),
            "status": forms.Select(attrs={"class": "form-control"}),
            "course": forms.Select(attrs={"class": "form-control", "id": "id_course"}),
            "level": forms.Select(attrs={"class": "form-control", "id": "id_level"}),
            "education_type": forms.Select(attrs={"class": "form-control"}),
            "day_type": forms.Select(attrs={"class": "form-control"}),
            "room": forms.Select(attrs={"class": "form-control"}),
            "teacher": forms.Select(attrs={"class": "form-control"}),
            "telegram_link": forms.URLInput(attrs={"class": "form-control", "placeholder": "https://t.me/..."}),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["room"].queryset = Room.objects.all()
        self.fields["room"].empty_label = "--- Tanlang ---"
        self.fields["teacher"].queryset = Employee.objects.filter(role__name="O'qituvchi")
        self.fields["teacher"].empty_label = "--- Tanlang ---"
        self.fields["level"].queryset = CourseLevel.objects.all()
        self.fields["level"].empty_label = "--- Tanlang (ixtiyoriy) ---"
        self.fields["level"].required = False

    def clean(self):
        cleaned_data = super().clean()
        status = cleaned_data.get("status")
        start_date = cleaned_data.get("start_date")
        end_date = cleaned_data.get("end_date")
        if status != "kutilyotgan" and not (start_date and end_date):
            raise forms.ValidationError("⚠ Aktiv guruh uchun boshlanish va tugash sanalari majburiy!")
        if start_date and end_date and end_date <= start_date:
            raise forms.ValidationError("⚠ Tugash sanasi boshlanish sanasidan keyin bo'lishi kerak!")
        return cleaned_data

    def save(self, commit=True):
        group = super().save(commit=False)
        level = self.cleaned_data.get("level")
        if level:
            group.lesson_price = level.daily_price
        if commit:
            group.save()
        return group


class StudentCreateForm(forms.ModelForm):
    class Meta:
        model = Student
        fields = [
            "first_name", "last_name", "phone", "desired_course", "groups",
            "marketing_survey", "additional_info",
            "father_full_name", "father_phone",
            "mother_full_name", "mother_phone",
            "email", "birth_date", "lesson_time", "student_category",
            "payment_date", "education_language", "target_university",
            "father_workplace", "mother_workplace", "home_address", "school",
        ]
        widgets = {
            "first_name": forms.TextInput(attrs={"class": "form-control", "placeholder": "Ismini kiriting"}),
            "last_name": forms.TextInput(attrs={"class": "form-control", "placeholder": "Familyasini kiriting"}),
            "phone": forms.TextInput(attrs={"class": "form-control phone-input", "placeholder": "90 123 45 67", "maxlength": "17", "data-phone": "true"}),
            "desired_course": forms.SelectMultiple(attrs={"class": "form-control", "size": 5}),
            "groups": forms.SelectMultiple(attrs={"class": "form-control", "size": 6}),
            "birth_date": forms.DateInput(attrs={"class": "form-control", "type": "date"}),
            "marketing_survey": forms.Select(attrs={"class": "form-control"}),
            "additional_info": forms.Textarea(attrs={"class": "form-control", "placeholder": "Qo'shimcha ma'lumotlar", "rows": 3}),
            "father_full_name": forms.TextInput(attrs={"class": "form-control", "placeholder": "Otasining ism familyasi"}),
            "father_phone": forms.TextInput(attrs={"class": "form-control phone-input", "placeholder": "90 123 45 67", "maxlength": "17", "data-phone": "true"}),
            "mother_full_name": forms.TextInput(attrs={"class": "form-control", "placeholder": "Onasining ism familyasi"}),
            "mother_phone": forms.TextInput(attrs={"class": "form-control phone-input", "placeholder": "90 123 45 67", "maxlength": "17", "data-phone": "true"}),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["desired_course"].queryset = Course.objects.all()
        self.fields["desired_course"].label = "Qiziqqan kurslari"
        self.fields["groups"].queryset = Group.objects.filter(status__in=["aktiv", "kutilyotgan"]).order_by("name")
        self.fields["groups"].required = False
        self.fields["groups"].label = "Guruhlar"
        for fn in ["phone", "father_phone", "mother_phone"]:
            val = self.initial.get(fn, "")
            if val and not str(val).startswith("+998"):
                self.initial[fn] = "+998" + str(val).lstrip("+").lstrip("998")
            elif not val:
                self.initial[fn] = "+998"

    def _normalize_phone(self, phone):
        if not phone:
            return phone
        digits = re.sub(r'\D', '', phone)
        if digits.startswith('998') and len(digits) >= 12:
            return '+' + digits[:12]
        if len(digits) >= 9:
            return '+998' + digits[-9:]
        return '+998' + digits

    def _validate_uz_phone(self, phone):
        phone = self._normalize_phone(phone)
        if not phone:
            return phone
        match = re.match(r'^\+998\d{9}$', phone)
        if not match:
            raise forms.ValidationError("Noto'g'ri raqam formati. O'zbekiston raqamini kiriting: +998 XX XXX XX XX")
        return phone

    def clean_phone(self):
        phone = self.cleaned_data.get("phone")
        phone = self._validate_uz_phone(phone)
        if phone:
            existing = Student.objects.filter(phone=phone).first()
            if existing:
                raise forms.ValidationError(
                    f"Bu raqam allaqachon ro'yxatdan o'tgan: {existing.first_name} {existing.last_name} ({existing.phone})"
                )
        return phone

    def clean_father_phone(self):
        phone = self.cleaned_data.get("father_phone")
        if phone:
            return self._validate_uz_phone(phone)
        return phone

    def clean_mother_phone(self):
        phone = self.cleaned_data.get("mother_phone")
        if phone:
            return self._validate_uz_phone(phone)
        return phone


class StudentEditForm(forms.ModelForm):
    class Meta:
        model = Student
        fields = [
            "first_name", "last_name", "phone", "desired_course", "groups",
            "marketing_survey", "additional_info",
            "father_full_name", "father_phone",
            "mother_full_name", "mother_phone",
            "email", "birth_date", "lesson_time", "student_category",
            "payment_date", "education_language", "target_university",
            "father_workplace", "mother_workplace", "home_address", "school",
        ]
        widgets = {
            "first_name": forms.TextInput(attrs={"class": "form-control", "placeholder": "Ismini kiriting"}),
            "last_name": forms.TextInput(attrs={"class": "form-control", "placeholder": "Familyasini kiriting"}),
            "phone": forms.TextInput(attrs={"class": "form-control phone-input", "placeholder": "90 123 45 67", "maxlength": "17", "data-phone": "true"}),
            "desired_course": forms.SelectMultiple(attrs={"class": "form-control", "size": 5}),
            "groups": forms.SelectMultiple(attrs={"class": "form-control", "size": 6}),
            "birth_date": forms.DateInput(attrs={"class": "form-control", "type": "date"}),
            "marketing_survey": forms.Select(attrs={"class": "form-control"}),
            "additional_info": forms.Textarea(attrs={"class": "form-control", "placeholder": "Qo'shimcha ma'lumotlar", "rows": 3}),
            "father_full_name": forms.TextInput(attrs={"class": "form-control", "placeholder": "Otasining ism familyasi"}),
            "father_phone": forms.TextInput(attrs={"class": "form-control phone-input", "placeholder": "90 123 45 67", "maxlength": "17", "data-phone": "true"}),
            "mother_full_name": forms.TextInput(attrs={"class": "form-control", "placeholder": "Onasining ism familyasi"}),
            "mother_phone": forms.TextInput(attrs={"class": "form-control phone-input", "placeholder": "90 123 45 67", "maxlength": "17", "data-phone": "true"}),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["desired_course"].queryset = Course.objects.all()
        self.fields["desired_course"].label = "Qiziqqan kurslari"
        self.fields["groups"].queryset = Group.objects.filter(status__in=["aktiv", "kutilyotgan"]).order_by("name")
        self.fields["groups"].required = False
        self.fields["groups"].label = "Guruhlar"
        for fn in ["phone", "father_phone", "mother_phone"]:
            val = self.initial.get(fn, "")
            if val and not str(val).startswith("+998"):
                self.initial[fn] = "+998" + str(val).lstrip("+").lstrip("998")
            elif not val:
                self.initial[fn] = "+998"

    def _normalize_phone(self, phone):
        if not phone:
            return phone
        digits = re.sub(r'\D', '', phone)
        if digits.startswith('998') and len(digits) >= 12:
            return '+' + digits[:12]
        if len(digits) >= 9:
            return '+998' + digits[-9:]
        return '+998' + digits

    def _validate_uz_phone(self, phone):
        phone = self._normalize_phone(phone)
        if not phone:
            return phone
        match = re.match(r'^\+998\d{9}$', phone)
        if not match:
            raise forms.ValidationError("Noto'g'ri raqam formati. O'zbekiston raqamini kiriting: +998 XX XXX XX XX")
        return phone

    def clean_phone(self):
        phone = self.cleaned_data.get("phone")
        phone = self._validate_uz_phone(phone)
        if phone:
            existing = Student.objects.filter(phone=phone).exclude(pk=self.instance.pk).first()
            if existing:
                raise forms.ValidationError(
                    f"Bu raqam allaqachon ro'yxatdan o'tgan: {existing.first_name} {existing.last_name} ({existing.phone})"
                )
        return phone

    def clean_father_phone(self):
        phone = self.cleaned_data.get("father_phone")
        if phone:
            return self._validate_uz_phone(phone)
        return phone

    def clean_mother_phone(self):
        phone = self.cleaned_data.get("mother_phone")
        if phone:
            return self._validate_uz_phone(phone)
        return phone


class MarketingSurveyForm(forms.ModelForm):
    class Meta:
        model = MarketingSurvey
        fields = ["name"]
        widgets = {
            "name": forms.TextInput(attrs={"class": "form-control", "placeholder": "So'rovnoma turini kiriting (masalan: Banner orqali, Do'st taklif qildi)"}),
        }


class FreezeForm(forms.Form):
    days = forms.IntegerField(
        min_value=1, max_value=365,
        widget=forms.NumberInput(attrs={"class": "form-control", "placeholder": "Necha kun?", "min": 1, "max": 365}),
        label="Muzlatish muddati (kun)",
    )
    reason = forms.CharField(
        required=False,
        widget=forms.Textarea(attrs={"class": "form-control", "placeholder": "Muzlatish sababi (ixtiyoriy)", "rows": 3}),
        label="Sabab",
    )


class RemoveFromGroupForm(forms.Form):
    reason = forms.CharField(
        required=True,
        widget=forms.Textarea(attrs={"class": "form-control", "placeholder": "Chiqarish sababini yozing", "rows": 3}),
        label="Chiqarish sababi",
    )


class LessonTimeForm(forms.ModelForm):
    days = forms.MultipleChoiceField(
        choices=LessonTime.DAY_CHOICES,
        widget=forms.CheckboxSelectMultiple(attrs={"class": "checkbox-group"}),
        label="Hafta kunlari",
    )

    class Meta:
        model = LessonTime
        fields = ["days", "start_time", "end_time"]
        widgets = {
            "start_time": forms.TimeInput(attrs={"class": "form-control", "type": "time"}, format="%H:%M"),
            "end_time": forms.TimeInput(attrs={"class": "form-control", "type": "time"}, format="%H:%M"),
        }
        labels = {
            "start_time": "Boshlanish vaqti",
            "end_time": "Tugash vaqti",
        }

    def __init__(self, *args, **kwargs):
        self.group = kwargs.pop("group", None)
        super().__init__(*args, **kwargs)

    def clean_days(self):
        days = self.cleaned_data["days"]
        return ",".join(days)

    def clean(self):
        cleaned_data = super().clean()
        days_str = cleaned_data.get("days")
        start_time = cleaned_data.get("start_time")
        end_time = cleaned_data.get("end_time")
        if not (self.group and days_str and start_time and end_time):
            return cleaned_data
        new_days = set(d.strip().lower() for d in days_str.split(",") if d.strip())
        errors = []
        if self.group.room:
            room_conflicts = LessonTime.objects.filter(
                group__room=self.group.room,
                start_time__lt=end_time,
                end_time__gt=start_time,
            ).exclude(group=self.group).exclude(group__status__in=["arxivlangan", "yopilgan"]).select_related("group")
            for lt in room_conflicts:
                lt_days = set(d.strip().lower() for d in lt.days.split(",") if d.strip())
                if not new_days.isdisjoint(lt_days):
                    errors.append(
                        f"⚠ Bu vaqtda xona band! "
                        f"({lt.group.name}: {lt.get_days_display()} "
                        f"{lt.start_time.strftime('%H:%M')}-{lt.end_time.strftime('%H:%M')})"
                    )
                    break
        if self.group.teacher:
            teacher_conflicts = LessonTime.objects.filter(
                group__teacher=self.group.teacher,
                start_time__lt=end_time,
                end_time__gt=start_time,
            ).exclude(group=self.group).exclude(group__status__in=["arxivlangan", "yopilgan"]).select_related("group")
            for lt in teacher_conflicts:
                lt_days = set(d.strip().lower() for d in lt.days.split(",") if d.strip())
                if not new_days.isdisjoint(lt_days):
                    errors.append(
                        f"⚠ Bu vaqtda o'qituvchi band! "
                        f"({lt.group.name}: {lt.get_days_display()} "
                        f"{lt.start_time.strftime('%H:%M')}-{lt.end_time.strftime('%H:%M')})"
                    )
                    break
        if errors:
            raise forms.ValidationError(" ".join(errors))
        return cleaned_data


class AddToGroupForm(forms.Form):
    group = forms.ModelChoiceField(
        queryset=Group.objects.filter(status="aktiv"),
        widget=forms.Select(attrs={"class": "form-control"}),
        label="Guruhni tanlang",
        empty_label="--- Guruh tanlang ---",
    )
    reason = forms.CharField(
        required=False,
        widget=forms.Textarea(attrs={"class": "form-control", "placeholder": "Qo'shimcha izoh (ixtiyoriy)", "rows": 2}),
        label="Izoh",
    )


class BranchForm(forms.ModelForm):
    class Meta:
        model = Branch
        fields = ["name"]
        widgets = {
            "name": forms.TextInput(attrs={
                "class": "form-control", "placeholder": "Filial nomini kiriting"
            }),
        }


class RoomForm(forms.ModelForm):
    class Meta:
        model = Room
        fields = ["name"]
        widgets = {
            "name": forms.TextInput(attrs={
                "class": "form-control", "placeholder": "Xona nomini kiriting"
            }),
        }


class PositionForm(forms.ModelForm):
    class Meta:
        model = Position
        fields = ["name"]
        widgets = {
            "name": forms.TextInput(attrs={
                "class": "form-control", "placeholder": "Vazifa nomini kiriting"
            }),
        }


class EmployeeForm(forms.ModelForm):
    password = forms.CharField(
        required=False,
        label="Parol",
        widget=forms.PasswordInput(attrs={
            "class": "form-input", "placeholder": "Parolni kiriting"
        }),
        help_text="Xodim tizimga kirishi uchun parol",
    )

    class Meta:
        model = Employee
        fields = [
            "first_name", "last_name", "phone", "email", "gender",
            "birth_date", "position", "photo", "salary_enabled",
            "branches", "role", "salary_same", "salary", "notes",
        ]
        widgets = {
            "first_name": forms.TextInput(attrs={"class": "form-input", "placeholder": "Ismni kiriting"}),
            "last_name": forms.TextInput(attrs={"class": "form-input", "placeholder": "Familiyani kiriting"}),
            "phone": forms.TextInput(attrs={"class": "form-input", "placeholder": "XX XXX XX XX"}),
            "email": forms.EmailInput(attrs={"class": "form-input", "placeholder": "example@mail.com"}),
            "gender": forms.Select(attrs={"class": "form-input"}, choices=[("", "Tanlang"), ("erkak", "Erkak"), ("ayol", "Ayol")]),
            "birth_date": forms.DateInput(attrs={"class": "form-input", "type": "date"}),
            "position": forms.Select(attrs={"class": "form-input"}),
            "salary_enabled": forms.CheckboxInput(attrs={"class": "hidden"}),
            "branches": forms.CheckboxSelectMultiple(),
            "role": forms.Select(attrs={"class": "form-input"}),
            "salary_same": forms.CheckboxInput(attrs={"class": "hidden"}),
            "salary": forms.NumberInput(attrs={"class": "form-input", "placeholder": "0"}),
            "notes": forms.Textarea(attrs={"class": "form-input", "placeholder": "Xodim haqida qo'shimcha ma'lumot...", "rows": 4}),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["position"].queryset = Position.objects.all()
        self.fields["position"].empty_label = "Tanlang"
        self.fields["branches"].queryset = Branch.objects.all()
        self.fields["role"].queryset = Role.objects.all()
        self.fields["role"].empty_label = "Tanlang"


class KassaForm(forms.ModelForm):
    class Meta:
        model = Kassa
        fields = ["owner", "name", "is_active"]
        widgets = {
            "owner": forms.Select(attrs={"class": "form-control"}),
            "name": forms.TextInput(attrs={"class": "form-control", "placeholder": "Kassa nomini kiriting"}),
            "is_active": forms.CheckboxInput(attrs={"class": "form-check-input"}),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        from .models import Employee as EmpModel
        admin_user_ids = EmpModel.objects.filter(
            Q(role__name__icontains="admin") | Q(role__name__icontains="Admin")
        ).values_list("user_id", flat=True)
        admin_users = User.objects.filter(
            Q(is_staff=True) | Q(is_superuser=True) | Q(pk__in=admin_user_ids)
        )
        self.fields["owner"].queryset = admin_users
        self.fields["owner"].empty_label = "--- Admin tanlang ---"


class KassaIncomeForm(forms.Form):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        db_cats = [("", "--- Kategoriya tanlang ---")]
        for cat in IncomeCategory.objects.filter(is_active=True):
            db_cats.append((cat.name, cat.name))
        db_cats.append(("boshqa", "Boshqa (maxsus)"))
        self.fields["income_category"].choices = db_cats

    amount = forms.DecimalField(
        max_digits=12, decimal_places=2, min_value=0.01,
        widget=forms.NumberInput(attrs={"class": "form-control", "placeholder": "Summani kiriting", "min": "1"}),
        label="Summa (so'm)",
    )
    income_category = forms.ChoiceField(
        choices=[],
        required=False,
    )
    description = forms.CharField(
        required=True,
        widget=forms.Textarea(attrs={"class": "form-control", "placeholder": "Kirim sababini kiriting", "rows": 3}),
        label="Sabab",
    )


class KassaExpenseForm(forms.Form):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        db_cats = [("", "--- Kategoriya tanlang ---")]
        for cat in ExpenseCategory.objects.all():
            db_cats.append((cat.name, cat.name))
        db_cats.append(("boshqa", "Boshqa (maxsus)"))
        self.fields["expense_category"].choices = db_cats

    amount = forms.DecimalField(
        max_digits=12, decimal_places=2, min_value=0.01,
        widget=forms.NumberInput(attrs={"class": "form-control", "placeholder": "Summani kiriting", "min": "1"}),
        label="Summa (so'm)",
    )
    expense_category = forms.ChoiceField(
        choices=[],
        required=False,
        widget=forms.Select(attrs={"class": "form-control", "id": "expense-category-select", "onchange": "toggleCustomCategory(this)"}),
        label="Kategoriya",
    )
    custom_category = forms.CharField(
        required=False,
        widget=forms.TextInput(attrs={"class": "form-control", "placeholder": "Kategoriya nomini kiriting", "style": "display:none;", "id": "custom-category-input"}),
        label="Maxsus kategoriya",
    )
    description = forms.CharField(
        required=True,
        widget=forms.Textarea(attrs={"class": "form-control", "placeholder": "Chiqim sababini kiriting", "rows": 3}),
        label="Sabab",
    )


class KassaTransferForm(forms.Form):
    to_kassa = forms.ModelChoiceField(
        queryset=Kassa.objects.filter(is_active=True),
        widget=forms.Select(attrs={"class": "form-control"}),
        label="Qabul qiluvchi kassa",
        empty_label="--- Kassa tanlang ---",
    )
    amount = forms.DecimalField(
        max_digits=12, decimal_places=2, min_value=0.01,
        widget=forms.NumberInput(attrs={"class": "form-control", "placeholder": "Summani kiriting", "min": "1"}),
        label="Summa (so'm)",
    )
    description = forms.CharField(
        required=False,
        widget=forms.Textarea(attrs={"class": "form-control", "placeholder": "Izoh (ixtiyoriy)", "rows": 2}),
        label="Izoh",
    )

    def __init__(self, *args, exclude_kassa=None, **kwargs):
        super().__init__(*args, **kwargs)
        qs = Kassa.objects.filter(is_active=True)
        if exclude_kassa:
            qs = qs.exclude(pk=exclude_kassa.pk)
        self.fields["to_kassa"].queryset = qs


class KassaFilterForm(forms.Form):
    date_from = forms.DateField(
        required=False,
        widget=forms.DateInput(attrs={"class": "form-control", "type": "date"}),
        label="Dan",
    )
    date_to = forms.DateField(
        required=False,
        widget=forms.DateInput(attrs={"class": "form-control", "type": "date"}),
        label="Gacha",
    )
    owner = forms.ModelChoiceField(
        required=False,
        queryset=User.objects.all(),
        widget=forms.Select(attrs={"class": "form-control"}),
        label="Foydalanuvchi",
        empty_label="--- Barchasi ---",
    )
    transaction_type = forms.ChoiceField(
        required=False,
        choices=[("", "--- Barcha turlar ---")] + KassaTransaction.TransactionType.choices,
        widget=forms.Select(attrs={"class": "form-control"}),
        label="Operatsiya turi",
    )
    amount_min = forms.DecimalField(
        required=False,
        widget=forms.NumberInput(attrs={"class": "form-control", "placeholder": "Min"}),
        label="Min summa",
    )
    amount_max = forms.DecimalField(
        required=False,
        widget=forms.NumberInput(attrs={"class": "form-control", "placeholder": "Max"}),
        label="Max summa",
    )
    search = forms.CharField(
        required=False,
        widget=forms.TextInput(attrs={"class": "form-control", "placeholder": "Qidirish..."}),
        label="Qidirish",
    )


class ExpenseCategoryForm(forms.ModelForm):
    class Meta:
        model = ExpenseCategory
        fields = ["name", "order"]
        widgets = {
            "name": forms.TextInput(attrs={"class": "form-control", "placeholder": "Kategoriya nomi"}),
            "order": forms.NumberInput(attrs={"class": "form-control", "min": "0"}),
        }

class IncomeCategoryForm(forms.ModelForm):
    class Meta:
        model = IncomeCategory
        fields = ["name", "order"]
        widgets = {
            "name": forms.TextInput(attrs={"class": "form-control", "placeholder": "Kategoriya nomi"}),
            "order": forms.NumberInput(attrs={"class": "form-control", "min": "0"}),
        }
