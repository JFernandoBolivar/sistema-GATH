from django.apps import AppConfig


class AutogestionConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.autogestion'
    verbose_name = 'Autogestión del Trabajador y Censos'

    def ready(self):
        import apps.autogestion.infrastructure.receivers  # noqa: F401  (conecta eventos -> notificaciones)
