from django.apps import AppConfig


class PersonalConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.personal'
    verbose_name = 'Expediente y Gestión de Personal Activo'

    def ready(self):
        # Fase 2: cualquier escritura en un catálogo invalida su caché.
        from apps.personal.infrastructure.signals_catalogos import (
            conectar_invalidacion_catalogos,
        )

        conectar_invalidacion_catalogos()
