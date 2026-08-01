import django, os, sys
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
sys.path.insert(0, os.path.dirname(__file__))
django.setup()

from datetime import date, timedelta
import calendar
from decimal import Decimal
from django.db.models import Sum
from frontend.models import Student, Transaction, Attendance, StudentBalance
from frontend.views import _calc_monthly_debts, add_balance_transaction, get_or_create_balance

fixed = 0
for s in Student.objects.all():
    has_df = Transaction.objects.filter(student=s, description__contains='df:').exists()
    if not has_df:
        continue
    try:
        monthly, deferred = _calc_monthly_debts(s)
    except Exception as e:
        print(f"Error {s.id} {s.first_name}: {e}")
        continue
    if not deferred:
        continue
    total = Decimal('0.00')
    for d in deferred:
        debt = Decimal(str(d.get('debt', 0)))
        if debt > 0:
            total += debt
    if total == 0:
        continue
    # Check if correction already exists
    existing = Transaction.objects.filter(
        student=s,
        transaction_type=Transaction.Type.CORRECTION,
        description__startswith='Kechilgan oylar uchun korreksiya'
    ).exists()
    if existing:
        print(f"Skip {s.id} {s.first_name} — correction already exists")
        continue
    add_balance_transaction(
        student=s,
        amount=total,
        transaction_type=Transaction.Type.CORRECTION,
        description=f"Kechilgan oylar uchun korreksiya: {', '.join(d['month'] for d in deferred)}",
        created_by="System"
    )
    print(f"Fixed {s.id} {s.first_name}: +{total} so'm ({', '.join(d['month'] for d in deferred)})")
    fixed += 1

print(f"\nDone. Fixed {fixed} students.")
