"""
Errores del acceso del postulante (D-3, D-4). Sin Django.

Todos son `DomainError` con un `codigo` estable que el cliente puede interpretar sin leer el texto. El estado
HTTP lo decide la capa de presentación a partir del código (el dominio no conoce HTTP).
"""
from datetime import datetime

from core.domain.exceptions import DomainError


class ErrorAccesoPostulante(DomainError):
    codigo = 'ACCESO_RECHAZADO'

    def __init__(self, *args, campo: str | None = None):
        super().__init__(*args, campo=campo)


class CredencialesInvalidas(ErrorAccesoPostulante):
    """Cédula o contraseña incorrectas. El mensaje es el mismo exista o no la cédula (no revela cuáles hay)."""

    codigo = 'CREDENCIALES_INVALIDAS'


class CredencialBloqueada(ErrorAccesoPostulante):
    """Demasiados intentos fallidos: bloqueo temporal hasta `bloqueada_hasta`."""

    codigo = 'CREDENCIAL_BLOQUEADA'

    def __init__(self, *args, bloqueada_hasta: datetime | None = None):
        super().__init__(*args)
        self.bloqueada_hasta = bloqueada_hasta


class CredencialVencida(ErrorAccesoPostulante):
    """La credencial venció (o fue revocada): hay que pedir a Captación que reabra el acceso."""

    codigo = 'CREDENCIAL_VENCIDA'


class AccesoNoDisponible(ErrorAccesoPostulante):
    """El expediente está en una etapa en la que el postulante no actúa (revisión de Captación, etc.)."""

    codigo = 'ACCESO_NO_DISPONIBLE'


class CambioClaveObligatorio(ErrorAccesoPostulante):
    """La contraseña temporal sigue vigente: antes de cualquier otra acción hay que cambiarla."""

    codigo = 'CAMBIO_CLAVE_OBLIGATORIO'


class SesionInvalida(ErrorAccesoPostulante):
    """Token ausente, mal firmado, vencido, de otra clase o ya revocado."""

    codigo = 'SESION_INVALIDA'
