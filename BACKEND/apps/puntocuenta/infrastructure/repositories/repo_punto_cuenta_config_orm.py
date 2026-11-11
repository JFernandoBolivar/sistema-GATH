"""Adaptadores ORM de la secuencia y la configuración de Punto de Cuenta."""
from django.db import transaction

from apps.puntocuenta.infrastructure.models.configuracion_punto_cuenta_model import (
    ConfiguracionPuntoCuentaModel,
    SecuenciaPuntoCuentaModel,
)


class RepoSecuenciaPuntoCuentaORM:
    def siguiente(self, anio: int) -> int:
        with transaction.atomic():
            fila, _ = SecuenciaPuntoCuentaModel.objects.select_for_update().get_or_create(
                anio=anio, defaults={'ultimo_numero': 0},
            )
            fila.ultimo_numero += 1
            fila.save(update_fields=['ultimo_numero'])
            return fila.ultimo_numero


class RepoConfiguracionPuntoCuentaORM:
    def actual(self):
        return ConfiguracionPuntoCuentaModel.objects.first()

    def crear_version(self, campos: dict):
        with transaction.atomic():
            return ConfiguracionPuntoCuentaModel.objects.create(**campos)

    def guardar_generar(self, generar: bool, usuario_id: int | None) -> None:
        # Import entre módulos en infrastructure (patrón B16 del proyecto).
        from apps.configuracion.application.use_cases.guardar_parametro import guardar_parametro
        from apps.configuracion.infrastructure.repositories.repo_parametros_orm import RepoParametrosORM
        from core.domain.configuracion import CLAVE_GENERAR_PUNTOS_CUENTA

        guardar_parametro(
            repo=RepoParametrosORM(),
            clave=CLAVE_GENERAR_PUNTOS_CUENTA,
            valor_nuevo='true' if generar else 'false',
            usuario_id=usuario_id,
        )
