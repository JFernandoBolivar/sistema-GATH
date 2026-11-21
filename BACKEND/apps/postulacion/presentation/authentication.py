"""
Autenticación de la sesión de invitado del postulante (§13.3).

Solo las vistas del postulante la declaran en `authentication_classes`; las de personal siguen con
`CookieJWTAuthentication` (que no entiende este token) y estas vistas NO aceptan el JWT de empleado ni la cookie
`dj_access`: únicamente `Authorization: Bearer <token de invitado>`.
"""
from rest_framework.authentication import BaseAuthentication, get_authorization_header

from apps.postulacion.application.use_cases.credenciales import resolver_sesion
from apps.postulacion.domain.errores import SesionInvalida
from apps.postulacion.infrastructure.repositories.repo_postulacion_orm import RepoPostulacionORM
from apps.postulacion.infrastructure.tokens.sesion_invitado import leer_token_invitado

SCOPE_POSTULANTE = 'postulante'


class SesionPostulante:
    """
    Usuario sintético de la sesión de invitado: NO es una cuenta (no existe en `cuenta`) y no tiene permisos.
    `tiene_permiso` devuelve siempre False: si por error se combinara con un `HasPermission`, la comprobación
    falla cerrada (el resolutor de `core` consulta primero ese método).
    """

    is_authenticated = True
    is_anonymous = False
    is_active = True
    is_staff = False
    is_superuser = False
    id = None
    scope = SCOPE_POSTULANTE

    def __init__(self, cedula: str, expediente_id: str, debe_cambiar_clave: bool, version_sesion: int):
        self.cedula = cedula
        self.expediente_id = expediente_id
        self.debe_cambiar_clave = debe_cambiar_clave
        self.version_sesion = version_sesion

    @property
    def pk(self) -> str:
        # Clave del throttling por usuario: una por postulante (no compartida entre todos los invitados).
        return f'postulante:{self.cedula}'

    def tiene_permiso(self, codigo: str) -> bool:
        return False

    def __str__(self) -> str:
        return f'postulante {self.cedula}'


class PostulanteJWTAuthentication(BaseAuthentication):
    def authenticate(self, request):
        partes = get_authorization_header(request).split()
        if not partes or partes[0].lower() != b'bearer':
            return None
        if len(partes) != 2:
            raise SesionInvalida("La sesión no es válida. Ingrese de nuevo con su cédula y contraseña.")
        claims = leer_token_invitado(partes[1].decode('latin-1'))
        sesion = resolver_sesion(
            RepoPostulacionORM(), cedula=claims.cedula, expediente_id=claims.expediente_id,
            version_sesion=claims.version_sesion,
        )
        return (
            SesionPostulante(
                cedula=claims.cedula, expediente_id=sesion.expediente.id,
                debe_cambiar_clave=sesion.credencial.debe_cambiar_clave, version_sesion=claims.version_sesion,
            ),
            claims,
        )

    def authenticate_header(self, request) -> str:
        return 'Bearer realm="postulacion"'
