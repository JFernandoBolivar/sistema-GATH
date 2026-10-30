"""
Receivers de Movimientos (patrón evento→signal→receiver, Regla B16).

Se suscribe al evento `cargo_movimiento_ejecutado` de `apps.cargos` sin que
`apps.cargos` conozca ni importe `apps.movimientos` — el desacople lo da el
`django.dispatch.Signal`. Conectado en `MovimientosConfig.ready()`.

El mismo evento lo emiten `apps.pasivos` (EGRESO / pase a pasivo) y el alta de
sobrevivientes (INGRESO). Además de registrar el historial, se generan los
avisos del sistema (G8) **después del commit** (`transaction.on_commit`) y sin
que un fallo al notificar tumbe el movimiento.
"""
import logging

from django.conf import settings
from django.db import transaction
from django.dispatch import receiver

from apps.cargos.domain.events import cargo_movimiento_ejecutado
from apps.movimientos.application.use_cases.registrar_movimiento import registrar_movimiento
from apps.movimientos.domain.services.notificaciones_movimiento import (
    TIPO_INGRESO,
    TIPO_SOBREVIVIENTE,
    solicitudes_de_movimiento,
)
from apps.movimientos.infrastructure.repositories.repo_movimientos_orm import RepoMovimientosORM
from core.infrastructure.providers import obtener_notificador

logger = logging.getLogger('gath.movimientos')

# El evento lo emite el repositorio de sobrevivientes para dar de alta a un
# familiar beneficiario como personal pasivo (mismo evento, distinto origen).
SENDER_SOBREVIVIENTES = 'RepoSobrevivientesORM'


@receiver(cargo_movimiento_ejecutado)
def despachar_registro_historial(sender, cargo_id, cedula, tipo_movimiento, motivo_id, usuario_id, **kwargs):
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
        tipo_evento = _tipo_de_evento(sender, tipo_movimiento)
        transaction.on_commit(lambda: notificar_movimiento(movimiento, tipo_evento))


def _tipo_de_evento(sender, tipo_movimiento: str) -> str:
    """El alta de un sobreviviente llega como INGRESO desde el repositorio de pasivos."""
    if tipo_movimiento == TIPO_INGRESO and getattr(sender, '__name__', '') == SENDER_SOBREVIVIENTES:
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
            correo_activo = bool(getattr(settings, 'NOTIFICAR_MOVIMIENTOS_POR_CORREO', False))
            for solicitud in solicitudes_de_movimiento(
                movimiento, tipo_evento, correo_activo=correo_activo
            ):
                notificador.notificar(solicitud)
    except Exception:  # noqa: BLE001
        logger.exception('no se pudieron generar los avisos del movimiento %s', movimiento.id)
