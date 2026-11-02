"""
AppConfig del módulo identidad (B3.1, regla B26).

`ready()` registra el resolutor de permisos del dominio en el provider del
kernel (B3.2): a partir de ese momento `HasPermission("modulo.accion")`
autoriza contra la matriz real.
"""
from django.apps import AppConfig


class IdentidadConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.identidad'
    verbose_name = 'Identidad y Autorización'

    def ready(self):
        from apps.identidad.infrastructure.providers.resolutor_core import (
            registrar_resolutor_en_kernel,
        )

        registrar_resolutor_en_kernel()
        import apps.identidad.infrastructure.receivers  # noqa: F401  (ciclo de vida de cuentas, D8)
