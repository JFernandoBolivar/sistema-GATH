"""
Vistas de Autenticación y Token JWT en apps.identidad (Reglas B12, B3.12, R-11).

`LoginView`/`RefreshView`/`LogoutView` emiten y rotan tokens a través de los
casos de uso de `application/use_cases/` (`emitir_tokens_sesion`,
`rotar_tokens_sesion`, `cerrar_sesion`, R-11) y fijan las cookies HttpOnly con
`core/presentation/cookies.py` (antes ninguna de las dos vistas fijaba
cookies: una brecha real frente al legado, cerrada aquí). `MeView` cubre el
endpoint de perfil de sesión que el gap analysis marcó como faltante.
"""
import logging

from django.conf import settings
from drf_spectacular.utils import extend_schema
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.views import APIView

from apps.identidad.application.use_cases.cerrar_sesion import cerrar_sesion
from apps.identidad.application.use_cases.emitir_tokens_sesion import (
    emitir_tokens_sesion,
)
from apps.identidad.application.use_cases.obtener_permisos_de_cuenta import (
    obtener_permisos_de_cuenta,
)
from apps.identidad.application.use_cases.rotar_tokens_sesion import (
    rotar_tokens_sesion,
)
from apps.identidad.infrastructure.providers.bloqueos_login import (
    anotar_intento_fallido,
    limpiar_bloqueo,
    validar_bloqueo_vigente,
)
from apps.identidad.infrastructure.repositories.repo_cuenta_auth_orm import (
    RepoCuentaAuthORM,
)
from apps.identidad.infrastructure.repositories.repo_cuentas_orm import RepoCuentasORM
from apps.identidad.infrastructure.repositories.repo_permisos_orm import (
    RepoPermisosORM,
)
from apps.identidad.infrastructure.serializers.auth_serializers import (
    LoginDocSerializer,
    RefreshDocSerializer,
)
from apps.identidad.infrastructure.serializers.cuenta_lectura_serializers import (
    CuentaLecturaSerializer,
)
from core.domain.exceptions import DomainError
from core.presentation.cookies import clear_jwt_cookies, set_jwt_cookies
from core.presentation.envelope import fail, ok
from core.presentation.schema import MensajeRespuestaSerializer

logger = logging.getLogger('security_backend')


def _nombre_cookie_refresh() -> str:
    # R-10 (BITACORA_RECONSTRUCCION.md, Entrada #035): fuente única en
    # settings.SIMPLE_JWT['AUTH_COOKIE_REFRESH'] = 'dj_refresh'.
    return settings.SIMPLE_JWT.get('AUTH_COOKIE_REFRESH', 'dj_refresh')


class LoginView(APIView):
    """Endpoint unificado de autenticación con throttling y bloqueo progresivo."""
    permission_classes = [AllowAny]

    @extend_schema(
        tags=['Identidad'],
        summary='Inicio de sesión',
        description='Autentica y fija los tokens JWT como cookies HttpOnly (C-2).',
        request=LoginDocSerializer,
        responses={200: MensajeRespuestaSerializer, 401: MensajeRespuestaSerializer,
                   429: MensajeRespuestaSerializer},
    )
    def post(self, request):
        correo = request.data.get('correo') or request.data.get('email')
        password = request.data.get('password')
        cedula_directa = request.data.get('cedula')

        if not password or (not correo and not cedula_directa):
            return fail('Credenciales requeridas.', 400)

        ip_cliente = request.META.get('REMOTE_ADDR')

        repo_auth = RepoCuentaAuthORM()
        cedula_registro = None
        cuenta = None
        if correo:
            cedula_registro = repo_auth.obtener_cedula_por_email(correo) or correo[:20]
        else:
            cedula_registro = cedula_directa or ''

        bloqueado_hasta = (
            validar_bloqueo_vigente(cedula_registro)
            or (validar_bloqueo_vigente(correo) if correo else None)
        )
        if bloqueado_hasta:
            return fail(
                'Cuenta bloqueada temporalmente por múltiples intentos fallidos.',
                429,
                {'bloqueada_hasta': bloqueado_hasta.isoformat()},
            )

        try:
            cuenta = repo_auth.obtener_cuenta_por_email_o_cedula(correo, cedula_directa)

            if not cuenta or not cuenta.check_password(password) or not cuenta.is_active:
                anotar_intento_fallido(cedula_registro, ip_cliente)
                nuevo_bloqueo = validar_bloqueo_vigente(cedula_registro)
                if nuevo_bloqueo:
                    return fail(
                        'Cuenta bloqueada por superar el límite de intentos fallidos.',
                        429,
                        {'bloqueada_hasta': nuevo_bloqueo.isoformat()},
                    )
                return fail('Credenciales inválidas.', 401)

        except Exception as e:
            logger.error('Error en autenticación: %s', e)
            anotar_intento_fallido(cedula_registro, ip_cliente)
            return fail('Error procesando la solicitud de autenticación.', 401)

        limpiar_bloqueo(cedula_registro)
        if correo:
            limpiar_bloqueo(correo)

        tokens = emitir_tokens_sesion(
            cuenta,
            cedula=str(cuenta.cedula_id) if cuenta.cedula_id else None,
            rol_nombre=cuenta.rol.nombre_rol if cuenta.rol_id else None,
        )

        repo = RepoCuentasORM()
        usuario_data = CuentaLecturaSerializer(
            repo.obtener_por_id(cuenta.pk), context={'repo': repo}
        ).data

        respuesta = ok(
            {'usuario': usuario_data, 'tokens': {'access': tokens.access, 'refresh': tokens.refresh}},
            'Inicio de sesión exitoso.',
        )
        return set_jwt_cookies(respuesta, tokens.access, tokens.refresh)


class RefreshView(APIView):
    """Endpoint de refresco de tokens JWT (corrige ALTA-08 para este módulo)."""
    permission_classes = [AllowAny]

    @extend_schema(
        tags=['Identidad'],
        summary='Refrescar token',
        description='Rota access/refresh revalidando is_active del titular (R-11, ALTA-08).',
        request=RefreshDocSerializer,
        responses={200: MensajeRespuestaSerializer, 401: MensajeRespuestaSerializer,
                   403: MensajeRespuestaSerializer},
    )
    def post(self, request):
        refresh_token = request.COOKIES.get(_nombre_cookie_refresh()) or request.data.get('refresh')

        if not refresh_token:
            return fail('No se proporcionó un token de refresco.', 400)

        try:
            tokens = rotar_tokens_sesion(RepoCuentaAuthORM(), refresh_token)
        except DomainError as exc:
            respuesta = fail(str(exc), 401)
            return clear_jwt_cookies(respuesta)

        respuesta = ok(
            {'tokens': {'access': tokens.access, 'refresh': tokens.refresh}},
            'Token refrescado exitosamente.',
        )
        return set_jwt_cookies(respuesta, tokens.access, tokens.refresh)


class LogoutView(APIView):
    """Endpoint de cierre de sesión: blacklistea el refresh y limpia cookies."""
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=['Identidad'],
        summary='Cerrar sesión',
        description='Blacklistea el refresh token (si está presente) y limpia las cookies (C-2).',
        request=None,
        responses={200: MensajeRespuestaSerializer},
    )
    def post(self, request):
        refresh_token = request.COOKIES.get(_nombre_cookie_refresh())
        cerrar_sesion(refresh_token)
        respuesta = ok(message='Sesión cerrada exitosamente.')
        return clear_jwt_cookies(respuesta)


class MeView(APIView):
    """Endpoint de perfil de sesión actual (cuenta + permisos efectivos, C-2)."""
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=['Identidad'],
        summary='Perfil de la cuenta autenticada',
        description='Devuelve los datos de la cuenta y sus códigos de permiso efectivos.',
        responses={200: MensajeRespuestaSerializer, 403: MensajeRespuestaSerializer},
    )
    def get(self, request):
        repo = RepoCuentasORM()
        cuenta = repo.obtener_por_id(request.user.pk)
        usuario_data = CuentaLecturaSerializer(cuenta, context={'repo': repo}).data

        permisos = obtener_permisos_de_cuenta(RepoPermisosORM(), cuenta.cedula)

        return ok(
            {**usuario_data, 'permisos': sorted(permisos.codigos)},
            'Datos del usuario obtenidos correctamente.',
        )
