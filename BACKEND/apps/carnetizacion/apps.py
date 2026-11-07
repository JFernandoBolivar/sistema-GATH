from django.apps import AppConfig


class CarnetizacionConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.carnetizacion'
    verbose_name = 'Carnetización Institucional'

    def ready(self) -> None:
        try:
            from apps.carnetizacion.infrastructure.signals_carnet import conectar_senales_carnet
            conectar_senales_carnet()
        except Exception:
            pass
