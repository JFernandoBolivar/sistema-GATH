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

        # Editar cualquier parte del expediente, familiares o cargo marca al trabajador
        # como recién actualizado (orden de los listados).
        from apps.personal.infrastructure.signals_actualizacion import (
            conectar_marca_de_actualizacion,
        )

        conectar_marca_de_actualizacion()
