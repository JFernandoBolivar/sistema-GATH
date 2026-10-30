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
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.validators import validate_email
from drf_spectacular.utils import extend_schema
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.views import APIView

from apps.identidad.application.use_cases.cerrar_sesion import cerrar_sesion
from apps.identidad.application.use_cases.emitir_tokens_sesion import (
    emitir_tokens_sesion,
)
from apps.identidad.application.use_cases.obtener_condicion_trabajador import (
    obtener_condicion_trabajador,
)
from apps.identidad.application.use_cases.obtener_permisos_de_cuenta import (
    obtener_permisos_de_cuenta,
)
from apps.identidad.application.use_cases.restablecer_password import (
    restablecer_password,
)
from apps.identidad.application.use_cases.rotar_tokens_sesion import (
    rotar_tokens_sesion,
)
from apps.identidad.application.use_cases.solicitar_recuperacion_password import (
    solicitar_recuperacion_password,
)
from apps.identidad.infrastructure.emails.recuperacion_email import (
    enviar_correo_recuperacion,
)
from apps.identidad.infrastructure.providers.bloqueos_login import (
    anotar_intento_fallido,
    limpiar_bloqueo,
    validar_bloqueo_vigente,
)
from apps.identidad.infrastructure.repositories.repo_cuenta_auth_orm import (
    RepoCuentaAuthORM,
)
from apps.identidad.infrastructure.providers.validadores_password import (
    validar_fortaleza_django,
)
from apps.identidad.infrastructure.repositories.repo_condicion_trabajador_orm import (
    RepoCondicionTrabajadorORM,
)
from apps.identidad.infrastructure.repositories.repo_cuentas_orm import RepoCuentasORM
from apps.identidad.infrastructure.repositories.repo_permisos_orm import (
    RepoPermisosORM,
)
from apps.identidad.infrastructure.repositories.repo_recuperacion_password_orm import (
    RepoRecuperacionPasswordORM,
)
from apps.identidad.infrastructure.serializers.auth_serializers import (
    LoginDocSerializer,
    RefreshDocSerializer,
)
from apps.identidad.infrastructure.serializers.cuenta_lectura_serializers import (
    CuentaLecturaSerializer,
)
from apps.identidad.infrastructure.tokens.password_reset_token import (
    generar_token_recuperacion,
    validar_token_recuperacion,
)
from apps.identidad.presentation.serializers.recuperacion_password_serializers import (
    RestablecerPasswordSerializer,
    SolicitarRecuperacionSerializer,
)
from core.domain.exceptions import DomainError
from core.presentation.cookies import clear_jwt_cookies, set_jwt_cookies
from core.presentation.envelope import fail, ok
from core.presentation.schema import MensajeRespuestaSerializer

logger = logging.getLogger('security_backend')


def _base_frontend_confiable(candidata: str | None) -> str:
    """URL base del frontend para el enlace de recuperación.

    Solo se acepta una URL enviada por el cliente (`frontend_url`/cabecera
    Origin) si es uno de los orígenes de confianza (`CORS_ALLOWED_ORIGINS`);
    en otro caso se usa `FRONTEND_URL`. Sin esto, cualquiera podía pedir la
    recuperación de la cuenta de otra persona con `frontend_url` apuntando a un
    dominio propio y la víctima recibiría un enlace legítimo (con token válido)
    hacia el sitio del atacante.
    """
    candidata = (candidata or '').strip().rstrip('/')
    if candidata and candidata in settings.CORS_ALLOWED_ORIGINS:
        return candidata
    return settings.FRONTEND_URL.rstrip('/')


def _nombre_cookie_refresh() -> str:
    # R-10 (BITACORA_RECONSTRUCCION.md, Entrada #035): fuente única en
    # settings.SIMPLE_JWT['AUTH_COOKIE_REFRESH'] = 'dj_refresh'.
    return settings.SIMPLE_JWT.get('AUTH_COOKIE_REFRESH', 'dj_refresh')


class LoginView(APIView):
    """Endpoint unificado de autenticación con throttling y bloqueo progresivo."""
    permission_classes = [AllowAny]
    throttle_scope = 'login'

    @extend_schema(
        tags=['Identidad'],
        summary='Inicio de sesión',
        description='Autentica y fija los tokens JWT como cookies HttpOnly (C-2).',
        request=LoginDocSerializer,
        responses={200: MensajeRespuestaSerializer, 401: MensajeRespuestaSerializer,
                   429: MensajeRespuestaSerializer},
    )
    def post(self, request):
        # Login solo por correo y contraseña (decisión 2026-10-29): la cédula y la
        # parte local del correo ya no identifican una cuenta.
        identificador = str(
            request.data.get('correo')
            or request.data.get('email')
            or request.data.get('usuario')
            or ''
        ).strip()
        password = request.data.get('password')

        if not password or not identificador:
            return fail('Credenciales requeridas.', 400)
        try:
            validate_email(identificador)
        except DjangoValidationError:
            return fail('Ingrese su correo electrónico.', 400)

        ip_cliente = request.META.get('REMOTE_ADDR')

        repo_auth = RepoCuentaAuthORM()
        cedula_registro = repo_auth.obtener_cedula_por_email(identificador) or str(identificador)[:20]

        bloqueado_hasta = (
            validar_bloqueo_vigente(cedula_registro)
            or validar_bloqueo_vigente(identificador)
        )
        if bloqueado_hasta:
            return fail(
                'Cuenta bloqueada temporalmente por múltiples intentos fallidos.',
                429,
                {'bloqueada_hasta': bloqueado_hasta.isoformat()},
            )

        try:
            cuenta = repo_auth.obtener_cuenta_por_correo(identificador)

            if not cuenta or not cuenta.is_active:
                anotar_intento_fallido(cedula_registro, ip_cliente)
                return fail('Credenciales inválidas.', 401)

            clave_valida = cuenta.check_password(password)

            if not clave_valida:
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
        limpiar_bloqueo(identificador)

        tokens = emitir_tokens_sesion(
            cuenta,
            cedula=str(cuenta.cedula_id) if cuenta.cedula_id else None,
            rol_nombre=cuenta.rol.nombre_rol if cuenta.rol_id else None,
            permisos_version=repo_auth.obtener_titular_por_id(cuenta.pk).permisos_version,
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
        refresh_token = request.data.get('refresh') or request.COOKIES.get(_nombre_cookie_refresh())
        if isinstance(refresh_token, dict):
            refresh_token = refresh_token.get('refresh') or refresh_token.get('token')

        if not refresh_token or not isinstance(refresh_token, str):
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

        titular = RepoCuentaAuthORM().obtener_titular_por_id(request.user.pk)
        return ok(
            {
                **usuario_data,
                # Nombre del rol sin exigir `identidad.ver_roles` (el listado de roles
                # lo exige y los roles de operación no lo tienen).
                'rol_nombre': titular.rol_nombre if titular else None,
                'permisos': sorted(permisos.codigos),
                # Dato derivado (no es un rol): ACTIVO | PASIVO | SIN_ASIGNACION.
                'condicion_trabajador': obtener_condicion_trabajador(
                    RepoCondicionTrabajadorORM(), cuenta.cedula
                ).value,
            },
            'Datos del usuario obtenidos correctamente.',
        )


class SolicitarRecuperacionPasswordView(APIView):
    """Solicitud de recuperación de contraseña por correo institucional con throttling (3/min)."""
    permission_classes = [AllowAny]
    throttle_scope = 'password_reset'

    @extend_schema(
        tags=['Identidad'],
        summary='Solicitar recuperación de contraseña',
        description='Envía un correo con token de 15 min al correo institucional del trabajador.',
        request=SolicitarRecuperacionSerializer,
        responses={200: MensajeRespuestaSerializer, 400: MensajeRespuestaSerializer, 429: MensajeRespuestaSerializer},
    )
    def post(self, request):
        serializer = SolicitarRecuperacionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        identificador = serializer.validated_data['identificador']
        base_frontend = _base_frontend_confiable(
            serializer.validated_data.get('frontend_url') or request.headers.get('Origin')
        )

        mensaje = solicitar_recuperacion_password(
            RepoRecuperacionPasswordORM(),
            identificador,
            base_frontend=base_frontend,
            enviar_email_fn=enviar_correo_recuperacion,
            generar_token_fn=generar_token_recuperacion,
        )
        return ok(message=mensaje)


class RestablecerPasswordView(APIView):
    """Restablece la contraseña utilizando un token válido y no utilizado previamente."""
    permission_classes = [AllowAny]
    throttle_scope = 'password_reset'

    @extend_schema(
        tags=['Identidad'],
        summary='Restablecer contraseña con token',
        description='Valida el token de recuperación y establece la nueva contraseña.',
        request=RestablecerPasswordSerializer,
        responses={200: MensajeRespuestaSerializer, 400: MensajeRespuestaSerializer, 429: MensajeRespuestaSerializer},
    )
    def post(self, request):
        serializer = RestablecerPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        mensaje = restablecer_password(
            RepoRecuperacionPasswordORM(),
            token=serializer.validated_data['token'],
            password_nuevo=serializer.validated_data['password_nuevo'],
            password_confirmacion=serializer.validated_data['password_confirmacion'],
            validar_token_fn=validar_token_recuperacion,
            validar_fortaleza_fn=validar_fortaleza_django,
        )
        return ok(message=mensaje)

