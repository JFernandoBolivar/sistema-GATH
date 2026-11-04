"""
Auditoría de las exportaciones: arma el callback `Auditor` de los casos de uso
sobre `registrar_auditoria` (bitácora dual BD + TXT).

El actor es siempre quien pidió la exportación, también cuando la registra el
worker (`exportacion_lista`/`exportacion_fallida`). El detalle nunca incluye
filtros con datos personales: solo tipo, formato, tamaño y truncado.
"""
import uuid

from apps.exportaciones.domain.entities.trabajo_exportacion import TrabajoExportacion
from core.infrastructure.logging.trace_context import get_trace_id
from core.presentation.audit import registrar_auditoria

MODULO_AUDITORIA = 'exportaciones'
RECURSO = 'exportacion'


def _registrar(trabajo: TrabajoExportacion, accion: str, detalle: dict, trace_id: str, origen: dict, rol: str) -> None:
    registrar_auditoria(
        trace_id=trace_id,
        actor_id=trabajo.solicitante_id,
        actor_cedula=trabajo.solicitante_cedula[:15],
        actor_rol=rol,
        accion=accion,
        modulo=MODULO_AUDITORIA,
        recurso_tipo=RECURSO,
        recurso_id=trabajo.id,
        estado_nuevo={k: v for k, v in detalle.items() if v is not None},
        **origen,
    )


def auditor_de_peticion(request, rol: str = ''):
    """Auditor del momento de la solicitud (conoce IP y dispositivo)."""
    from core.presentation.audit import origen_de_peticion

    trace_id = getattr(request, 'trace_id', None) or uuid.uuid4().hex
    origen = origen_de_peticion(request)
    return lambda accion, trabajo, detalle: _registrar(trabajo, accion, detalle, trace_id, origen, rol)


def auditor_de_tarea():
    """Auditor del worker: sin petición HTTP, con el trace_id de la tarea."""
    trace_id = get_trace_id() or uuid.uuid4().hex
    return lambda accion, trabajo, detalle: _registrar(trabajo, accion, detalle, trace_id, {}, '')
