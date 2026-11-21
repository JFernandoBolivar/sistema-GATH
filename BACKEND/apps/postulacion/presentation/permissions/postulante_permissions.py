"""Permisos de las vistas del postulante y códigos de permiso de Captación (`postulacion.*`)."""
from rest_framework.permissions import BasePermission

from apps.postulacion.domain.errores import CambioClaveObligatorio
from apps.postulacion.presentation.authentication import SesionPostulante
from core.presentation.permissions import HasPermission

CREAR_POSTULANTE = 'postulacion.crear_postulante'
VER_BANDEJA = 'postulacion.ver_bandeja'
REGISTRAR_PSICOFISICO = 'postulacion.registrar_psicofisico'


class EsPostulante(BasePermission):
    """Solo la sesión de invitado. Un empleado autenticado (aunque tenga todos los permisos) NO pasa."""

    message = "Esta acción es solo para el postulante con su sesión de invitado."

    def has_permission(self, request, view) -> bool:
        return isinstance(request.user, SesionPostulante)


class ClaveAlDia(BasePermission):
    """Mientras `debe_cambiar_clave` siga activo, todo lo demás responde 403 con código CAMBIO_CLAVE_OBLIGATORIO."""

    message = "Debe cambiar la contraseña temporal antes de continuar."

    def has_permission(self, request, view) -> bool:
        if isinstance(request.user, SesionPostulante) and request.user.debe_cambiar_clave:
            raise CambioClaveObligatorio(self.message)
        return True


def permisos_captacion() -> list:
    from rest_framework.permissions import IsAuthenticated
    return [IsAuthenticated, HasPermission(CREAR_POSTULANTE)]
