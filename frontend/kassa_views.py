from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required
from django.contrib.auth.models import User
from django.contrib import messages
from django.http import JsonResponse, HttpResponse
from django.db.models import Sum, Q, Count
from django.db import transaction
from django.core.paginator import Paginator
from datetime import date, datetime, timedelta
from decimal import Decimal
import csv

from .models import (
    Kassa, KassaTransaction, KassaTransfer, Employee,
    PaymentMethod, ExpenseCategory, IncomeCategory,
    TeacherBalance, TeacherTransaction,
)
from .views import get_or_create_teacher_balance, add_teacher_balance_transaction
from .forms import (
    KassaForm, KassaIncomeForm, KassaExpenseForm,
    KassaTransferForm, KassaFilterForm, ExpenseCategoryForm, IncomeCategoryForm,
)
from .permissions import has_permission


def _get_employee(user):
    try:
        return user.employee_profile
    except Exception:
        return None


def _is_superadmin(user):
    return user.is_superuser or user.is_staff


def _employee_name(user):
    emp = _get_employee(user)
    if emp:
        return f"{emp.first_name} {emp.last_name or ''}".strip()
    return user.get_full_name() or user.username


def _wants_json(request):
    return request.headers.get("X-Requested-With") == "XMLHttpRequest"


@login_required(login_url="login")
def kassa_dashboard(request):
    user = request.user
    is_superadmin = _is_superadmin(user)

    if is_superadmin:
        kassalar = Kassa.objects.select_related("owner").all()
    else:
        kassalar = Kassa.objects.select_related("owner").filter(owner=user)

    today = date.today()
    total_balance = sum(k.balance for k in kassalar)
    today_income = sum(k.today_income for k in kassalar)
    today_expense = sum(k.today_expense for k in kassalar)

    today_payments = KassaTransaction.objects.filter(
        transaction_type="payment", created_at__date=today
    )
    if not is_superadmin:
        today_payments = today_payments.filter(kassa__owner=user)
    today_payment_total = today_payments.aggregate(total=Sum("amount"))["total"] or Decimal("0.00")

    top_income_kassa = None
    top_expense_kassa = None
    if is_superadmin and kassalar:
        kassa_incomes = []
        kassa_expenses = []
        for k in kassalar:
            ki = KassaTransaction.objects.filter(
                kassa=k, transaction_type__in=["income", "payment", "transfer_in"],
                created_at__date=today
            ).aggregate(total=Sum("amount"))["total"] or Decimal("0.00")
            ke = KassaTransaction.objects.filter(
                kassa=k, transaction_type__in=["expense", "transfer_out"],
                created_at__date=today
            ).aggregate(total=Sum("amount"))["total"] or Decimal("0.00")
            kassa_incomes.append((k, ki))
            kassa_expenses.append((k, ke))
        if kassa_incomes:
            top_income_kassa = max(kassa_incomes, key=lambda x: x[1])
        if kassa_expenses:
            top_expense_kassa = max(kassa_expenses, key=lambda x: x[1])

    recent_ops = KassaTransaction.objects.select_related("kassa", "kassa__owner").order_by("-created_at")
    if not is_superadmin:
        recent_ops = recent_ops.filter(kassa__owner=user)
    recent_ops = recent_ops[:15]

    payment_methods_list = list(PaymentMethod.objects.filter(is_active=True))
    kassa_cards = []
    for k in kassalar:
        last_op = k.last_operation
        kassa_cards.append({
            "kassa": k,
            "balance": k.balance,
            "today_income": k.today_income,
            "today_expense": k.today_expense,
            "income_breakdown": k.all_income_breakdown(),
            "expense_breakdown": k.all_expense_breakdown(),
            "total_income": k.total_income,
            "total_expense": k.total_expense,
            "last_operation": last_op,
        })

    return render(request, "kassa/dashboard.html", {
        "kassalar": kassa_cards,
        "barcha_kassalar": Kassa.objects.select_related("owner").filter(is_active=True),
        "total_balance": total_balance,
        "today_income": today_income,
        "today_expense": today_expense,
        "today_payment_total": today_payment_total,
        "top_income_kassa": top_income_kassa,
        "top_expense_kassa": top_expense_kassa,
        "recent_ops": recent_ops,
        "is_superadmin": is_superadmin,
        "payment_methods": payment_methods_list,
        "expense_categories": ExpenseCategory.objects.all(),
    })


@login_required(login_url="login")
def kassa_dashboard_export_excel(request):
    user = request.user
    is_superadmin = _is_superadmin(user)

    import openpyxl
    from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
    from openpyxl.utils import get_column_letter

    wb = openpyxl.Workbook()

    # ---- Sheet 1: Kassalar ----
    ws = wb.active
    ws.title = "Kassalar"
    header_font = Font(bold=True, color="FFFFFF", size=11)
    header_fill = PatternFill(start_color="2001FF", end_color="2001FF", fill_type="solid")
    thin_border = Border(
        left=Side(style="thin"), right=Side(style="thin"),
        top=Side(style="thin"), bottom=Side(style="thin"),
    )
    center = Alignment(horizontal="center", vertical="center", wrap_text=True)

    headers = ["#", "Kassa nomi", "Egasi", "Holati", "Balans", "Bugungi kirim", "Bugungi chiqim", "Jami kirim", "Jami chiqim", "Oxirgi operatsiya"]
    for col, h in enumerate(headers, 1):
        c = ws.cell(row=1, column=col, value=h)
        c.font = header_font
        c.fill = header_fill
        c.alignment = center
        c.border = thin_border

    if _is_superadmin(user):
        kassalar = Kassa.objects.select_related("owner").all()
    else:
        kassalar = Kassa.objects.select_related("owner").filter(owner=user)

    for i, k in enumerate(kassalar, 1):
        row = i + 1
        ws.cell(row=row, column=1, value=i).border = thin_border
        ws.cell(row=row, column=2, value=k.name).border = thin_border
        ws.cell(row=row, column=3, value=k.owner.get_full_name() or k.owner.username if k.owner else "").border = thin_border
        ws.cell(row=row, column=4, value="Faol" if k.is_active else "Nofaol").border = thin_border
        ws.cell(row=row, column=5, value=float(k.balance)).border = thin_border
        ws.cell(row=row, column=6, value=float(k.today_income)).border = thin_border
        ws.cell(row=row, column=7, value=float(k.today_expense)).border = thin_border
        ws.cell(row=row, column=8, value=float(k.total_income)).border = thin_border
        ws.cell(row=row, column=9, value=float(k.total_expense)).border = thin_border
        ws.cell(row=row, column=10, value=str(k.last_operation.created_at.strftime("%d.%m.%Y %H:%M")) if k.last_operation else "").border = thin_border

    for col in range(1, len(headers) + 1):
        ws.column_dimensions[get_column_letter(col)].width = 20

    # ---- Sheet 2: Oxirgi operatsiyalar ----
    ws2 = wb.create_sheet("Oxirgi operatsiyalar")
    headers2 = ["Sana", "Kassa", "Turi", "Summa", "To'lov usuli", "Kategoriya", "Izoh", "Bajaruvchi"]
    for col, h in enumerate(headers2, 1):
        c = ws2.cell(row=1, column=col, value=h)
        c.font = header_font
        c.fill = header_fill
        c.alignment = center
        c.border = thin_border

    type_labels = {
        "payment": "To'lov", "income": "Kirim", "expense": "Chiqim",
        "transfer_in": "O'tkazma (k)", "transfer_out": "O'tkazma (ch)", "refund": "Qaytarish",
    }

    ops = KassaTransaction.objects.select_related("kassa").order_by("-created_at")[:100]
    for i, op in enumerate(ops, 1):
        row = i + 1
        ws2.cell(row=row, column=1, value=op.created_at.strftime("%d.%m.%Y %H:%M")).border = thin_border
        ws2.cell(row=row, column=2, value=op.kassa.name).border = thin_border
        ws2.cell(row=row, column=3, value=type_labels.get(op.transaction_type, op.transaction_type)).border = thin_border
        ws2.cell(row=row, column=4, value=float(op.amount)).border = thin_border
        ws2.cell(row=row, column=5, value=op.payment_method or "").border = thin_border
        ws2.cell(row=row, column=6, value=op.get_expense_category_display() if op.expense_category else "").border = thin_border
        ws2.cell(row=row, column=7, value=op.description or "").border = thin_border
        ws2.cell(row=row, column=8, value=op.created_by or "").border = thin_border

    for col in range(1, len(headers2) + 1):
        ws2.column_dimensions[get_column_letter(col)].width = 22

    response = HttpResponse(
        content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )
    response["Content-Disposition"] = 'attachment; filename="kassa_dashboard.xlsx"'
    wb.save(response)
    return response


@login_required(login_url="login")
def kassa_list(request):
    user = request.user
    is_superadmin = _is_superadmin(user)

    if is_superadmin:
        kassalar = Kassa.objects.select_related("owner").all()
    else:
        kassalar = Kassa.objects.select_related("owner").filter(owner=user)

    kassa_cards = []
    for k in kassalar:
        last_op = k.last_operation
        kassa_cards.append({
            "kassa": k,
            "balance": k.balance,
            "today_income": k.today_income,
            "today_expense": k.today_expense,
            "income_breakdown": k.all_income_breakdown(),
            "expense_breakdown": k.all_expense_breakdown(),
            "total_income": k.total_income,
            "total_expense": k.total_expense,
            "last_operation": last_op,
        })

    return render(request, "kassa/list.html", {
        "kassalar": kassa_cards,
        "is_superadmin": is_superadmin,
    })


@login_required(login_url="login")
def kassa_detail(request, pk):
    user = request.user
    is_superadmin = _is_superadmin(user)

    kassa = get_object_or_404(Kassa.objects.select_related("owner"), pk=pk)
    if not is_superadmin and kassa.owner != user:
        messages.error(request, "Sizning kassangiz emas!")
        return redirect("kassa_list")

    filter_form = KassaFilterForm(request.GET or None)
    transactions = KassaTransaction.objects.filter(kassa=kassa).select_related("student")

    date_from = request.GET.get("date_from")
    date_to = request.GET.get("date_to")
    tx_type = request.GET.get("transaction_type")
    amount_min = request.GET.get("amount_min")
    amount_max = request.GET.get("amount_max")
    search = request.GET.get("search", "").strip()
    filter_payment_method = request.GET.get("payment_method", "").strip()

    if date_from:
        transactions = transactions.filter(created_at__date__gte=date_from)
    if date_to:
        transactions = transactions.filter(created_at__date__lte=date_to)
    if tx_type:
        transactions = transactions.filter(transaction_type=tx_type)
    if filter_payment_method:
        transactions = transactions.filter(payment_method__iexact=filter_payment_method)
    if amount_min:
        try:
            transactions = transactions.filter(amount__gte=Decimal(amount_min))
        except Exception:
            pass
    if amount_max:
        try:
            transactions = transactions.filter(amount__lte=Decimal(amount_max))
        except Exception:
            pass
    if search:
        transactions = transactions.filter(
            Q(description__icontains=search) |
            Q(created_by__icontains=search) |
            Q(student__first_name__icontains=search) |
            Q(student__last_name__icontains=search)
        )

    all_tx = KassaTransaction.objects.filter(kassa=kassa)

    payment_method_balances = {}
    for pm in PaymentMethod.objects.filter(is_active=True):
        pm_income = all_tx.filter(
            transaction_type__in=["payment", "income", "transfer_in"],
            payment_method__iexact=pm.name
        ).aggregate(total=Sum("amount"))["total"] or Decimal("0.00")
        pm_expense = all_tx.filter(
            transaction_type__in=["expense", "transfer_out"],
            payment_method__iexact=pm.name
        ).aggregate(total=Sum("amount"))["total"] or Decimal("0.00")
        payment_method_balances[pm.name] = {
            "income": pm_income,
            "expense": pm_expense,
            "balance": pm_income - pm_expense,
            "icon": pm.icon,
            "color": pm.color,
        }

    monthly_data = []
    months = all_tx.dates("created_at", "month", order="DESC")
    for m in months:
        m_tx = all_tx.filter(created_at__year=m.year, created_at__month=m.month)
        m_income = m_tx.filter(transaction_type__in=["payment", "income", "transfer_in"]).aggregate(s=Sum("amount"))["s"] or Decimal("0")
        m_expense = m_tx.filter(transaction_type__in=["expense", "transfer_out"]).aggregate(s=Sum("amount"))["s"] or Decimal("0")
        days_data = []
        for d in m_tx.dates("created_at", "day", order="ASC"):
            d_tx = all_tx.filter(created_at__date=d)
            d_income = d_tx.filter(transaction_type__in=["payment", "income", "transfer_in"]).aggregate(s=Sum("amount"))["s"] or Decimal("0")
            d_expense = d_tx.filter(transaction_type__in=["expense", "transfer_out"]).aggregate(s=Sum("amount"))["s"] or Decimal("0")
            days_data.append({
                "date": d,
                "income": d_income,
                "expense": d_expense,
                "count": d_tx.count(),
            })
        month_name_uz = {
            1: "Yanvar", 2: "Fevral", 3: "Mart", 4: "Aprel",
            5: "May", 6: "Iyun", 7: "Iyul", 8: "Avgust",
            9: "Sentyabr", 10: "Oktabr", 11: "Noyabr", 12: "Dekabr",
        }
        monthly_data.append({
            "year": m.year,
            "month": m.month,
            "month_name": f"{month_name_uz.get(m.month, '')} {m.year}",
            "income": m_income,
            "expense": m_expense,
            "net": m_income - m_expense,
            "days": days_data,
        })

    paginator = Paginator(transactions, 25)
    page = request.GET.get("page")
    transactions = paginator.get_page(page)

    balance = kassa.balance

    income_form = KassaIncomeForm()
    expense_form = KassaExpenseForm()
    transfer_form = KassaTransferForm(exclude_kassa=kassa)

    active_payment_methods = list(PaymentMethod.objects.filter(is_active=True).values_list("name", flat=True))

    import json
    all_kassa_pm_balances = {}
    for k in Kassa.objects.filter(is_active=True):
        k_tx = KassaTransaction.objects.filter(kassa=k)
        k_pm = {}
        for pm_name in active_payment_methods:
            k_inc = k_tx.filter(transaction_type__in=["payment", "income", "transfer_in"], payment_method__iexact=pm_name).aggregate(s=Sum("amount"))["s"] or Decimal("0")
            k_exp = k_tx.filter(transaction_type__in=["expense", "transfer_out"], payment_method__iexact=pm_name).aggregate(s=Sum("amount"))["s"] or Decimal("0")
            k_pm[pm_name] = float(k_inc - k_exp)
        all_kassa_pm_balances[str(k.pk)] = k_pm

    employees_data = []
    for emp in Employee.objects.filter(is_deleted=False, is_active=True).order_by("first_name", "last_name"):
        tb = get_or_create_teacher_balance(emp)
        monthly = (emp.monthly_salary or Decimal('0.00')) > 0
        percent = (emp.percent or Decimal('0.00')) > 0
        is_monthly_emp = emp.salary_type == Employee.SalaryType.MONTHLY
        if is_monthly_emp:
            advance_limit = float(emp.monthly_salary or 0) if monthly else None
        else:
            advance_limit = float(max(tb.balance, Decimal('0.00'))) if percent else None
        employees_data.append({
            "id": emp.pk,
            "name": f"{emp.first_name} {emp.last_name}".strip(),
            "balance": float(tb.balance),
            "avans_balance": float(tb.avans_balance),
            "salary_type": emp.salary_type,
            "monthly_salary": float(emp.monthly_salary or 0),
            "percent": float(emp.percent or 0),
            "has_income": is_monthly_emp or percent,
            "advance_limit": advance_limit,
        })
    employees_json = json.dumps(employees_data)

    return render(request, "kassa/detail.html", {
        "kassa": kassa,
        "balance": balance,
        "transactions": transactions,
        "filter_form": filter_form,
        "income_form": income_form,
        "expense_form": expense_form,
        "transfer_form": transfer_form,
        "is_superadmin": is_superadmin,
        "income_breakdown": kassa.all_income_breakdown(),
        "expense_breakdown": kassa.all_expense_breakdown(),
        "total_income": kassa.total_income,
        "total_expense": kassa.total_expense,
        "payment_methods": PaymentMethod.objects.filter(is_active=True),
        "expense_categories": ExpenseCategory.objects.all(),
        "payment_method_balances": payment_method_balances,
        "monthly_data": monthly_data,
        "filter_payment_method": filter_payment_method,
        "active_payment_methods": active_payment_methods,
        "all_kassa_pm_balances": json.dumps(all_kassa_pm_balances),
        "income_categories": IncomeCategory.objects.filter(is_active=True),
        "employees_json": employees_json,
    })


@login_required(login_url="login")
def kassa_create(request):
    if not _is_superadmin(request.user):
        messages.error(request, "Faqat Super Admin kassa yaratishi mumkin!")
        return redirect("kassa_list")

    form = KassaForm()
    if request.method == "POST":
        form = KassaForm(request.POST)
        if form.is_valid():
            kassa = form.save()
            messages.success(request, f"'{kassa.name}' kassasi muvaffaqiyatli yaratildi")
            return redirect("kassa_list")
    return render(request, "kassa/form.html", {"form": form, "title": "Kassa qo'shish"})


@login_required(login_url="login")
def kassa_update(request, pk):
    if not _is_superadmin(request.user):
        messages.error(request, "Faqat Super Admin kassani tahrirlashi mumkin!")
        return redirect("kassa_list")

    kassa = get_object_or_404(Kassa, pk=pk)
    form = KassaForm(instance=kassa)
    if request.method == "POST":
        form = KassaForm(request.POST, instance=kassa)
        if form.is_valid():
            form.save()
            messages.success(request, "Kassa muvaffaqiyatli yangilandi")
            return redirect("kassa_list")
    return render(request, "kassa/form.html", {"form": form, "title": "Kassani tahrirlash"})


@login_required(login_url="login")
def kassa_delete(request, pk):
    if not _is_superadmin(request.user):
        messages.error(request, "Faqat Super Admin kassani o'chirishi mumkin!")
        return redirect("kassa_list")

    kassa = get_object_or_404(Kassa, pk=pk)

    balance = kassa.balance
    if balance != 0:
        messages.error(
            request,
            f"'{kassa.name}' kassasida {balance:,.0f} so'm mablag' bor! "
            "Kassa o'chirilmaydi. Avval ichidagi barcha pullarni chiqim qiling "
            "yoki boshqa kassaga o'tkazing.",
        )
        return redirect("kassa_list")

    if request.method == "POST":
        name = kassa.name
        kassa.delete()
        messages.success(request, f"'{name}' kassasi o'chirildi (faolligi bekor qilindi)")
        return redirect("kassa_list")
    return render(request, "kassa/delete.html", {
        "object": kassa,
        "title": "Kassani o'chirish",
        "object_balance": balance,
    })


@login_required(login_url="login")
def kassa_add_income(request, pk):
    user = request.user
    kassa = get_object_or_404(Kassa, pk=pk)
    is_superadmin = _is_superadmin(user)

    if not is_superadmin and kassa.owner != user:
        messages.error(request, "Sizning kassangiz emas!")
        return redirect("kassa_list")

    if request.method != "POST":
        return redirect("kassa_detail", pk=pk)

    form = KassaIncomeForm(request.POST)
    if form.is_valid():
        amount = form.cleaned_data["amount"]
        description = form.cleaned_data["description"]
        income_category = form.cleaned_data.get("income_category", "")
        custom_category = request.POST.get("custom_income_category", "").strip()
        payment_method = request.POST.get("payment_method", "").strip()
        balance_before = kassa.balance

        if income_category == "boshqa" and custom_category:
            final_income_category = custom_category
        elif income_category:
            final_income_category = income_category
        else:
            final_income_category = ""

        KassaTransaction.objects.create(
            kassa=kassa,
            transaction_type=KassaTransaction.TransactionType.INCOME,
            amount=amount,
            balance_before=balance_before,
            balance_after=balance_before + amount,
            description=description,
            payment_method=payment_method,
            income_category=final_income_category,
            created_by=_employee_name(user),
            created_by_user=user,
        )
        messages.success(request, f"{amount:,.0f} so'm kirim qilindi")
    else:
        messages.error(request, "Xatolik yuz berdi. Summa va sababni kiriting.")

    return redirect("kassa_detail", pk=pk)


@login_required(login_url="login")
def kassa_add_expense(request, pk):
    user = request.user
    kassa = get_object_or_404(Kassa, pk=pk)
    is_superadmin = _is_superadmin(user)

    def _fail(msg):
        if _wants_json(request):
            return JsonResponse({"success": False, "error": msg})
        messages.error(request, msg)
        return redirect("kassa_detail", pk=pk)

    if not is_superadmin and kassa.owner != user:
        return _fail("Sizning kassangiz emas!")

    if not has_permission(user, "expense.regular"):
        return _fail("Sizga oddiy chiqim qilishga ruxsat berilmagan.")

    if request.method != "POST":
        return redirect("kassa_detail", pk=pk)

    form = KassaExpenseForm(request.POST)
    if form.is_valid():
        amount = form.cleaned_data["amount"]
        description = form.cleaned_data["description"]
        expense_category = form.cleaned_data.get("expense_category", "")
        custom_category = form.cleaned_data.get("custom_category", "").strip()
        payment_method = request.POST.get("payment_method", "").strip()
        balance_before = kassa.balance

        if balance_before < amount:
            return _fail(f"Kassada yetarli mablag' yo'q! Balans: {balance_before:,.0f} so'm")

        if expense_category == "boshqa" and custom_category:
            final_category = custom_category
        elif expense_category:
            final_category = expense_category
        else:
            final_category = ""

        KassaTransaction.objects.create(
            kassa=kassa,
            transaction_type=KassaTransaction.TransactionType.EXPENSE,
            amount=amount,
            balance_before=balance_before,
            balance_after=balance_before - amount,
            expense_category=final_category,
            payment_method=payment_method,
            description=description,
            created_by=_employee_name(user),
            created_by_user=user,
        )
        msg = f"{amount:,.0f} so'm chiqim qilindi"
        if _wants_json(request):
            return JsonResponse({"success": True, "message": msg})
        messages.success(request, msg)
    else:
        return _fail("Xatolik yuz berdi. Summa va sababni kiriting.")

    return redirect("kassa_detail", pk=pk)


@login_required(login_url="login")
def kassa_add_employee_payout(request, pk):
    """Xodimga oylik (salary) yoki avans (advance) berish.

    Ikki operatsiya bitta transaction ichida bajariladi:
    1. Xodim balansidan summa ayriladi.
    2. Kassa chiqimi yaratiladi.

    Xavfsizlik: backendda ham balanslar tekshiriladi, xodim balansi
    hech qachon minusga tushmaydi. Biror qadam xatoga uchrasa hammasi bekor qilinadi.
    """
    user = request.user
    kassa = get_object_or_404(Kassa, pk=pk)
    is_superadmin = _is_superadmin(user)

    def _fail(msg):
        if _wants_json(request):
            return JsonResponse({"success": False, "error": msg})
        messages.error(request, msg)
        return redirect("kassa_detail", pk=pk)

    if not is_superadmin and kassa.owner != user:
        return _fail("Sizning kassangiz emas!")

    if request.method != "POST":
        return redirect("kassa_detail", pk=pk)

    employee_id = request.POST.get("employee_id")
    salary_type = request.POST.get("salary_type", "")
    payment_method = request.POST.get("payment_method", "").strip()
    description = request.POST.get("description", "").strip()
    raw_amount = request.POST.get("amount", "").strip()

    if salary_type not in ("salary", "advance"):
        return _fail("Noto'g'ri berish turi! Oylik yoki avansni tanlang.")

    required_perm = "expense.salary" if salary_type == "salary" else "expense.advance"
    if not has_permission(user, required_perm):
        return _fail("Sizga bu turdagi chiqim qilishga ruxsat berilmagan.")

    salary_type_label = "Oylik" if salary_type == "salary" else "Avans"

    if not employee_id:
        return _fail("Xodimni tanlang!")

    employee = Employee.objects.filter(pk=employee_id, is_deleted=False).first()
    if not employee:
        return _fail("Xodim topilmadi!")

    emp_name = f"{employee.first_name} {employee.last_name}".strip()
    monthly_employee = (
        employee.salary_type == Employee.SalaryType.MONTHLY
        and (employee.monthly_salary or Decimal('0.00')) > 0
    )

    try:
        with transaction.atomic():
            balance = get_or_create_teacher_balance(employee)
            balance_obj = TeacherBalance.objects.select_for_update().get(pk=balance.pk)

            kassa_balance = kassa.balance
            if kassa_balance < 0:
                raise ValueError("Kassa balansi manfiy!")

            if salary_type == "advance":
                # Avans — oddiy chiqim emas: xodimning daromad mexanizmi (belgilangan
                # oylik yoki foiz) mavjud bo'lsa beriladi. Avans qarzi hisobga o'sadi,
                # oylik balansiga ta'sir qilmaydi.
                has_income = (
                    employee.salary_type == Employee.SalaryType.MONTHLY
                    or (employee.percent or Decimal('0.00')) > 0
                )
                if not has_income:
                    raise ValueError("Xodimga oylik yoki foiz belgilanmagan. Avans berish mumkin emas.")
                try:
                    amount = Decimal(raw_amount.replace(" ", "").replace("'", ""))
                except Exception:
                    raise ValueError("Noto'g'ri summa kiritildi!")
                if amount <= 0:
                    raise ValueError("Summa musbat son bo'lishi kerak!")
                if (
                    employee.salary_type == Employee.SalaryType.MONTHLY
                    and (employee.monthly_salary or Decimal('0.00')) > 0
                ):
                    advance_limit = Decimal(employee.monthly_salary) - balance_obj.avans_balance
                elif (employee.percent or Decimal('0.00')) > 0:
                    advance_limit = balance_obj.balance - balance_obj.avans_balance
                else:
                    advance_limit = None
                if advance_limit is not None and amount > advance_limit:
                    raise ValueError(
                        f"Avans limiti oshib ketdi. Berish mumkin: {max(advance_limit, Decimal('0.00')):,.0f} so'm "
                        f"(mavjud avans qarzi: {balance_obj.avans_balance:,.0f} so'm)"
                    )
                if kassa_balance < amount:
                    raise ValueError(
                        f"Kassada yetarli mablag' yo'q! Balans: {kassa_balance:,.0f} so'm"
                    )
                add_teacher_balance_transaction(
                    employee,
                    amount,
                    TeacherTransaction.Type.ADVANCE,
                    description=description or f"Avans berildi",
                    created_by=_employee_name(user),
                    payment_method=payment_method,
                    salary_type=salary_type,
                    avans_amount=amount,
                    affect_balance=False,
                )
                new_avans = balance_obj.avans_balance + amount
                new_balance = balance_obj.balance
                kassa_amount = amount
            elif monthly_employee:
                # Belgilangan oylik maosh (Administrator/Support).
                # Beriladigan summa: oylik - (avansdan ushlab qolinsa avans qarzi).
                # Avans qarzi oylikdan katta bo'lsa, faqat oylik miqdori yopiladi,
                # qolgan qarz keyingi davrga o'tadi.
                monthly_salary = Decimal(employee.monthly_salary)
                avans = balance_obj.avans_balance
                deduct_avans = request.POST.get("deduct_avans") == "on"
                if deduct_avans and avans > 0:
                    deduction = min(avans, monthly_salary)
                    beriladigan = monthly_salary - deduction
                    new_avans = avans - deduction
                else:
                    deduction = Decimal('0.00')
                    beriladigan = monthly_salary
                    new_avans = avans
                if beriladigan <= 0:
                    raise ValueError(
                        f"{emp_name} uchun beriladigan oylik 0 so'm "
                        f"(avans qarzi oylikdan katta yoki teng: {avans:,.0f} so'm). "
                        "Qolgan qarz keyingi davrga o'tadi."
                    )
                if kassa_balance < beriladigan:
                    raise ValueError(
                        f"Kassada yetarli mablag' yo'q! Balans: {kassa_balance:,.0f} so'm"
                    )
                add_teacher_balance_transaction(
                    employee,
                    -beriladigan,
                    TeacherTransaction.Type.PAYOUT,
                    description=description or f"{salary_type_label} berildi",
                    created_by=_employee_name(user),
                    payment_method=payment_method,
                    salary_type=salary_type,
                    affect_balance=False,
                    avans_amount=-deduction if deduction > 0 else None,
                )
                new_balance = balance_obj.balance
                amount = beriladigan
                kassa_amount = beriladigan
            else:
                # O'qituvchi foiz balansidan oylik (mavjud tizim, o'zgartirilmaydi).
                try:
                    amount = Decimal(raw_amount.replace(" ", "").replace("'", ""))
                except Exception:
                    raise ValueError("Noto'g'ri summa kiritildi!")
                if amount <= 0:
                    raise ValueError("Summa musbat son bo'lishi kerak!")
                if kassa_balance < amount:
                    raise ValueError(
                        f"Kassada yetarli mablag' yo'q! Balans: {kassa_balance:,.0f} so'm"
                    )
                if balance_obj.balance < amount:
                    raise ValueError(
                        f"Oylik balansi yetarli emas. Mavjud oylik balansi: {balance_obj.balance:,.0f} so'm. "
                        f"({emp_name})"
                    )
                add_teacher_balance_transaction(
                    employee,
                    -amount,
                    TeacherTransaction.Type.PAYOUT,
                    description=description or f"{salary_type_label} berildi",
                    created_by=_employee_name(user),
                    payment_method=payment_method,
                    salary_type=salary_type,
                )
                new_balance = balance_obj.balance - amount
                new_avans = balance_obj.avans_balance
                kassa_amount = amount

            KassaTransaction.objects.create(
                kassa=kassa,
                transaction_type=KassaTransaction.TransactionType.EXPENSE,
                amount=kassa_amount,
                balance_before=kassa_balance,
                balance_after=kassa_balance - kassa_amount,
                expense_category=KassaTransaction.ExpenseCategory.SALARY,
                salary_type=salary_type,
                payment_method=payment_method,
                description=description or f"Xodimga {salary_type_label}: {emp_name}",
                employee=employee,
                created_by=_employee_name(user),
                created_by_user=user,
            )
    except ValueError as exc:
        return _fail(str(exc))
    except Exception:
        return _fail("Xatolik yuz berdi. Operatsiya bekor qilindi, hech qanday o'zgarish saqlanmadi.")

    if salary_type == "advance":
        msg = (
            f"{amount:,.0f} so'm avans berildi: {emp_name} "
            f"(avans qarzi: {new_avans:,.0f} so'm)"
        )
    elif monthly_employee:
        msg = (
            f"Oylik: {float(employee.monthly_salary):,.0f} so'm, "
            f"avansdan ushlandi: {float(deduction):,.0f} so'm, "
            f"beriladi: {amount:,.0f} so'm — {emp_name} "
            f"(qolgan avans qarzi: {new_avans:,.0f} so'm)"
        )
    else:
        msg = (
            f"{amount:,.0f} so'm oylik berildi: {emp_name} "
            f"(qolgan oylik balansi: {new_balance:,.0f} so'm)"
        )
    if _wants_json(request):
        return JsonResponse({"success": True, "message": msg})
    messages.success(request, msg)
    return redirect("kassa_detail", pk=pk)


@login_required(login_url="login")
def kassa_employee_advance_close(request, pk):
    """Avans yopish — alohida amal.

    Xodimning avans qarzi (avans_balance) oylik balansidan (balance) ayirilib yopiladi.
    Kassaga chiqim yozilmaydi (avans puli avval berilgan bo'lgan).
    """
    user = request.user
    kassa = get_object_or_404(Kassa, pk=pk)
    is_superadmin = _is_superadmin(user)

    def _fail(msg):
        if _wants_json(request):
            return JsonResponse({"success": False, "error": msg})
        messages.error(request, msg)
        return redirect("kassa_detail", pk=pk)

    if not is_superadmin and kassa.owner != user:
        return _fail("Sizning kassangiz emas!")

    if not has_permission(user, "expense.advance_close"):
        return _fail("Sizga avans yopishga ruxsat berilmagan.")

    if request.method != "POST":
        return redirect("kassa_detail", pk=pk)

    employee_id = request.POST.get("employee_id")
    raw_amount = request.POST.get("amount", "").strip()
    description = request.POST.get("description", "").strip()

    if not employee_id:
        return _fail("Xodimni tanlang!")

    employee = Employee.objects.filter(pk=employee_id, is_deleted=False).first()
    if not employee:
        return _fail("Xodim topilmadi!")

    try:
        amount = Decimal(raw_amount.replace(" ", "").replace("'", ""))
    except Exception:
        return _fail("Noto'g'ri summa kiritildi!")

    if amount <= 0:
        return _fail("Summa musbat son bo'lishi kerak!")

    emp_name = f"{employee.first_name} {employee.last_name}".strip()

    try:
        with transaction.atomic():
            balance = get_or_create_teacher_balance(employee)
            balance_obj = TeacherBalance.objects.select_for_update().get(pk=balance.pk)
            if balance_obj.avans_balance <= 0:
                raise ValueError(f"{emp_name} da yopiladigan avans qarzi mavjud emas.")
            if amount > balance_obj.avans_balance:
                raise ValueError(
                    f"Avans qarzdan ortiq summa yopish mumkin emas. Mavjud qarz: {balance_obj.avans_balance:,.0f} so'm"
                )
            if amount > balance_obj.balance:
                raise ValueError(
                    f"Oylik balansi yetarli emas. Mavjud oylik balansi: {balance_obj.balance:,.0f} so'm. "
                    f"({emp_name})"
                )

            add_teacher_balance_transaction(
                employee,
                -amount,
                TeacherTransaction.Type.ADVANCE_CLOSE,
                description=description or "Avans yopildi",
                created_by=_employee_name(user),
                salary_type="advance",
                avans_amount=-amount,
            )
            new_balance = balance_obj.balance - amount
            new_avans = balance_obj.avans_balance - amount
    except ValueError as exc:
        return _fail(str(exc))
    except Exception:
        return _fail("Xatolik yuz berdi. Operatsiya bekor qilindi, hech qanday o'zgarish saqlanmadi.")

    msg = (
        f"{amount:,.0f} so'm avans yopildi: {emp_name} "
        f"(qolgan qarz: {new_avans:,.0f} so'm, oylik balansi: {new_balance:,.0f} so'm)"
    )
    if _wants_json(request):
        return JsonResponse({"success": True, "message": msg})
    messages.success(request, msg)
    return redirect("kassa_detail", pk=pk)


@login_required(login_url="login")
def kassa_transfer(request, pk):
    user = request.user
    from_kassa = get_object_or_404(Kassa, pk=pk)
    is_superadmin = _is_superadmin(user)

    if not is_superadmin and from_kassa.owner != user:
        messages.error(request, "Sizning kassangiz emas!")
        return redirect("kassa_list")

    if request.method != "POST":
        return redirect("kassa_detail", pk=pk)

    form = KassaTransferForm(request.POST, exclude_kassa=from_kassa)
    if form.is_valid():
        to_kassa = form.cleaned_data["to_kassa"]
        amount = form.cleaned_data["amount"]
        payment_method = request.POST.get("payment_method", "").strip()
        to_payment_method = request.POST.get("to_payment_method", "").strip()
        description = form.cleaned_data["description"] or f"Kassa o'tkazma: {from_kassa.name} → {to_kassa.name}"

        if payment_method:
            from .models import PaymentMethod
            active_pms = list(PaymentMethod.objects.filter(is_active=True).values_list("name", flat=True))
            k_tx = KassaTransaction.objects.filter(kassa=from_kassa)
            pm_inc = k_tx.filter(transaction_type__in=["payment", "income", "transfer_in"], payment_method__iexact=payment_method).aggregate(s=Sum("amount"))["s"] or Decimal("0")
            pm_exp = k_tx.filter(transaction_type__in=["expense", "transfer_out"], payment_method__iexact=payment_method).aggregate(s=Sum("amount"))["s"] or Decimal("0")
            pm_balance = pm_inc - pm_exp
            if pm_balance < amount:
                messages.error(request, f"'{payment_method}' to'lov turida {pm_balance:,.0f} so'm bor, {amount:,.0f} so'm yetarli emas!")
                return redirect("kassa_detail", pk=pk)
        else:
            if from_kassa.balance < amount:
                messages.error(request, f"Kassada yetarli mablag' yo'q! Balans: {from_kassa.balance:,.0f} so'm")
                return redirect("kassa_detail", pk=pk)

        balance_before_from = from_kassa.balance
        balance_before_to = to_kassa.balance

        KassaTransaction.objects.create(
            kassa=from_kassa,
            transaction_type=KassaTransaction.TransactionType.TRANSFER_OUT,
            amount=amount,
            balance_before=balance_before_from,
            balance_after=balance_before_from - amount,
            description=description,
            payment_method=payment_method,
            created_by=_employee_name(user),
            created_by_user=user,
        )

        KassaTransaction.objects.create(
            kassa=to_kassa,
            transaction_type=KassaTransaction.TransactionType.TRANSFER_IN,
            amount=amount,
            balance_before=balance_before_to,
            balance_after=balance_before_to + amount,
            description=description,
            payment_method=to_payment_method or payment_method,
            created_by=_employee_name(user),
            created_by_user=user,
        )

        KassaTransfer.objects.create(
            from_kassa=from_kassa,
            to_kassa=to_kassa,
            amount=amount,
            description=description,
            created_by=_employee_name(user),
            created_by_user=user,
        )

        msg = f"{amount:,.0f} so'm"
        if payment_method:
            msg += f" '{payment_method}' turidan"
        msg += f" '{to_kassa.name}' ga o'tkazildi"
        if to_payment_method:
            msg += f" ({to_payment_method} sifatida)"
        messages.success(request, msg)
    else:
        messages.error(request, "Xatolik yuz berdi. Kassa va summani kiriting.")

    return redirect("kassa_detail", pk=pk)


@login_required(login_url="login")
def kassa_history(request):
    user = request.user
    is_superadmin = _is_superadmin(user)

    transactions = KassaTransaction.objects.select_related("kassa", "kassa__owner", "student", "employee").order_by("-created_at")

    if not is_superadmin:
        transactions = transactions.filter(kassa__owner=user)

    date_from = request.GET.get("date_from")
    date_to = request.GET.get("date_to")
    tx_type = request.GET.get("transaction_type")
    search = request.GET.get("search", "").strip()
    f_salary_type = request.GET.get("salary_type", "").strip()
    f_employee = request.GET.get("employee", "").strip()

    if date_from:
        transactions = transactions.filter(created_at__date__gte=date_from)
    if date_to:
        transactions = transactions.filter(created_at__date__lte=date_to)
    if tx_type:
        transactions = transactions.filter(transaction_type=tx_type)
    if f_salary_type:
        transactions = transactions.filter(salary_type=f_salary_type)
    if f_employee:
        try:
            transactions = transactions.filter(employee_id=int(f_employee))
        except Exception:
            pass
    if search:
        transactions = transactions.filter(
            Q(description__icontains=search) |
            Q(created_by__icontains=search) |
            Q(kassa__name__icontains=search) |
            Q(student__first_name__icontains=search) |
            Q(student__last_name__icontains=search) |
            Q(employee__first_name__icontains=search) |
            Q(employee__last_name__icontains=search)
        )

    employee_summary = None
    if f_employee:
        emp = Employee.objects.filter(pk=int(f_employee), is_deleted=False).first() if f_employee.isdigit() else None
        if emp:
            base = KassaTransaction.objects.filter(kassa__owner=user) if not is_superadmin else KassaTransaction.objects.all()
            base = base.filter(employee=emp)
            if date_from:
                base = base.filter(created_at__date__gte=date_from)
            if date_to:
                base = base.filter(created_at__date__lte=date_to)
            total_salary = base.filter(salary_type="salary").aggregate(s=Sum("amount"))["s"] or Decimal("0.00")
            total_advance = base.filter(salary_type="advance").aggregate(s=Sum("amount"))["s"] or Decimal("0.00")
            employee_summary = {
                "employee": emp,
                "total_salary": total_salary,
                "total_advance": total_advance,
                "total": total_salary + total_advance,
            }

    paginator = Paginator(transactions, 30)
    page = request.GET.get("page")
    transactions = paginator.get_page(page)

    return render(request, "kassa/history.html", {
        "transactions": transactions,
        "is_superadmin": is_superadmin,
        "employees": Employee.objects.filter(is_deleted=False, is_active=True).order_by("first_name", "last_name"),
        "f_salary_type": f_salary_type,
        "f_employee": f_employee,
        "employee_summary": employee_summary,
    })


@login_required(login_url="login")
def kassa_register_payment(request):
    """Talaba to'lovini kassaga qo'shish"""
    if request.method != "POST":
        return redirect("payment_create")

    kassa_id = request.POST.get("kassa_id")
    amount = request.POST.get("amount")
    student_id = request.POST.get("student_id")
    description = request.POST.get("description", "")
    payment_method = request.POST.get("payment_method", "naqd").strip()

    if not kassa_id or not amount:
        messages.error(request, "Kassa va summa majburiy!")
        return redirect("payment_create")

    try:
        kassa = Kassa.objects.get(pk=kassa_id)
    except Kassa.DoesNotExist:
        messages.error(request, "Kassa topilmadi!")
        return redirect("payment_create")

    user = request.user
    is_superadmin = _is_superadmin(user)
    user_kassa = Kassa.objects.filter(owner=user, is_active=True).first()
    if not user_kassa:
        messages.error(request, "Sizga kassa biriktirilmagan! To'lov qabul qilish uchun avval kassangiz bo'lishi kerak.")
        return redirect("payment_create")
    if kassa.owner != user:
        messages.error(request, "Bu kassa sizga tegishli emas!")
        return redirect("payment_create")

    try:
        amount = Decimal(amount)
    except Exception:
        messages.error(request, "Noto'g'ri summa!")
        return redirect("payment_create")

    balance_before = kassa.balance
    student = None
    if student_id:
        from .models import Student
        try:
            student = Student.objects.get(pk=student_id)
        except Student.DoesNotExist:
            pass

    student_info = ""
    if student:
        student_info = f" — {student.first_name} {student.last_name}"

    KassaTransaction.objects.create(
        kassa=kassa,
        transaction_type=KassaTransaction.TransactionType.PAYMENT,
        amount=amount,
        balance_before=balance_before,
        balance_after=balance_before + amount,
        description=description or f"To'lov qabul qilindi{student_info}",
        student=student,
        payment_method=payment_method,
        created_by=_employee_name(user),
        created_by_user=user,
    )

    messages.success(request, f"{amount:,.0f} so'm to'lov qabul qilindi")
    return redirect("kassa_detail", pk=kassa.pk)


@login_required(login_url="login")
def kassa_overview(request):
    """Umumiy kassa — barcha kassalarning umumiy ko'rinishi (faqat admin)"""
    user = request.user
    if not _is_superadmin(user):
        messages.error(request, "Faqat Admin umumiy kassani ko'ra oladi!")
        return redirect("kassa_dashboard")

    today = date.today()

    # --- Filters (default: joriy oy) ---
    f_year = request.GET.get("year") or str(today.year)
    f_month = request.GET.get("month") or str(today.month)
    f_day = request.GET.get("day")
    f_date_from = request.GET.get("date_from")
    f_date_to = request.GET.get("date_to")
    f_kassa = request.GET.get("kassa")
    f_search = request.GET.get("search", "").strip()
    show_inactive = request.GET.get("show_inactive") == "1"

    # Jadval uchun — faol yoki hammasi
    if show_inactive:
        kassalar = Kassa.objects.select_related("owner").all()
    else:
        kassalar = Kassa.objects.select_related("owner").filter(is_active=True)

    # Filter dropdown uchun — dropdownda ham faol, ham nofaol ko'rinadi
    kassalar_all = Kassa.objects.select_related("owner").all()

    # Apply date filters to transactions
    transactions = KassaTransaction.objects.select_related("kassa", "kassa__owner", "student")

    if f_kassa:
        transactions = transactions.filter(kassa_id=f_kassa)
        kassalar = kassalar.filter(pk=f_kassa)

    # Default: joriy oy bo'lsa, shu oyni filtrlash
    if f_year and f_month and not f_date_from and not f_day:
        try:
            transactions = transactions.filter(created_at__year=int(f_year), created_at__month=int(f_month))
        except Exception:
            pass

    if f_date_from:
        try:
            d = datetime.strptime(f_date_from, "%Y-%m-%d").date()
            transactions = transactions.filter(created_at__date__gte=d)
        except Exception:
            pass

    if f_date_to:
        try:
            d = datetime.strptime(f_date_to, "%Y-%m-%d").date()
            transactions = transactions.filter(created_at__date__lte=d)
        except Exception:
            pass
    elif f_day and f_year and f_month:
        try:
            y, m, d_day = int(f_year), int(f_month), int(f_day)
            transactions = transactions.filter(created_at__year=y, created_at__month=m, created_at__day=d_day)
        except Exception:
            pass

    # Search filter
    if f_search:
        transactions = transactions.filter(
            Q(description__icontains=f_search) |
            Q(created_by__icontains=f_search) |
            Q(student__first_name__icontains=f_search) |
            Q(student__last_name__icontains=f_search) |
            Q(payment_method__icontains=f_search)
        )

    # Compute stats from FILTERED transactions
    agg = transactions.aggregate(
        total_income=Sum("amount", filter=Q(transaction_type__in=["payment", "income", "transfer_in"])),
        total_expense=Sum("amount", filter=Q(transaction_type__in=["expense", "transfer_out", "refund"])),
    )
    total_income = agg["total_income"] or Decimal("0")
    total_expense = agg["total_expense"] or Decimal("0")
    total_balance = total_income - total_expense

    today_income_q = transactions.filter(created_at__date=today, transaction_type__in=["payment", "income", "transfer_in"])
    today_income = today_income_q.aggregate(s=Sum("amount"))["s"] or Decimal("0")

    # Income/expense by method (filtered)
    all_income_methods = {}
    all_expense_methods = {}
    income_by_method = transactions.filter(transaction_type__in=["payment", "income", "transfer_in"]).values("payment_method").annotate(s=Sum("amount"))
    expense_by_method = transactions.filter(transaction_type__in=["expense", "transfer_out", "refund"]).values("payment_method").annotate(s=Sum("amount"))
    for row in income_by_method:
        name = row["payment_method"] or "Noma'lum"
        all_income_methods[name] = row["s"]
    for row in expense_by_method:
        name = row["payment_method"] or "Noma'lum"
        all_expense_methods[name] = row["s"]

    # Kassa rows
    kassa_rows = []
    for k in kassalar:
        k_trans = transactions.filter(kassa=k)
        k_income = k_trans.filter(transaction_type__in=["payment", "income", "transfer_in"]).aggregate(s=Sum("amount"))["s"] or Decimal("0")
        k_expense = k_trans.filter(transaction_type__in=["expense", "transfer_out", "refund"]).aggregate(s=Sum("amount"))["s"] or Decimal("0")
        kassa_rows.append({
            "kassa": k,
            "balance": k_income - k_expense,
            "income_breakdown": dict(k_trans.filter(transaction_type__in=["payment", "income", "transfer_in"]).values_list("payment_method").annotate(s=Sum("amount")).values_list("payment_method", "s")),
            "total_income": k_income,
            "total_expense": k_expense,
        })

    recent_ops = transactions.order_by("-created_at")[:30]

    # Year list for filter
    from django.db.models import Min
    earliest = KassaTransaction.objects.aggregate(m=Min("created_at"))["m"]
    year_list = []
    if earliest:
        for y in range(earliest.year, today.year + 1):
            year_list.append(y)

    return render(request, "kassa/overview.html", {
        "kassalar": kassa_rows,
        "total_balance": total_balance,
        "all_income_methods": all_income_methods,
        "all_expense_methods": all_expense_methods,
        "total_income": total_income,
        "total_expense": total_expense,
        "today_income": today_income,
        "recent_ops": recent_ops,
        "payment_methods": PaymentMethod.objects.filter(is_active=True),
        "kassalar_list": kassalar_all,
        "year_list": year_list,
        "day_list": list(range(1, 32)),
        "today": today,
        "f_year": f_year or "",
        "f_month": f_month or "",
        "f_day": f_day or "",
        "f_date_from": f_date_from or "",
        "f_date_to": f_date_to or "",
        "f_kassa": f_kassa or "",
        "show_inactive": show_inactive,
        "f_search": f_search,
    })


# ===== PAYMENT METHOD MANAGEMENT =====

@login_required(login_url="login")
def payment_method_list(request):
    if not _is_superadmin(request.user):
        messages.error(request, "Faqat Admin to'lov usullarini boshqara oladi!")
        return redirect("kassa_dashboard")
    methods = PaymentMethod.objects.all()
    return render(request, "kassa/payment_methods.html", {"methods": methods})


@login_required(login_url="login")
def payment_method_create(request):
    if not _is_superadmin(request.user):
        messages.error(request, "Faqat Admin to'lov usuli qo'sha oladi!")
        return redirect("kassa_dashboard")
    if request.method == "POST":
        name = request.POST.get("name", "").strip()
        if not name:
            messages.error(request, "To'lov usuli nomi kiritilishi shart!")
            return redirect("payment_method_list")
        existing = PaymentMethod.all_objects.filter(name__iexact=name).first()
        if existing:
            if existing.is_active:
                messages.error(request, f"'{name}' nomli to'lov usuli allaqachon mavjud!")
                return redirect("payment_method_list")
            existing.is_active = True
            existing.save()
            messages.success(request, f"'{name}' to'lov usuli qayta faollashtirildi")
        else:
            PaymentMethod.objects.create(name=name)
            messages.success(request, f"'{name}' to'lov usuli qo'shildi")
        return redirect("payment_method_list")
    return redirect("payment_method_list")


@login_required(login_url="login")
def payment_method_toggle(request, pk):
    if not _is_superadmin(request.user):
        messages.error(request, "Faqat Admin o'zgartira oladi!")
        return redirect("kassa_dashboard")
    method = get_object_or_404(PaymentMethod.all_objects, pk=pk)
    method.is_active = not method.is_active
    method.save()
    status = "faollashtirildi" if method.is_active else "to'xtatildi"
    messages.success(request, f"'{method.name}' {status}")
    return redirect("payment_method_list")


@login_required(login_url="login")
def payment_method_delete(request, pk):
    if not _is_superadmin(request.user):
        messages.error(request, "Faqat Admin o'chira oladi!")
        return redirect("kassa_dashboard")
    method = get_object_or_404(PaymentMethod.all_objects, pk=pk)

    if request.method == "POST":
        name = method.name
        method.delete()
        messages.success(request, f"'{name}' to'lov usuli o'chirildi")
        return redirect("payment_method_list")

    return render(request, "kassa/delete.html", {"object": method, "title": "To'lov usulini o'chirish"})


@login_required(login_url="login")
def payment_method_edit(request, pk):
    if not _is_superadmin(request.user):
        messages.error(request, "Faqat Admin tahrirlay oladi!")
        return redirect("kassa_dashboard")
    method = get_object_or_404(PaymentMethod.all_objects, pk=pk)
    if request.method == "POST":
        name = request.POST.get("name", "").strip()
        if not name:
            messages.error(request, "Nomi bo'sh bo'lishi mumkin emas!")
            return redirect("payment_method_list")
        method.name = name
        method.save()
        messages.success(request, f"'{name}' to'lov usuli yangilandi")
        return redirect("payment_method_list")
    return render(request, "kassa/payment_method_form.html", {"method": method})


# ===== EXPENSE CATEGORY MANAGEMENT =====

@login_required(login_url="login")
def expense_category_list(request):
    if not _is_superadmin(request.user):
        messages.error(request, "Faqat Admin kategoriyalarni boshqara oladi!")
        return redirect("kassa_dashboard")
    categories = ExpenseCategory.all_objects.all()
    return render(request, "kassa/expense_categories.html", {"categories": categories})


@login_required(login_url="login")
def expense_category_create(request):
    if not _is_superadmin(request.user):
        messages.error(request, "Faqat Admin kategoriya qo'sha oladi!")
        return redirect("kassa_dashboard")
    if request.method == "POST":
        form = ExpenseCategoryForm(request.POST)
        if form.is_valid():
            name = form.cleaned_data["name"].strip()
            if ExpenseCategory.all_objects.filter(name__iexact=name).exists():
                messages.error(request, f"'{name}' nomli kategoriya allaqachon mavjud!")
                return redirect("expense_category_list")
            form.save()
            messages.success(request, f"'{name}' kategoriyasi qo'shildi")
            return redirect("expense_category_list")
        else:
            messages.error(request, "Xatolik! Kategoriya nomini kiriting.")
    return redirect("expense_category_list")


@login_required(login_url="login")
def expense_category_edit(request, pk):
    if not _is_superadmin(request.user):
        messages.error(request, "Faqat Admin tahrirlay oladi!")
        return redirect("kassa_dashboard")
    category = get_object_or_404(ExpenseCategory.all_objects, pk=pk)
    if request.method == "POST":
        form = ExpenseCategoryForm(request.POST, instance=category)
        if form.is_valid():
            name = form.cleaned_data["name"].strip()
            if ExpenseCategory.all_objects.filter(name__iexact=name).exclude(pk=pk).exists():
                messages.error(request, f"'{name}' nomli kategoriya allaqachon mavjud!")
                return redirect("expense_category_list")
            form.save()
            messages.success(request, f"'{name}' kategoriyasi yangilandi")
            return redirect("expense_category_list")
    return render(request, "kassa/expense_category_form.html", {"category": category})


@login_required(login_url="login")
def expense_category_toggle(request, pk):
    if not _is_superadmin(request.user):
        messages.error(request, "Faqat Admin o'zgartira oladi!")
        return redirect("kassa_dashboard")
    category = get_object_or_404(ExpenseCategory.all_objects, pk=pk)
    category.is_active = not category.is_active
    category.save()
    status = "faollashtirildi" if category.is_active else "to'xtatildi"
    messages.success(request, f"'{category.name}' {status}")
    return redirect("expense_category_list")


@login_required(login_url="login")
def expense_category_delete(request, pk):
    if not _is_superadmin(request.user):
        messages.error(request, "Faqat Admin o'chira oladi!")
        return redirect("kassa_dashboard")
    category = get_object_or_404(ExpenseCategory.all_objects, pk=pk)
    if request.method == "POST":
        name = category.name
        category.delete()
        messages.success(request, f"'{name}' kategoriyasi o'chirildi (faolligi bekor qilindi)")
        return redirect("expense_category_list")
    return render(request, "kassa/delete.html", {"object": category, "title": "Kategoriyani o'chirish"})


# ===== KIRIM KATEGORIYALARI =====

@login_required(login_url="login")
def income_category_list(request):
    if not _is_superadmin(request.user):
        messages.error(request, "Faqat Admin kategoriyalarni boshqara oladi!")
        return redirect("kassa_dashboard")
    categories = IncomeCategory.all_objects.all()
    return render(request, "kassa/income_categories.html", {"categories": categories})


@login_required(login_url="login")
def income_category_create(request):
    if not _is_superadmin(request.user):
        messages.error(request, "Faqat Admin kategoriya qo'sha oladi!")
        return redirect("kassa_dashboard")
    if request.method == "POST":
        form = IncomeCategoryForm(request.POST)
        if form.is_valid():
            name = form.cleaned_data["name"].strip()
            if IncomeCategory.all_objects.filter(name__iexact=name).exists():
                messages.error(request, f"'{name}' nomli kategoriya allaqachon mavjud!")
                return redirect("income_category_list")
            form.save()
            messages.success(request, f"'{name}' kategoriyasi qo'shildi")
            return redirect("income_category_list")
        else:
            messages.error(request, "Xatolik! Kategoriya nomini kiriting.")
    return redirect("income_category_list")


@login_required(login_url="login")
def income_category_edit(request, pk):
    if not _is_superadmin(request.user):
        messages.error(request, "Faqat Admin tahrirlay oladi!")
        return redirect("kassa_dashboard")
    category = get_object_or_404(IncomeCategory.all_objects, pk=pk)
    if request.method == "POST":
        form = IncomeCategoryForm(request.POST, instance=category)
        if form.is_valid():
            name = form.cleaned_data["name"].strip()
            if IncomeCategory.all_objects.filter(name__iexact=name).exclude(pk=pk).exists():
                messages.error(request, f"'{name}' nomli kategoriya allaqachon mavjud!")
                return redirect("income_category_list")
            form.save()
            messages.success(request, f"'{name}' kategoriyasi yangilandi")
            return redirect("income_category_list")
    return render(request, "kassa/income_category_form.html", {"category": category})


@login_required(login_url="login")
def income_category_toggle(request, pk):
    if not _is_superadmin(request.user):
        messages.error(request, "Faqat Admin o'zgartira oladi!")
        return redirect("kassa_dashboard")
    category = get_object_or_404(IncomeCategory.all_objects, pk=pk)
    category.is_active = not category.is_active
    category.save()
    status = "faollashtirildi" if category.is_active else "to'xtatildi"
    messages.success(request, f"'{category.name}' {status}")
    return redirect("income_category_list")


@login_required(login_url="login")
def income_category_delete(request, pk):
    if not _is_superadmin(request.user):
        messages.error(request, "Faqat Admin o'chira oladi!")
        return redirect("kassa_dashboard")
    category = get_object_or_404(IncomeCategory.all_objects, pk=pk)
    if request.method == "POST":
        name = category.name
        category.delete()
        messages.success(request, f"'{name}' kategoriyasi o'chirildi (faolligi bekor qilindi)")
        return redirect("income_category_list")
    return render(request, "kassa/delete.html", {"object": category, "title": "Kategoriyani o'chirish"})


# ===== CSV EXPORT =====

@login_required(login_url="login")
def kassa_overview_export(request):
    """Umumiy kassa — CSV export (filter bilan)"""
    user = request.user
    if not _is_superadmin(user):
        messages.error(request, "Faqat Admin export qila oladi!")
        return redirect("kassa_dashboard")

    today = date.today()
    f_year = request.GET.get("year") or str(today.year)
    f_month = request.GET.get("month") or str(today.month)
    f_day = request.GET.get("day")
    f_date_from = request.GET.get("date_from")
    f_date_to = request.GET.get("date_to")
    f_kassa = request.GET.get("kassa")

    transactions = KassaTransaction.objects.select_related("kassa", "kassa__owner", "student")

    if f_kassa:
        transactions = transactions.filter(kassa_id=f_kassa)

    if f_date_from:
        try:
            d = datetime.strptime(f_date_from, "%Y-%m-%d").date()
            transactions = transactions.filter(created_at__date__gte=d)
        except Exception:
            pass
    elif f_year and f_month:
        try:
            transactions = transactions.filter(created_at__year=int(f_year), created_at__month=int(f_month))
        except Exception:
            pass

    if f_date_to:
        try:
            d = datetime.strptime(f_date_to, "%Y-%m-%d").date()
            transactions = transactions.filter(created_at__date__lte=d)
        except Exception:
            pass
    elif f_day and f_year and f_month:
        try:
            transactions = transactions.filter(created_at__year=int(f_year), created_at__month=int(f_month), created_at__day=int(f_day))
        except Exception:
            pass

    transactions = transactions.order_by("-created_at")

    response = HttpResponse(content_type="text/csv; charset=utf-8")
    response["Content-Disposition"] = f'attachment; filename="kassa_export_{f_year}_{f_month}.csv"'
    response.write('\ufeff'.encode('utf8'))

    writer = csv.writer(response)
    writer.writerow(["Sana", "Kassa", "Turi", "Summa", "To'lov usuli", "O'quvchi", "Izoh", "Bajaruvchi"])

    type_labels = {
        "payment": "To'lov",
        "income": "Kirim",
        "expense": "Chiqim",
        "transfer_in": "O'tkazma (kirim)",
        "transfer_out": "O'tkazma (chiqim)",
        "refund": "Qaytarish",
    }

    for op in transactions:
        student_name = ""
        if op.student:
            student_name = f"{op.student.first_name} {op.student.last_name}".strip()
        writer.writerow([
            op.created_at.strftime("%d.%m.%Y %H:%M"),
            op.kassa.name,
            type_labels.get(op.transaction_type, op.transaction_type),
            op.amount,
            op.payment_method or "-",
            student_name or "-",
            op.description or "-",
            op.created_by or "-",
        ])

    return response


@login_required(login_url="login")
def kassa_overview_export_excel(request):
    """Umumiy kassa — Excel export (filter bilan)"""
    user = request.user
    is_superadmin = _is_superadmin(user)

    import openpyxl
    from openpyxl.styles import Font, PatternFill, Alignment, Border, Side

    today = date.today()
    f_year = request.GET.get("year") or str(today.year)
    f_month = request.GET.get("month") or str(today.month)
    f_day = request.GET.get("day")
    f_date_from = request.GET.get("date_from")
    f_date_to = request.GET.get("date_to")
    f_kassa = request.GET.get("kassa")
    f_search = request.GET.get("search", "").strip()

    transactions = KassaTransaction.objects.select_related("kassa", "kassa__owner", "student")

    if not is_superadmin:
        user_kassa_ids = Kassa.objects.filter(owner=user).values_list("pk", flat=True)
        transactions = transactions.filter(kassa_id__in=user_kassa_ids)

    if f_kassa:
        transactions = transactions.filter(kassa_id=f_kassa)

    if f_date_from:
        try:
            d = datetime.strptime(f_date_from, "%Y-%m-%d").date()
            transactions = transactions.filter(created_at__date__gte=d)
        except Exception:
            pass
    elif f_year and f_month:
        try:
            transactions = transactions.filter(created_at__year=int(f_year), created_at__month=int(f_month))
        except Exception:
            pass

    if f_date_to:
        try:
            d = datetime.strptime(f_date_to, "%Y-%m-%d").date()
            transactions = transactions.filter(created_at__date__lte=d)
        except Exception:
            pass
    elif f_day and f_year and f_month:
        try:
            transactions = transactions.filter(created_at__year=int(f_year), created_at__month=int(f_month), created_at__day=int(f_day))
        except Exception:
            pass

    if f_search:
        transactions = transactions.filter(
            Q(description__icontains=f_search) |
            Q(created_by__icontains=f_search) |
            Q(student__first_name__icontains=f_search) |
            Q(student__last_name__icontains=f_search) |
            Q(payment_method__icontains=f_search)
        )

    transactions = transactions.order_by("-created_at")

    type_labels = {
        "payment": "To'lov",
        "income": "Kirim",
        "expense": "Chiqim",
        "transfer_in": "O'tkazma (kirim)",
        "transfer_out": "O'tkazma (chiqim)",
        "refund": "Qaytarish",
    }

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Umumiy kassa"

    # Styles
    header_font = Font(name="Calibri", bold=True, size=11, color="FFFFFF")
    header_fill = PatternFill(start_color="2001FF", end_color="2001FF", fill_type="solid")
    header_align = Alignment(horizontal="center", vertical="center", wrap_text=True)
    cell_align = Alignment(vertical="center")
    num_align = Alignment(horizontal="right", vertical="center")
    thin_border = Border(
        left=Side(style="thin", color="D1D5DB"),
        right=Side(style="thin", color="D1D5DB"),
        top=Side(style="thin", color="D1D5DB"),
        bottom=Side(style="thin", color="D1D5DB"),
    )
    green_font = Font(name="Calibri", size=11, color="059669", bold=True)
    red_font = Font(name="Calibri", size=11, color="DC2626", bold=True)

    # Headers
    headers = ["Sana", "Kassa", "Turi", "Summa", "To'lov usuli", "O'quvchi", "Izoh", "Bajaruvchi"]
    for col, h in enumerate(headers, 1):
        cell = ws.cell(row=1, column=col, value=h)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = header_align
        cell.border = thin_border

    # Data
    row_num = 2
    for op in transactions:
        student_name = ""
        if op.student:
            student_name = f"{op.student.first_name} {op.student.last_name}".strip()

        ws.cell(row=row_num, column=1, value=op.created_at.strftime("%d.%m.%Y %H:%M")).alignment = cell_align
        ws.cell(row=row_num, column=2, value=op.kassa.name).alignment = cell_align
        ws.cell(row=row_num, column=3, value=type_labels.get(op.transaction_type, op.transaction_type)).alignment = cell_align

        amt_cell = ws.cell(row=row_num, column=4, value=float(op.amount))
        amt_cell.alignment = num_align
        if op.transaction_type in ["payment", "income", "transfer_in"]:
            amt_cell.font = green_font
        else:
            amt_cell.font = red_font
        amt_cell.number_format = '#,##0'

        ws.cell(row=row_num, column=5, value=op.payment_method or "-").alignment = cell_align
        ws.cell(row=row_num, column=6, value=student_name or "-").alignment = cell_align
        ws.cell(row=row_num, column=7, value=op.description or "-").alignment = cell_align
        ws.cell(row=row_num, column=8, value=op.created_by or "-").alignment = cell_align

        for col in range(1, 9):
            ws.cell(row=row_num, column=col).border = thin_border

        row_num += 1

    # Column widths
    ws.column_dimensions["A"].width = 18
    ws.column_dimensions["B"].width = 22
    ws.column_dimensions["C"].width = 16
    ws.column_dimensions["D"].width = 16
    ws.column_dimensions["E"].width = 14
    ws.column_dimensions["F"].width = 22
    ws.column_dimensions["G"].width = 30
    ws.column_dimensions["H"].width = 20

    # Freeze top row
    ws.freeze_panes = "A2"

    response = HttpResponse(
        content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )
    response["Content-Disposition"] = f'attachment; filename="kassa_export_{f_year}_{f_month}.xlsx"'
    wb.save(response)
    return response


@login_required(login_url="login")
def kassa_detail_export_excel(request, pk):
    """Kassa detail — Excel export (filter bilan)"""
    user = request.user
    is_superadmin = _is_superadmin(user)

    kassa = get_object_or_404(Kassa.objects.select_related("owner"), pk=pk)
    if not is_superadmin and kassa.owner != user:
        messages.error(request, "Sizning kassangiz emas!")
        return redirect("kassa_list")

    import openpyxl
    from openpyxl.styles import Font, PatternFill, Alignment, Border, Side

    transactions = KassaTransaction.objects.filter(kassa=kassa).select_related("student")

    date_from = request.GET.get("date_from")
    date_to = request.GET.get("date_to")
    tx_type = request.GET.get("transaction_type")
    amount_min = request.GET.get("amount_min")
    amount_max = request.GET.get("amount_max")
    search = request.GET.get("search", "").strip()
    filter_payment_method = request.GET.get("payment_method", "").strip()

    if date_from:
        transactions = transactions.filter(created_at__date__gte=date_from)
    if date_to:
        transactions = transactions.filter(created_at__date__lte=date_to)
    if tx_type:
        transactions = transactions.filter(transaction_type=tx_type)
    if filter_payment_method:
        transactions = transactions.filter(payment_method__iexact=filter_payment_method)
    if amount_min:
        try:
            transactions = transactions.filter(amount__gte=Decimal(amount_min))
        except Exception:
            pass
    if amount_max:
        try:
            transactions = transactions.filter(amount__lte=Decimal(amount_max))
        except Exception:
            pass
    if search:
        transactions = transactions.filter(
            Q(description__icontains=search) |
            Q(created_by__icontains=search) |
            Q(student__first_name__icontains=search) |
            Q(student__last_name__icontains=search)
        )

    transactions = transactions.order_by("-created_at")

    type_labels = {
        "payment": "To'lov",
        "income": "Kirim",
        "expense": "Chiqim",
        "transfer_in": "O'tkazma (kirim)",
        "transfer_out": "O'tkazma (chiqim)",
        "refund": "Qaytarish",
    }

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = kassa.name[:31]

    header_font = Font(name="Calibri", bold=True, size=11, color="FFFFFF")
    header_fill = PatternFill(start_color="2001FF", end_color="2001FF", fill_type="solid")
    header_align = Alignment(horizontal="center", vertical="center", wrap_text=True)
    cell_align = Alignment(vertical="center")
    num_align = Alignment(horizontal="right", vertical="center")
    thin_border = Border(
        left=Side(style="thin", color="D1D5DB"),
        right=Side(style="thin", color="D1D5DB"),
        top=Side(style="thin", color="D1D5DB"),
        bottom=Side(style="thin", color="D1D5DB"),
    )
    green_font = Font(name="Calibri", size=11, color="059669", bold=True)
    red_font = Font(name="Calibri", size=11, color="DC2626", bold=True)

    headers = ["#", "Sana", "Turi", "Summa", "To'lov usuli", "Kategoriya", "Eski balans", "Yangi balans", "O'quvchi", "Izoh", "Bajaruvchi"]
    for col, h in enumerate(headers, 1):
        cell = ws.cell(row=1, column=col, value=h)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = header_align
        cell.border = thin_border

    row_num = 2
    for idx, op in enumerate(transactions, 1):
        student_name = ""
        if op.student:
            student_name = f"{op.student.first_name} {op.student.last_name}".strip()

        ws.cell(row=row_num, column=1, value=idx).alignment = cell_align
        ws.cell(row=row_num, column=2, value=op.created_at.strftime("%d.%m.%Y %H:%M")).alignment = cell_align
        ws.cell(row=row_num, column=3, value=type_labels.get(op.transaction_type, op.transaction_type)).alignment = cell_align

        amt_cell = ws.cell(row=row_num, column=4, value=float(op.amount))
        amt_cell.alignment = num_align
        if op.transaction_type in ["payment", "income", "transfer_in"]:
            amt_cell.font = green_font
        else:
            amt_cell.font = red_font
        amt_cell.number_format = '#,##0'

        ws.cell(row=row_num, column=5, value=op.payment_method or "-").alignment = cell_align
        ws.cell(row=row_num, column=6, value=op.get_expense_category_display() if op.expense_category else "-").alignment = cell_align
        ws.cell(row=row_num, column=7, value=float(op.balance_before)).alignment = num_align
        ws.cell(row=row_num, column=8, value=float(op.balance_after)).alignment = num_align
        ws.cell(row=row_num, column=9, value=student_name or "-").alignment = cell_align
        ws.cell(row=row_num, column=10, value=op.description or "-").alignment = cell_align
        ws.cell(row=row_num, column=11, value=op.created_by or "-").alignment = cell_align

        for col in range(1, 12):
            ws.cell(row=row_num, column=col).border = thin_border

        row_num += 1

    ws.column_dimensions["A"].width = 6
    ws.column_dimensions["B"].width = 18
    ws.column_dimensions["C"].width = 16
    ws.column_dimensions["D"].width = 16
    ws.column_dimensions["E"].width = 14
    ws.column_dimensions["F"].width = 16
    ws.column_dimensions["G"].width = 14
    ws.column_dimensions["H"].width = 14
    ws.column_dimensions["I"].width = 22
    ws.column_dimensions["J"].width = 30
    ws.column_dimensions["K"].width = 20

    ws.freeze_panes = "A2"

    response = HttpResponse(
        content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )
    filename = f"kassa_{kassa.pk}_export.xlsx"
    response["Content-Disposition"] = f'attachment; filename="{filename}"'
    wb.save(response)
    return response
