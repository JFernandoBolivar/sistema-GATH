from django.apps import AppConfig


class MovimientosConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.movimientos'
    verbose_name = 'Historial de Movimientos de Cargo'

    def ready(self):
        import apps.movimientos.infrastructure.receivers  # noqa: F401
