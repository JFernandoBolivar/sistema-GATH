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
import secrets

from django.conf import settings
from django.contrib.auth.hashers import check_password, make_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.validators import validate_email
from django.utils import timezone
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
from apps.identidad.application.use_cases.restablecer_password import (
    restablecer_password,
)
from apps.identidad.application.use_cases.rotar_tokens_sesion import (
    rotar_tokens_sesion,
)
from apps.identidad.application.use_cases.solicitar_recuperacion_password import (
    MENSAJE_RESPUESTA_GENERICO,
)
from apps.identidad.infrastructure.tasks.recuperacion_tasks import (
    procesar_solicitud_recuperacion,
    solicitar_recuperacion_password_task,
)
from apps.identidad.domain.services.politica_password_inicial import (
    MENSAJE_PASSWORD_INICIAL_VENCIDA,
)
from apps.identidad.infrastructure.repositories.repo_password_inicial_orm import (
    RepoPasswordInicialORM,
)
from apps.identidad.infrastructure.signals import publicar_evento_identidad
from apps.identidad.infrastructure.providers.bloqueos_login import (
    anotar_intento_fallido,
    limpiar_bloqueo,
    validar_bloqueo_vigente,
)
from apps.identidad.infrastructure.cache.permisos_cache import resolver_permisos
from apps.identidad.infrastructure.mappers.mapper_cuenta import cuenta_a_entidad
from apps.identidad.infrastructure.models.cuenta_models import CuentaModel
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

_HASH_FICTICIO: str | None = None


def _verificar_clave_ficticia(password: str) -> None:
    """Gasta lo mismo que verificar una clave real cuando la cuenta no existe.

    Sin esto, el login respondía en ~0,04 s si el correo no existía y en más de
    1 s si existía: midiendo el tiempo se averiguaba qué correos están
    registrados (mismo criterio que ModelBackend de Django).
    """
    global _HASH_FICTICIO
    if _HASH_FICTICIO is None:
        _HASH_FICTICIO = make_password(secrets.token_urlsafe(32))
    check_password(password, _HASH_FICTICIO)


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
                _verificar_clave_ficticia(password)
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

        # Contraseña inicial (la cédula) vencida a los 7 días (D8). Se evalúa DESPUÉS de comprobar la
        # clave, para no revelar a quien no la conoce que la cuenta existe ni su estado.
        vence_en = RepoPasswordInicialORM().vencimiento(cuenta.pk)
        if vence_en is not None and vence_en <= timezone.now():
            return fail(MENSAJE_PASSWORD_INICIAL_VENCIDA, 401, {'password_inicial_vencida': True})

        limpiar_bloqueo(cedula_registro)
        limpiar_bloqueo(identificador)

        tokens = emitir_tokens_sesion(
            cuenta,
            cedula=str(cuenta.cedula_id) if cuenta.cedula_id else None,
            rol_nombre=cuenta.rol.nombre_rol if cuenta.rol_id else None,
            permisos_version=repo_auth.obtener_titular_por_id(cuenta.pk).permisos_version,
        )

        # La contraseña inicial es la cédula. Reutilizamos la comprobación ya
        # hecha (`check_password`) en vez de que el serializer vuelva a hashear
        # con `repo.verificar_password` (L-LOGIN).
        cuenta.debe_cambiar_password = password == str(cuenta.cedula_id)
        repo = RepoCuentasORM()
        usuario_data = CuentaLecturaSerializer(
            cuenta_a_entidad(cuenta), context={'repo': repo}
        ).data

        respuesta = ok(
            {'usuario': usuario_data, 'tokens': {'access': tokens.access, 'refresh': tokens.refresh}},
            'Inicio de sesión exitoso.',
        )
        return set_jwt_cookies(respuesta, tokens.access, tokens.refresh)


class RefreshView(APIView):
    throttle_scope = "refresh"
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
        # Logout explícito: la siguiente petición no debe reutilizar el contexto
        # cacheado de esta cuenta (L-NEW2).
        RepoCuentasORM().invalidar_contexto_cuenta(request.user.pk)
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
        # Una sola consulta trae cuenta + rol + versión de permisos + condición
        # (`obtener_contexto_sesion`); la caché de permisos evita resolver rol,
        # overrides y catálogo en cada navegación. Si el JWT ya cargó la fila
        # anotada para validar la versión, se reutiliza tal cual.
        if getattr(request.user, '_gath_contexto_sesion', False) and isinstance(
            request.user, CuentaModel
        ):
            cuenta = cuenta_a_entidad(request.user)
        else:
            cuenta = repo.obtener_contexto_sesion(request.user.pk)
        if cuenta is None:
            return fail('La cuenta autenticada no existe.', 404)
        usuario_data = CuentaLecturaSerializer(cuenta).data

        codigos = resolver_permisos(
            RepoPermisosORM(), cuenta.cedula, cuenta.rol_id, cuenta.permisos_version
        )
        condicion = cuenta.condicion or obtener_condicion_trabajador(
            RepoCondicionTrabajadorORM(), cuenta.cedula
        ).value

        return ok(
            {
                **usuario_data,
                # Nombre del rol sin exigir `identidad.ver_roles` (el listado de roles
                # lo exige y los roles de operación no lo tienen).
                'rol_nombre': cuenta.rol_nombre,
                'permisos': sorted(codigos),
                # Dato derivado (no es un rol): ACTIVO | PASIVO | SIN_ASIGNACION.
                'condicion_trabajador': condicion,
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

        # Se encola y se responde al instante con el mismo mensaje exista o no la
        # cuenta: así ni el tiempo de respuesta ni un error de SMTP delatan qué
        # correos o cédulas están registrados (enumeración por tiempo).
        try:
            solicitar_recuperacion_password_task.delay(identificador, base_frontend)
        except Exception:
            logger.warning('recuperacion.broker_no_disponible', exc_info=True)
            procesar_solicitud_recuperacion(identificador, base_frontend)
        return ok(message=MENSAJE_RESPUESTA_GENERICO)


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
            publicar=publicar_evento_identidad,
        )
        return ok(message=mensaje)

