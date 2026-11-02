from dataclasses import dataclass
from datetime import datetime

from apps.notificaciones.domain.value_objects.estado_outbox import Canal, EstadoOutbox


@dataclass(frozen=True)
class AdjuntoOutbox:
    """Adjunto serializable: `clave_almacen` (se lee del almacén en el worker) o `contenido_b64` (pequeño)."""

    nombre: str
    mime: str
    clave_almacen: str = ''
    contenido_b64: str = ''


@dataclass(frozen=True)
class MensajeOutbox:
    """Fila del outbox: el correo pendiente, escrito en la misma transacción que el hecho de negocio."""

    id: str
    tipo: str
    canal: Canal
    destinatario: str                 # correo
    destinatario_cedula: str
    asunto: str
    titulo: str
    mensaje: str
    enlace: str
    idempotency_key: str
    copia_a: tuple[str, ...] = ()
    adjuntos: tuple[AdjuntoOutbox, ...] = ()
    estado: EstadoOutbox = EstadoOutbox.PENDIENTE
    intentos: int = 0
    proximo_intento: datetime | None = None
    ultimo_error: str = ''
    enviado_en: datetime | None = None
