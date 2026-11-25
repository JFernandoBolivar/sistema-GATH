"""Orquestación post-commit de los documentos de un movimiento.

El movimiento ya está persistido cuando se ejecuta. Cualquier fallo documental
se registra en `AuditoriaLog` y en el logger, pero nunca se propaga al flujo que
ejecutó el movimiento. Sin plantillas activas el método es un no-op.
"""

import logging
import uuid

from django.db import transaction

from apps.movimientos.application.use_cases.generar_documentos_movimiento import (
    generar_documentos_movimiento,
)
from apps.movimientos.domain.ports.generador_documentos_movimiento import (
    GeneradorDocumentosMovimiento,
    ProveedorTrabajadorMovimiento,
)
from apps.movimientos.infrastructure.generador_documentos_movimiento import (
    GeneradorDocumentosMovimientoExternos,
)
from apps.movimientos.infrastructure.models.movimiento_models import EmployeeMovementHistoryModel
from apps.movimientos.infrastructure.proveedor_trabajador_movimiento import (
    ProveedorTrabajadorMovimientoORM,
)
from core.domain.exceptions import NotFoundError
from core.infrastructure.logging.trace_context import get_trace_id
from core.infrastructure.models.auditoria import AuditoriaLog
from core.presentation.audit import registrar_auditoria

logger = logging.getLogger('gath.movimientos.documentos')

ACCION_AUDITORIA = 'generar_documentos_movimiento'
RECURSO_MOVIMIENTO = 'movimiento'


def _auditor_fallo(movimiento, proceso: str, error: Exception) -> None:
    try:
        registrar_auditoria(
            trace_id=get_trace_id() or uuid.uuid4().hex,
            actor_id=movimiento.ejecutado_por_id,
            accion=ACCION_AUDITORIA,
            modulo='movimientos',
            resultado=AuditoriaLog.Resultado.FAILED,
            recurso_tipo=RECURSO_MOVIMIENTO,
            recurso_id=str(movimiento.id),
            estado_nuevo={
                'proceso': proceso,
                'tipo_movimiento': movimiento.tipo_movimiento,
                'trabajador_cedula': movimiento.empleado_cedula,
                'error_tipo': type(error).__name__,
                'error': str(error)[:1000],
            },
        )
    except Exception:  # noqa: BLE001
        logger.exception(
            'no se pudo registrar en AuditoriaLog el fallo documental del movimiento %s',
            movimiento.id,
        )


def generar_documentos_despues_de_commit(
    movimiento,
    proceso: str,
    evento: dict | None = None,
    *,
    generador: GeneradorDocumentosMovimiento | None = None,
    proveedor: ProveedorTrabajadorMovimiento | None = None,
) -> None:
    """Genera documentos sin que un fallo revierta el movimiento ya confirmado."""
    try:
        with transaction.atomic():
            # Serializa reintentos del mismo movimiento. La comprobación de
            # duplicados por (movimiento, plantilla) está en el adaptador.
            fila = (
                EmployeeMovementHistoryModel.objects.select_for_update()
                .filter(pk=movimiento.id)
                .first()
            )
            if fila is None:
                raise NotFoundError(f'Movimiento {movimiento.id} no encontrado.')
            generar_documentos_movimiento(
                generador or GeneradorDocumentosMovimientoExternos(),
                proveedor or ProveedorTrabajadorMovimientoORM(),
                movimiento,
                proceso=proceso,
                evento=evento,
            )
    except Exception as error:  # noqa: BLE001
        logger.exception(
            'no se pudieron generar los documentos del movimiento %s (%s)',
            movimiento.id,
            proceso,
        )
        _auditor_fallo(movimiento, proceso, error)
