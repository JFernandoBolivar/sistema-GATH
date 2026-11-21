"""Credencial del postulante (§4.3): una por expediente. Entidad pura e inmutable. Sin Django."""
from dataclasses import dataclass, field
from datetime import datetime


@dataclass(frozen=True)
class CredencialPostulante:
    """
    Cédula (`usuario`) + contraseña. La contraseña NUNCA se guarda en claro: `clave_hash` es el hash del hasher
    de Django. `ventana` y `vence_el` reflejan los del expediente (se mantienen alineados al reabrir una ventana).
    `version_sesion` sube cada vez que hay que cerrar las sesiones abiertas (reposición, cambio de clave, envío del
    expediente): el token de invitado lleva la versión con que se emitió y deja de valer si ya no coincide.
    """

    id: str
    expediente_id: str
    usuario: str
    clave_hash: str = field(repr=False)
    ventana: int
    vence_el: datetime
    debe_cambiar_clave: bool = True
    intentos_fallidos: int = 0
    bloqueada_hasta: datetime | None = None
    ultimo_acceso: datetime | None = None
    emitida_por: str = ''
    emitida_el: datetime | None = None
    version_sesion: int = 1
    revocada: bool = False
