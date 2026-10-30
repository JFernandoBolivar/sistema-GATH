from django.apps import AppConfig


class FeDeVidaConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.fe_de_vida'
    verbose_name = 'Fe de Vida de Pasivos'

    def ready(self):
        import apps.fe_de_vida.infrastructure.receivers  # noqa: F401  (conecta eventos -> notificaciones y constancia)
