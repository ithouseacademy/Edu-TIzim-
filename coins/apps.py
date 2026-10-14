from django.apps import AppConfig


class CoinsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "coins"
    verbose_name = "Coin tizimi"

    def ready(self):
        from . import signals  # noqa: F401