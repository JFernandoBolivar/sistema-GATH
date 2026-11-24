"""
Servir archivos del almacenamiento (vistas delgadas, B4).

La validación de subidas vive en `core/infrastructure/storage/validacion_archivo.py`.
`respuesta_archivo` sirve un objeto a través de Django (la vista que la usa
autentica y autoriza); la URL de SeaweedFS (red interna) nunca llega al navegador.
"""
import logging
import uuid

from django.db import transaction
from django.http import StreamingHttpResponse

from core.domain.exceptions import NotFoundError
from core.infrastructure.models.auditoria import AuditoriaLog
from core.infrastructure.storage.validacion_archivo import MIME_POR_EXTENSION, extension_de
from core.presentation.audit import origen_de_peticion, registrar_auditoria

logger = logging.getLogger(__name__)

ACCION_DESCARGA = 'DESCARGA_ARCHIVO'
MODULO_DESCARGA = 'archivos'


def registrar_descarga(request, tipo: str, ref_id, *, encontrado: bool = True, motivo: str = '') -> None:
    """
    Bitácora de descargas (H-3): quién, qué, cuándo, desde dónde y con qué resultado.

    Reutiliza `AuditoriaLog` (acción `DESCARGA_ARCHIVO`, `recurso_tipo` = tipo, `recurso_id` = id del
    recurso). No guarda contenido ni la clave del almacén. Nunca impide la descarga: si el registro
    falla se escribe en el log y se sigue (el savepoint evita envenenar una transacción abierta).
    """
    try:
        usuario = getattr(request, 'user', None)
        cedula = getattr(usuario, 'cedula_id', None) or getattr(usuario, 'cedula', None) or ''
        pk = getattr(usuario, 'pk', None)
        estado = {} if encontrado else {'motivo': motivo or 'no_encontrado'}
        with transaction.atomic():
            registrar_auditoria(
                trace_id=getattr(request, 'trace_id', None) or uuid.uuid4().hex,
                actor_id=pk if isinstance(pk, int) else None,
                actor_cedula=str(cedula)[:15],
                actor_rol='POSTULANTE' if getattr(usuario, 'scope', '') == 'postulante' else '',
                accion=ACCION_DESCARGA,
                modulo=MODULO_DESCARGA,
                recurso_tipo=str(tipo)[:50],
                recurso_id=str(ref_id or '')[:64],
                resultado=AuditoriaLog.Resultado.SUCCESS if encontrado else AuditoriaLog.Resultado.FAILED,
                estado_nuevo=estado or None,
                **origen_de_peticion(request),
            )
    except Exception:  # noqa: BLE001 - la bitácora jamás tumba la descarga
        logger.exception('No se pudo registrar la descarga de %s %s', tipo, ref_id)


def respuesta_archivo(
    storage, clave: str, cache: str = 'private, max-age=300', mime: str | None = None,
    *, request=None, recurso: str = '', recurso_id='',
) -> StreamingHttpResponse:
    """
    Sirve el objeto `clave` por streaming; 404 si falta, 503 si el almacén cae. `mime` (guardado) manda sobre la extensión.

    Con `request` y `recurso` registra la descarga en la bitácora (H-3): servido, o «no encontrado» si falta.
    """
    registrar = request is not None and bool(recurso)
    if not clave:
        if registrar:
            registrar_descarga(request, recurso, recurso_id, encontrado=False)
        raise NotFoundError("Archivo no disponible.")
    try:
        flujo = storage.descargar_flujo(clave)
    except NotFoundError:
        if registrar:
            registrar_descarga(request, recurso, recurso_id, encontrado=False)
        raise
    if registrar:
        registrar_descarga(request, recurso, recurso_id)
    mime = mime or MIME_POR_EXTENSION.get(extension_de(clave), 'application/octet-stream')
    respuesta = StreamingHttpResponse(flujo, content_type=mime)
    respuesta['Cache-Control'] = cache
    respuesta['X-Content-Type-Options'] = 'nosniff'
    return respuesta
