"""
Vistas de gestión de usuarios (B7): validan entrada, invocan un caso de uso
con el repositorio ORM y responden por el sobre C-1 (`ok()`/`fail()`, B9).
Ningún acceso al ORM aquí.

Cierra, para `apps.identidad`, los hallazgos CRIT-04 (cambio de contraseña
propio, exige sesión + contraseña actual) y CRIT-05 (alta de cuenta exige
permiso administrativo, ninguna cuenta puede autoasignarse creando otra sin
autorización).
"""
import uuid

from django.db import transaction
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
from apps.identidad.application.dtos.permisos_dto import ActorSesionDTO
from apps.identidad.application.use_cases.administrar_usuarios import (
    contar_editores_matriz,
    listar_usuarios_admin,
    obtener_detalle_usuario,
)
from apps.identidad.application.use_cases.resolver_permisos import resolver_politica_actor
from apps.identidad.domain.services.reglas_administracion import (
    exigir_al_menos_un_editor_matriz,
    validar_asignacion_rol,
    validar_cambio_estado,
    validar_cambio_rol,
    validar_operacion_sobre_cuenta_administrativa,
)
from apps.identidad.domain.entities.politica_acceso import PoliticaAcceso
from apps.identidad.domain.value_objects.administracion import (
    FiltrosUsuarios,
    PaginacionUsuarios,
)
from apps.identidad.infrastructure.repositories.repo_condicion_trabajador_orm import (
    RepoCondicionTrabajadorORM,
)
from apps.identidad.infrastructure.repositories.repo_permisos_orm import RepoPermisosORM
from apps.identidad.infrastructure.repositories.repo_roles_orm import RepoRolesORM
from apps.identidad.infrastructure.serializers.administracion_serializers import (
    UsuarioDetalleSerializer,
)
from core.presentation.audit import origen_de_peticion, registrar_auditoria
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
from apps.identidad.infrastructure.providers.bloqueos_login import limpiar_bloqueo
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
    RestablecerAccesoSerializer,
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
from core.domain.exceptions import (
    ConflictError,
    NotFoundError,
    PermissionDeniedError,
    ValidationError,
)


ACCION_ROL_ACTUALIZADO = 'identidad.rol_actualizado'
ACCION_ESTADO_ACTUALIZADO = 'identidad.estado_cuenta_actualizado'
ACCION_OVERRIDES_ACTUALIZADOS = 'identidad.permisos_individuales_actualizados'
ACCION_RESTABLECER_ACCESO = 'identidad.acceso_restablecido'
ACCION_CORREO_ACCESO = 'identidad.correo_acceso_cambiado'
MODULO_AUDITORIA = 'identidad'
RECURSO_AUDITORIA = 'Usuario'


def _actor(request) -> dict:
    user = request.user
    return {
        'actor_id': getattr(user, 'pk', None),
        'actor_cedula': str(getattr(user, 'cedula_id', '') or ''),
        'actor_rol': str(getattr(getattr(user, 'rol', None), 'nombre_rol', '') or ''),
    }


def _trace(request) -> str:
    return getattr(request, 'trace_id', None) or uuid.uuid4().hex


def _actor_sesion(request) -> ActorSesionDTO:
    return ActorSesionDTO(
        cuenta_id=getattr(request.user, 'pk', None),
        rol_id=getattr(request.user, 'rol_id', None),
        cedula=str(getattr(request.user, 'cedula_id', '') or '') or None,
    )


def _politica_actor(request, repo_permisos):
    return resolver_politica_actor(repo_permisos, _actor_sesion(request))


def _auditar_denegado(
    request,
    *,
    accion: str,
    recurso_tipo: str,
    recurso_id: str,
    motivo: str,
    detalle: dict | None = None,
) -> None:
    """B1: registra el intento rechazado fuera de la transacción revertida."""
    registrar_auditoria(
        trace_id=_trace(request),
        accion=accion,
        modulo=MODULO_AUDITORIA,
        recurso_tipo=recurso_tipo,
        recurso_id=recurso_id,
        resultado='DENIED',
        estado_previo=detalle or {},
        estado_nuevo={'motivo': motivo},
        **_actor(request),
        **origen_de_peticion(request),
    )


class UsuarioListView(views.APIView):
    """GET /api/v1/identidad/usuarios/ — listado paginado y filtrable (D4)."""

    permission_classes = [IsAuthenticated, PERMISO_VER_USUARIOS]

    @extend_schema(
        tags=['Identidad'],
        summary='Lista las cuentas de usuario (paginado)',
        description=(
            'Filtros: ?cedula=, ?nombre=, ?correo=, ?rol_id= (o ?rol=), '
            '?is_active= y ?condicion=ACTIVO|PASIVO. Paginación: ?pagina= y '
            '?page_size= (10 por defecto, tope 50).'
        ),
        responses={200: CuentaLecturaSerializer(many=True), 403: MensajeRespuestaSerializer},
    )
    def get(self, request):
        filtros = FiltrosUsuarios.desde_parametros(request.query_params.dict())
        paginacion = PaginacionUsuarios.desde_parametros(request.query_params.dict())
        pagina = listar_usuarios_admin(
            RepoCuentasORM(), RepoCondicionTrabajadorORM(), filtros, paginacion
        )
        return ok({
            'resultados': CuentaLecturaSerializer(
                pagina.resultados, many=True, context={'repo': RepoCuentasORM()}
            ).data,
            'total': pagina.total,
            'pagina': pagina.pagina,
            'tamano': pagina.tamano,
            'total_paginas': pagina.total_paginas,
        }, f'{pagina.total} usuario(s) encontrado(s).')


class UsuarioDetalleView(views.APIView):
    """GET /api/v1/identidad/usuarios/{id}/ — detalle con permiso efectivo (D4)."""

    permission_classes = [IsAuthenticated, PERMISO_VER_USUARIOS]

    @extend_schema(
        tags=['Identidad'],
        summary='Detalle de una cuenta con su permiso efectivo',
        description=(
            'El permiso efectivo (rol + overrides allow/deny) se calcula en el '
            'servidor con el motor IAM; el frontend no lo recalcula.'
        ),
        responses={200: UsuarioDetalleSerializer, 403: MensajeRespuestaSerializer, 404: MensajeRespuestaSerializer},
    )
    def get(self, request, id: int):
        detalle = obtener_detalle_usuario(
            RepoCuentasORM(), RepoPermisosORM(), RepoCondicionTrabajadorORM(), id
        )
        return ok(
            UsuarioDetalleSerializer(
                {
                    **detalle.cuenta.__dict__,
                    'permisos': detalle.permisos.__dict__,
                }
            ).data
        )


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
        repo_permisos = RepoPermisosORM()
        rol_id = datos.get('rol_id')
        if rol_id is not None and RepoRolesORM().obtener_por_id(rol_id) is None:
            raise ValidationError('El rol indicado no existe.')

        try:
            validar_asignacion_rol(
                politica_actor=_politica_actor(request, repo_permisos),
                codigos_rol_destino=(
                    repo_permisos.codigos_del_rol(rol_id) if rol_id is not None else frozenset()
                ),
                rol_id=rol_id,
            )
            cuenta = registrar_usuario(
                repo,
                RegistrarCuentaDTO(
                    cedula=str(datos['cedula']),
                    password=datos['password'],
                    rol_id=rol_id,
                ),
            )
        except (PermissionDeniedError, ConflictError) as error:
            _auditar_denegado(
                request,
                accion='identidad.alta_usuario_denegada',
                recurso_tipo=RECURSO_AUDITORIA,
                recurso_id=str(datos['cedula']),
                motivo='Alta de usuario rechazada',
                detalle={'rol_id': rol_id, 'error': type(error).__name__},
            )
            raise
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
        repo_permisos = RepoPermisosORM()
        anterior = repo.obtener_por_id(id)
        if anterior is None:
            raise NotFoundError('El usuario no existe.')

        tocar_rol = 'rol_id' in request.data
        nuevo_rol = datos.get('rol_id') if tocar_rol else anterior.rol_id
        if nuevo_rol is not None and RepoRolesORM().obtener_por_id(nuevo_rol) is None:
            raise ValidationError('El rol indicado no existe.')
        cambia_rol = tocar_rol and nuevo_rol != anterior.rol_id
        motivo = (datos.get('motivo') or '').strip()
        if cambia_rol and len(motivo) < 10:
            raise ValidationError(
                'Indique el motivo del cambio de rol (al menos 10 caracteres).'
            )

        try:
            objetivo_permisos = repo_permisos.obtener_permisos_usuario(anterior.cedula)
            validar_operacion_sobre_cuenta_administrativa(
                politica_actor=_politica_actor(request, repo_permisos),
                politica_objetivo=(
                    objetivo_permisos.politica_efectiva
                    if objetivo_permisos else PoliticaAcceso()
                ),
                operacion='cambiar el rol de',
            )
            validar_cambio_rol(
                actor_id=getattr(request.user, 'pk', None),
                objetivo_id=id,
                cambia_rol=cambia_rol,
            )
            validar_asignacion_rol(
                politica_actor=_politica_actor(request, repo_permisos),
                codigos_rol_destino=(
                    repo_permisos.codigos_del_rol(nuevo_rol)
                    if nuevo_rol is not None else frozenset()
                ),
                rol_id=nuevo_rol,
            )

            with transaction.atomic():
                repo.bloquear_administracion()
                editores_antes = contar_editores_matriz(repo_permisos)
                cuenta = editar_usuario(
                    repo,
                    ActualizarCuentaDTO(
                        id=id,
                        rol_id=nuevo_rol,
                        tocar_rol=tocar_rol,
                    ),
                )
                if cambia_rol:
                    exigir_al_menos_un_editor_matriz(
                        antes=editores_antes,
                        despues=contar_editores_matriz(repo_permisos),
                    )
                    registrar_auditoria(
                        trace_id=_trace(request),
                        accion=ACCION_ROL_ACTUALIZADO,
                        modulo=MODULO_AUDITORIA,
                        recurso_tipo=RECURSO_AUDITORIA,
                        recurso_id=str(id),
                        estado_previo={'rol_id': anterior.rol_id, 'motivo': motivo},
                        estado_nuevo={'rol_id': cuenta.rol_id, 'motivo': motivo},
                        **_actor(request),
                        **origen_de_peticion(request),
                    )
        except (PermissionDeniedError, ConflictError) as error:
            _auditar_denegado(
                request,
                accion=ACCION_ROL_ACTUALIZADO,
                recurso_tipo=RECURSO_AUDITORIA,
                recurso_id=str(id),
                motivo=motivo or 'Cambio de rol rechazado',
                detalle={'rol_anterior': anterior.rol_id, 'rol_nuevo': nuevo_rol,
                         'error': type(error).__name__},
            )
            raise
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
        serializer = CambiarEstadoCuentaSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        is_active = serializer.validated_data['is_active']
        motivo = serializer.validated_data['motivo'].strip()

        repo = RepoCuentasORM()
        repo_permisos = RepoPermisosORM()
        anterior = repo.obtener_por_id(id)
        if anterior is None:
            raise NotFoundError('El usuario no existe.')

        try:
            objetivo_permisos = repo_permisos.obtener_permisos_usuario(anterior.cedula)
            validar_operacion_sobre_cuenta_administrativa(
                politica_actor=_politica_actor(request, repo_permisos),
                politica_objetivo=(
                    objetivo_permisos.politica_efectiva
                    if objetivo_permisos else PoliticaAcceso()
                ),
                operacion='activar o desactivar',
            )
            validar_cambio_estado(
                actor_id=getattr(request.user, 'pk', None),
                objetivo_id=id,
                is_active=is_active,
            )

            with transaction.atomic():
                repo.bloquear_administracion()
                editores_antes = contar_editores_matriz(repo_permisos)
                cuenta = cambiar_estado_usuario(
                    repo, CambiarEstadoCuentaDTO(id=id, is_active=is_active)
                )
                if cuenta.is_active is False:
                    exigir_al_menos_un_editor_matriz(
                        antes=editores_antes,
                        despues=contar_editores_matriz(repo_permisos),
                    )
                registrar_auditoria(
                    trace_id=_trace(request),
                    accion=ACCION_ESTADO_ACTUALIZADO,
                    modulo=MODULO_AUDITORIA,
                    recurso_tipo=RECURSO_AUDITORIA,
                    recurso_id=str(id),
                    estado_previo={'is_active': anterior.is_active, 'motivo': motivo},
                    estado_nuevo={'is_active': cuenta.is_active, 'motivo': motivo},
                    **_actor(request),
                    **origen_de_peticion(request),
                )
        except (PermissionDeniedError, ConflictError) as error:
            _auditar_denegado(
                request,
                accion=ACCION_ESTADO_ACTUALIZADO,
                recurso_tipo=RECURSO_AUDITORIA,
                recurso_id=str(id),
                motivo=motivo,
                detalle={'is_active_anterior': anterior.is_active,
                         'is_active_nuevo': is_active,
                         'error': type(error).__name__},
            )
            raise
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
        request=RestablecerAccesoSerializer,
        responses={
            200: CuentaLecturaSerializer,
            400: MensajeRespuestaSerializer,
            403: MensajeRespuestaSerializer,
            404: MensajeRespuestaSerializer,
        },
    )
    def post(self, request, id: int):
        serializer = RestablecerAccesoSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        motivo = serializer.validated_data['motivo'].strip()

        repo = RepoCuentasORM()
        repo_permisos = RepoPermisosORM()
        lector = obtener_lector_configuracion()
        dias = (
            lector.obtener_entero(CLAVE_PASSWORD_INICIAL_DIAS)
            if lector is not None else 7
        )
        try:
            cuenta = restablecer_acceso(
                repo,
                RepoPasswordInicialORM(),
                RepoPermisosVersionORM(),
                publicar_evento_identidad,
                id,
                timezone.now(),
                dias_vigencia=dias,
                repo_permisos=repo_permisos,
                actor=_actor_sesion(request),
                limpiar_bloqueo=limpiar_bloqueo,
            )
        except PermissionDeniedError as error:
            _auditar_denegado(
                request,
                accion=ACCION_RESTABLECER_ACCESO,
                recurso_tipo=RECURSO_AUDITORIA,
                recurso_id=str(id),
                motivo=motivo,
                detalle={'error': type(error).__name__},
            )
            raise
        registrar_auditoria(
            trace_id=_trace(request),
            accion=ACCION_RESTABLECER_ACCESO,
            modulo=MODULO_AUDITORIA,
            recurso_tipo=RECURSO_AUDITORIA,
            recurso_id=str(id),
            estado_previo={'password_inicial_pendiente': True},
            estado_nuevo={'restablecido': True, 'motivo': motivo},
            **_actor(request),
            **origen_de_peticion(request),
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
        motivo = datos['motivo']

        repo_correo = RepoCorreoAccesoORM()
        correo_anterior = repo_correo.correo_de(cedula)
        try:
            resultado = cambiar_correo_acceso(
                repo_correo,
                RepoCuentasORM(),
                publicar_evento_identidad,
                aprovisionar_eligiendo_correo,
                cedula=cedula,
                fuente=datos['fuente'],
                correo=datos.get('correo'),
                repo_permisos=RepoPermisosORM(),
                actor=_actor_sesion(request),
            )
        except (PermissionDeniedError, ConflictError) as error:
            _auditar_denegado(
                request,
                accion=ACCION_CORREO_ACCESO,
                recurso_tipo=RECURSO_AUDITORIA,
                recurso_id=str(cedula),
                motivo=motivo,
                detalle={'correo_anterior': correo_anterior,
                         'error': type(error).__name__},
            )
            raise
        registrar_auditoria(
            trace_id=_trace(request),
            accion=ACCION_CORREO_ACCESO,
            modulo=MODULO_AUDITORIA,
            recurso_tipo=RECURSO_AUDITORIA,
            recurso_id=str(cedula),
            estado_previo={'correo': correo_anterior, 'motivo': motivo},
            estado_nuevo={'correo': resultado.correo, 'motivo': motivo},
            **_actor(request),
            **origen_de_peticion(request),
        )
        return ok(
            {
                'correo': resultado.correo,
                'cuenta_creada': resultado.cuenta_creada,
                'avisado': resultado.avisado,
            },
            'Correo de acceso registrado.',
        )
