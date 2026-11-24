"""Enlace de activación (D-10): permite al postulante crear su contraseña desde un correo. Entidad pura. Sin Django."""
from dataclasses import dataclass, field
from datetime import datetime


@dataclass(frozen=True)
class EnlaceActivacion:
    """
    Del token solo se conserva su hash (sha256): el valor en claro viaja una vez, por correo, y no se puede recuperar.
    Un enlace sirve una sola vez (`usado_el`), vence en `vence_el` y se anula (`revocado`) al emitir otro o al
    elegir la entrega en persona. `intentos` cuenta las cédulas equivocadas (5 bloquean el enlace).
    """

    id: str
    expediente_id: str
    token_hash: str = field(repr=False)
    correo_destino: str
    creado_por: str
    creado_el: datetime
    vence_el: datetime
    usado_el: datetime | None = None
    ip_uso: str | None = None
    intentos: int = 0
    revocado: bool = False
