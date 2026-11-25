"""
Receivers de Movimientos (patrón evento→signal→receiver, Regla B16).

Se suscribe al evento `cargo_movimiento_ejecutado` de `apps.cargos` sin que
`apps.cargos` conozca ni importe `apps.movimientos` — el desacople lo da el
`django.dispatch.Signal`. Conectado en `MovimientosConfig.ready()`.

El mismo evento lo emiten `apps.pasivos` (EGRESO / pase a pasivo) y el alta de
sobrevivientes (INGRESO). Además de registrar el historial, se generan los
documentos del proceso y los avisos del sistema (G8) **después del commit**
(`transaction.on_commit`) y sin que un fallo documental o de notificación
tumbe el movimiento.
"""
import logging

from django.db import transaction
from django.dispatch import receiver

from apps.cargos.domain.events import (
    ORIGEN_CARGOS,
    ORIGEN_SOBREVIVIENTES,
    cargo_movimiento_ejecutado,
)
from apps.movimientos.application.use_cases.registrar_movimiento import registrar_movimiento
from apps.movimientos.domain.services.notificaciones_movimiento import (
    TIPO_INGRESO,
    TIPO_SOBREVIVIENTE,
    solicitudes_de_movimiento,
)
from apps.movimientos.domain.value_objects.proceso_movimiento import proceso_de_movimiento
from apps.movimientos.infrastructure.generacion_documentos_movimiento import (
    generar_documentos_despues_de_commit,
)
from apps.movimientos.infrastructure.repositories.repo_movimientos_orm import RepoMovimientosORM
from core.domain.configuracion import CLAVE_NOTIFICAR_MOVIMIENTOS_POR_CORREO
from core.infrastructure.providers import obtener_lector_configuracion, obtener_notificador

logger = logging.getLogger('gath.movimientos')


@receiver(cargo_movimiento_ejecutado, dispatch_uid='movimientos_registrar_y_generar_documentos')
def despachar_registro_historial(
    sender,
    cargo_id,
    cedula,
    tipo_movimiento,
    motivo_id,
    usuario_id,
    origen=ORIGEN_CARGOS,
    **kwargs,
):
    if not cedula:
        # Sin empleado en el puesto (p. ej. desasignar un cargo ya vacante)
        # no hay a quién atribuirle el movimiento — se omite el registro.
        return
    repo = RepoMovimientosORM()
    movimiento = registrar_movimiento(
        repo,
        cargo_id=cargo_id,
        cedula=cedula,
        tipo_movimiento=tipo_movimiento,
        motivo_id=motivo_id,
        usuario_id=usuario_id,
    )
    if movimiento is not None:
        tipo_evento = _tipo_de_evento(origen, tipo_movimiento)
        proceso = proceso_de_movimiento(tipo_movimiento)
        if proceso is not None:
            # Se conservan solo los datos del evento necesarios para el
            # snapshot. `origen` del evento identifica el módulo emisor y no se
            # confunde con el origen del movimiento.
            evento = {'modulo_origen': origen}
            for clave in (
                'cargo_anterior_id', 'dependencia_anterior_id', 'dependencia_nueva_id',
                'oficina_anterior_id', 'oficina_nueva_id', 'division_anterior_id',
                'division_nueva_id', 'origen_descripcion',
            ):
                if kwargs.get(clave) is not None:
                    evento[clave] = kwargs[clave]
            transaction.on_commit(
                lambda: generar_documentos_despues_de_commit(movimiento, proceso, evento)
            )
        transaction.on_commit(lambda: notificar_movimiento(movimiento, tipo_evento))


def _tipo_de_evento(origen: str, tipo_movimiento: str) -> str:
    """El alta de un sobreviviente llega como INGRESO y se distingue por `origen`."""
    if tipo_movimiento == TIPO_INGRESO and origen == ORIGEN_SOBREVIVIENTES:
        return TIPO_SOBREVIVIENTE
    return tipo_movimiento


def notificar_movimiento(movimiento, tipo_evento: str) -> None:
    """Crea los avisos del movimiento. Un fallo aquí nunca revierte el movimiento."""
    notificador = obtener_notificador()
    if notificador is None:
        logger.warning('sin Notificador registrado: el movimiento %s no genera avisos', movimiento.id)
        return
    try:
        with transaction.atomic():
            lector = obtener_lector_configuracion()
            correo_activo = (
                lector.obtener_booleano(CLAVE_NOTIFICAR_MOVIMIENTOS_POR_CORREO)
                if lector is not None else False
            )
            for solicitud in solicitudes_de_movimiento(
                movimiento, tipo_evento, correo_activo=correo_activo
            ):
                notificador.notificar(solicitud)
    except Exception:  # noqa: BLE001
        logger.exception('no se pudieron generar los avisos del movimiento %s', movimiento.id)
