"""
Vistas de gestión de usuarios (B7): validan entrada, invocan un caso de uso
con el repositorio ORM y responden por el sobre C-1 (`ok()`/`fail()`, B9).
Ningún acceso al ORM aquí.

Cierra, para `apps.identidad`, los hallazgos CRIT-04 (cambio de contraseña
propio, exige sesión + contraseña actual) y CRIT-05 (alta de cuenta exige
permiso administrativo, ninguna cuenta puede autoasignarse creando otra sin
autorización).
"""
from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework import status, views
from rest_framework.permissions import IsAuthenticated

from apps.identidad.application.dtos.cuenta_dto import (
    ActualizarCuentaDTO,
    CambiarEstadoCuentaDTO,
    CambiarPasswordDTO,
    RegistrarCuentaDTO,
)
from apps.identidad.application.use_cases.cambiar_estado_usuario import (
    cambiar_estado_usuario,
)
from apps.identidad.application.use_cases.cambiar_password import cambiar_password
from apps.identidad.application.use_cases.cambiar_correo_acceso import cambiar_correo_acceso
from apps.identidad.application.use_cases.editar_usuario import editar_usuario
from apps.identidad.application.use_cases.restablecer_acceso import restablecer_acceso
from apps.identidad.application.use_cases.registrar_usuario import registrar_usuario
from apps.identidad.infrastructure.receivers import aprovisionar_eligiendo_correo
from apps.identidad.infrastructure.repositories.repo_correo_acceso_orm import RepoCorreoAccesoORM
from apps.identidad.infrastructure.repositories.repo_password_inicial_orm import (
    RepoPasswordInicialORM,
)
from apps.identidad.infrastructure.repositories.repo_permisos_version_orm import (
    RepoPermisosVersionORM,
)
from apps.identidad.infrastructure.signals import publicar_evento_identidad
from core.domain.configuracion import CLAVE_PASSWORD_INICIAL_DIAS
from core.infrastructure.providers import obtener_lector_configuracion
from apps.identidad.infrastructure.providers.validadores_password import (
    validar_fortaleza_django,
)
from apps.identidad.infrastructure.repositories.repo_cuentas_orm import RepoCuentasORM
from apps.identidad.infrastructure.serializers.cuenta_escritura_serializers import (
    ActualizarCuentaSerializer,
    CambiarCorreoAccesoSerializer,
    CambiarEstadoCuentaSerializer,
    CambiarPasswordSerializer,
    RegistrarCuentaSerializer,
)
from apps.identidad.infrastructure.serializers.cuenta_lectura_serializers import (
    CuentaLecturaSerializer,
)
from apps.identidad.presentation.permissions.identidad_permissions import (
    PERMISO_CREAR_USUARIOS,
    PERMISO_CAMBIAR_CORREO_ACCESO,
    PERMISO_DESACTIVAR_USUARIOS,
    PERMISO_EDITAR_USUARIOS,
    PERMISO_RESTABLECER_ACCESO,
    PERMISO_VER_USUARIOS,
)
from core.presentation.envelope import ok
from core.presentation.schema import MensajeRespuestaSerializer


def _parse_bool(valor):
    if valor is None or valor == '':
        return None
    return str(valor).strip().lower() in ('1', 'true', 'si', 'sí', 'yes')


class UsuarioListView(views.APIView):
    """GET /api/v1/identidad/usuarios/ — listado filtrable de cuentas."""

    permission_classes = [IsAuthenticated, PERMISO_VER_USUARIOS]

    @extend_schema(
        tags=['Identidad'],
        summary='Lista las cuentas de usuario',
        description=(
            'Filtros opcionales: ?cedula=, ?departamento_id=, ?rol_id=, '
            '?is_active=. No incluye los campos de asignación organizacional '
            '(dirección general/línea, coordinación, dependencia): ver nota '
            'de alcance en `cuenta_lectura_serializers.py`.'
        ),
        responses={200: CuentaLecturaSerializer(many=True), 403: MensajeRespuestaSerializer},
    )
    def get(self, request):
        repo = RepoCuentasORM()
        filtros = {
            'cedula': request.query_params.get('cedula'),
            'departamento_id': request.query_params.get('departamento_id'),
            'rol_id': request.query_params.get('rol_id'),
            'is_active': _parse_bool(request.query_params.get('is_active')),
        }
        usuarios = repo.listar(filtros)
        datos = CuentaLecturaSerializer(usuarios, many=True).data
        return ok(datos, f'{len(datos)} usuario(s) encontrado(s).')


class UsuarioRegistrarView(views.APIView):
    """POST /api/v1/identidad/usuarios/ — alta de cuenta (cierra CRIT-05)."""

    permission_classes = [IsAuthenticated, PERMISO_CREAR_USUARIOS]

    @extend_schema(
        tags=['Identidad'],
        summary='Registra una cuenta de usuario',
        request=RegistrarCuentaSerializer,
        responses={
            201: CuentaLecturaSerializer,
            400: MensajeRespuestaSerializer,
            403: MensajeRespuestaSerializer,
            404: MensajeRespuestaSerializer,
            409: MensajeRespuestaSerializer,
        },
    )
    def post(self, request):
        serializer = RegistrarCuentaSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        datos = serializer.validated_data

        repo = RepoCuentasORM()
        cuenta = registrar_usuario(
            repo,
            RegistrarCuentaDTO(
                cedula=str(datos['cedula']),
                password=datos['password'],
                departamento_id=datos.get('departamento_id'),
                rol_id=datos.get('rol_id'),
            ),
        )
        return ok(
            CuentaLecturaSerializer(cuenta, context={'repo': repo}).data,
            'Usuario registrado exitosamente.',
            status=status.HTTP_201_CREATED,
        )


class UsuarioEditarView(views.APIView):
    """PATCH /api/v1/identidad/usuarios/{id}/ — edición de departamento/rol/contraseña."""

    permission_classes = [IsAuthenticated, PERMISO_EDITAR_USUARIOS]

    @extend_schema(
        tags=['Identidad'],
        summary='Edita una cuenta de usuario',
        request=ActualizarCuentaSerializer,
        responses={
            200: CuentaLecturaSerializer,
            400: MensajeRespuestaSerializer,
            403: MensajeRespuestaSerializer,
            404: MensajeRespuestaSerializer,
        },
    )
    def patch(self, request, id: int):
        serializer = ActualizarCuentaSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        datos = serializer.validated_data

        repo = RepoCuentasORM()
        cuenta = editar_usuario(
            repo,
            ActualizarCuentaDTO(
                id=id,
                departamento_id=datos.get('departamento_id'),
                rol_id=datos.get('rol_id'),
                tocar_departamento='departamento_id' in request.data,
                tocar_rol='rol_id' in request.data,
                password=datos.get('password') or None,
            ),
            validar_fortaleza=validar_fortaleza_django,
        )
        return ok(
            CuentaLecturaSerializer(cuenta, context={'repo': repo}).data,
            'Usuario actualizado exitosamente.',
        )

    @extend_schema(
        tags=['Identidad'],
        summary='Edita una cuenta de usuario (alias de PATCH)',
        request=ActualizarCuentaSerializer,
        responses={
            200: CuentaLecturaSerializer,
            400: MensajeRespuestaSerializer,
            403: MensajeRespuestaSerializer,
            404: MensajeRespuestaSerializer,
        },
    )
    def put(self, request, id: int):
        return self.patch(request, id)


class UsuarioCambiarEstadoView(views.APIView):
    """PATCH /api/v1/identidad/usuarios/{id}/estado/ — activar/desactivar cuenta."""

    permission_classes = [IsAuthenticated, PERMISO_DESACTIVAR_USUARIOS]

    @extend_schema(
        tags=['Identidad'],
        summary='Activa o desactiva una cuenta de usuario',
        request=CambiarEstadoCuentaSerializer,
        responses={
            200: CuentaLecturaSerializer,
            403: MensajeRespuestaSerializer,
            404: MensajeRespuestaSerializer,
        },
    )
    def patch(self, request, id: int):
        serializer = CambiarEstadoCuentaSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        is_active = serializer.validated_data.get('is_active')

        repo = RepoCuentasORM()
        cuenta = cambiar_estado_usuario(
            repo, CambiarEstadoCuentaDTO(id=id, is_active=is_active)
        )
        estado = 'activado' if cuenta.is_active else 'suspendido'
        return ok(
            CuentaLecturaSerializer(cuenta, context={'repo': repo}).data,
            f'Usuario {estado} exitosamente.',
        )


class CambiarPasswordView(views.APIView):
    """POST /api/v1/identidad/usuarios/cambiar-password/ — autoservicio (cierra CRIT-04).

    A diferencia del legado histórico (`cambiar_password_primera_vez`, que
    aceptaba cualquier `id` en el body sin sesión), esta vista opera
    exclusivamente sobre `request.user` y exige la contraseña actual.
    """

    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=['Identidad'],
        summary='Cambia la contraseña de la cuenta autenticada',
        request=CambiarPasswordSerializer,
        responses={200: MensajeRespuestaSerializer, 400: MensajeRespuestaSerializer},
    )
    def post(self, request):
        serializer = CambiarPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        datos = serializer.validated_data

        cambiar_password(
            RepoCuentasORM(),
            CambiarPasswordDTO(
                actor_id=request.user.pk,
                password_actual=datos['password_actual'],
                password_nuevo=datos['password_nuevo'],
            ),
            validar_fortaleza=validar_fortaleza_django,
            publicar=publicar_evento_identidad,
        )
        return ok(message='Contraseña actualizada exitosamente.')


class UsuarioRestablecerAccesoView(views.APIView):
    """POST /api/v1/identidad/usuarios/{id}/restablecer-acceso/ — repone la contraseña inicial (D8)."""

    permission_classes = [IsAuthenticated, PERMISO_RESTABLECER_ACCESO]

    @extend_schema(
        tags=['Identidad'],
        summary='Restablece el acceso de un trabajador',
        description=(
            'Repone la cédula como contraseña inicial con los días configurados en el parámetro '
            'de vigencia, exige cambiarla en el próximo ingreso, revoca las sesiones abiertas y '
            'avisa por correo al trabajador.'
        ),
        request=None,
        responses={
            200: CuentaLecturaSerializer,
            400: MensajeRespuestaSerializer,
            403: MensajeRespuestaSerializer,
            404: MensajeRespuestaSerializer,
        },
    )
    def post(self, request, id: int):
        repo = RepoCuentasORM()
        lector = obtener_lector_configuracion()
        dias = (
            lector.obtener_entero(CLAVE_PASSWORD_INICIAL_DIAS)
            if lector is not None else 7
        )
        cuenta = restablecer_acceso(
            repo,
            RepoPasswordInicialORM(),
            RepoPermisosVersionORM(),
            publicar_evento_identidad,
            id,
            timezone.now(),
            dias_vigencia=dias,
        )
        return ok(
            CuentaLecturaSerializer(repo.obtener_por_id(cuenta.id), context={'repo': repo}).data,
            f'Acceso restablecido: la contraseña inicial vuelve a ser la cédula y vence en '
            f'{dias} día{"s" if dias != 1 else ""}.',
        )


class CorreoAccesoView(views.APIView):
    """POST /api/v1/identidad/cuentas/{cedula}/correo-acceso/ — RRHH elige el correo de acceso (D8)."""

    permission_classes = [IsAuthenticated, PERMISO_CAMBIAR_CORREO_ACCESO]

    @extend_schema(
        tags=['Identidad'],
        summary='Elige el correo de acceso de un trabajador (pase a pasivo)',
        description=(
            'fuente=INSTITUCIONAL conserva el correo actual; ALTERNATIVO usa el correo alternativo que '
            'declaró el trabajador; OTRO usa el indicado. Avisa al correo elegido y, si el pasivo o '
            'sobreviviente no tenía cuenta, la crea (rol AUTOGESTION, contraseña inicial = cédula).'
        ),
        request=CambiarCorreoAccesoSerializer,
        responses={
            200: MensajeRespuestaSerializer,
            400: MensajeRespuestaSerializer,
            403: MensajeRespuestaSerializer,
            404: MensajeRespuestaSerializer,
            409: MensajeRespuestaSerializer,
        },
    )
    def post(self, request, cedula: str):
        serializer = CambiarCorreoAccesoSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        datos = serializer.validated_data

        resultado = cambiar_correo_acceso(
            RepoCorreoAccesoORM(),
            RepoCuentasORM(),
            publicar_evento_identidad,
            aprovisionar_eligiendo_correo,
            cedula=cedula,
            fuente=datos['fuente'],
            correo=datos.get('correo'),
        )
        return ok(
            {
                'correo': resultado.correo,
                'cuenta_creada': resultado.cuenta_creada,
                'avisado': resultado.avisado,
            },
            'Correo de acceso registrado.',
        )
