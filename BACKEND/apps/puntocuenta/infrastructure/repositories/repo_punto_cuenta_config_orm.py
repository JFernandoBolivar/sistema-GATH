"""Adaptadores ORM de la secuencia y la configuración de Punto de Cuenta.

Devuelven entidades de dominio (`ConfiguracionPuntoCuenta`), nunca el modelo: la
capa de aplicación no debe conocer el ORM.
"""
from django.db import transaction

from apps.puntocuenta.domain.entities.configuracion_punto_cuenta import ConfiguracionPuntoCuenta
from apps.puntocuenta.infrastructure.models.configuracion_punto_cuenta_model import (
    ConfiguracionPuntoCuentaModel,
    SecuenciaPuntoCuentaModel,
)


def _a_entidad(fila: ConfiguracionPuntoCuentaModel) -> ConfiguracionPuntoCuenta:
    return ConfiguracionPuntoCuenta(
        procesos_habilitados=dict(fila.procesos_habilitados or {}),
        titulo=fila.titulo,
        encabezado=fila.encabezado,
        cuerpo=fila.cuerpo,
        firmas=list(fila.firmas or []),
        mostrar_nivel=bool(fila.mostrar_nivel),
        plantillas_procesos=dict(fila.plantillas_procesos or {}),
        version=fila.version,
        actualizado_por_id=fila.actualizado_por_id,
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
    def actual(self) -> ConfiguracionPuntoCuenta | None:
        fila = ConfiguracionPuntoCuentaModel.objects.first()
        return None if fila is None else _a_entidad(fila)

    def crear_version(self, campos: dict) -> ConfiguracionPuntoCuenta:
        with transaction.atomic():
            fila = ConfiguracionPuntoCuentaModel.objects.create(**campos)
            return _a_entidad(fila)

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
