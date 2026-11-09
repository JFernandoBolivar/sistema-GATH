from django.apps import AppConfig


class ConfiguracionConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.configuracion'
    verbose_name = 'Configuración del Sistema'

    def ready(self):
        from apps.configuracion.infrastructure.lector_configuracion import LectorConfiguracionORM
        from core.infrastructure.providers import registrar_lector_configuracion

        registrar_lector_configuracion(LectorConfiguracionORM())
