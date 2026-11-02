"""
Fachada del bloqueo de cuentas para el login legado (B3.12).

`USER/views/user_views.py::login_view` es hoy el punto donde autentica el
frontend NextJS; el plan NO pide migrar ese endpoint todavía (C-2/B8). Este
provider expone los casos de uso ya cableados con su repositorio compuesto,
siguiendo el patrón de `resolutor_core.py`: la app provee la implementación y
el llamador jamás conoce detalles de infraestructura.
"""
from datetime import datetime

from apps.identidad.application.dtos.bloqueo_dto import IntentoFallidoDTO
from apps.identidad.application.use_cases.registrar_intento_fallido import (
    registrar_intento_fallido,
)
from apps.identidad.application.use_cases.validar_bloqueo import validar_bloqueo
from apps.identidad.infrastructure.repositories.repo_bloqueos_cache_db import (
    RepoBloqueosCacheDB,
)


def validar_bloqueo_vigente(identificador: str) -> datetime | None:
    """`bloqueada_hasta` si la cuenta sigue bloqueada; None si puede intentar."""
    return validar_bloqueo(RepoBloqueosCacheDB(), identificador)


def anotar_intento_fallido(identificador: str, ip: str | None) -> None:
    """Registra un fallo de credenciales y aplica el bloqueo si corresponde."""
    registrar_intento_fallido(
        RepoBloqueosCacheDB(),
        IntentoFallidoDTO(cedula=identificador, ip=ip),
    )


def limpiar_bloqueo(identificador: str) -> None:
    """Acceso correcto: reinicia el contador de intentos fallidos."""
    RepoBloqueosCacheDB().resetear(identificador)
