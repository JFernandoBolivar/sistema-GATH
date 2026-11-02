from django.apps import AppConfig


class CoreConfig(AppConfig):
    """AppConfig del kernel compartido (B2.15 / B26)."""

    default_auto_field = 'django.db.models.BigAutoField'
    name = 'core'
    verbose_name = 'Kernel Compartido GATH'
