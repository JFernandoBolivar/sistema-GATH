from django.apps import AppConfig


class PuntocuentaConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.puntocuenta'
    verbose_name = 'Punto de Cuenta'

    def ready(self):
        import apps.puntocuenta.infrastructure.receivers  # noqa: F401
