from django.core.management.base import BaseCommand

from frontend.models import News, NewsCategory

DEFAULT_NEWS = [
    {
        "title": "Yangi o'quv yili boshlandi!",
        "body": "Bizning maktabimizda yangi o'quv yili rasmiy boshlandi. Barcha o'quvchilarni yangi o'quv yiliga xush kelibsiz! Darslar jadvali va darsliklar yangilangan.",
        "category": "yangilik",
    },
    {
        "title": "Musobaqa: Eng faol o'quvchi",
        "body": "Shu oy davomida eng faol o'quvchi uchun maxsus musobaqa e'lon qilinadi. Ishtirok etish uchun darslarda faol bo'ling va coin to'plang!",
        "category": "musobaqa",
    },
    {
        "title": "Kutubxonaga yangi kitoblar keldi",
        "body": "Onlayn kutubxonamizga yangi kitoblar qo'shildi. Kitobxonadan foydalanish uchun «Onlayn kutubxona» bo'limiga o'ting.",
        "category": "kutubxona",
    },
]


class Command(BaseCommand):
    help = "O'quvchi ilovasi uchun boshlang'ich yangiliklarni yaratadi (mavjud bo'lmasa)."

    def handle(self, *args, **options):
        created_cats = 0
        for i, (value, label) in enumerate(NewsCategory.DEFAULT_CHOICES, start=1):
            _, was_created = NewsCategory.objects.get_or_create(
                value=value,
                defaults={"label": label, "is_active": True, "order": i},
            )
            if was_created:
                created_cats += 1
        if created_cats:
            self.stdout.write(f"{created_cats} ta tur yaratildi")

        created = 0
        for item in DEFAULT_NEWS:
            _, was_created = News.objects.get_or_create(
                title=item["title"],
                defaults={
                    "body": item["body"],
                    "category": item["category"],
                    "is_published": True,
                },
            )
            if was_created:
                created += 1
        self.stdout.write(self.style.SUCCESS(f"{created} ta yangilik yaratildi (jami {News.objects.count()} ta)"))
