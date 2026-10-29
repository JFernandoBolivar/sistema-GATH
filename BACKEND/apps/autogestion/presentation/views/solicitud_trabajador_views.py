"""
Vistas del TRABAJADOR en la autogestión por solicitud (B4, PLAN_PRIORIDAD §2.1).

Delgadas: validan entrada, invocan casos de uso (que reciben repositorios por inyección) y
responden por el sobre C-1. La cédula sale siempre de la sesión (Zero-IDOR).
"""
from django.db import transaction
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.autogestion.application.dtos.actualizacion_dtos import ItemCambioDTO
from apps.autogestion.application.use_cases.consultas_gestion import (
    listar_mis_solicitudes,
    listar_secciones,
    obtener_clave_soporte,
    obtener_datos_complementarios,
)
from apps.autogestion.application.use_cases.decision_bienestar import obtener_detalle
from apps.autogestion.application.use_cases.edicion_trabajador import (
    adjuntar_soporte,
    eliminar_soporte,
    enviar_solicitud,
    guardar_borrador,
    obtener_solicitud_propia,
)
from apps.autogestion.application.use_cases.solicitud_ciclo import solicitar_actualizacion
from apps.autogestion.infrastructure.repositories.lector_ficha_orm import LectorFichaORM
from apps.autogestion.infrastructure.repositories.repo_cambios_soportes_orm import (
    RepoCambiosPropuestosORM,
    RepoSoportesORM,
)
from apps.autogestion.infrastructure.repositories.repo_secciones_complementarios_orm import (
    RepoDatosComplementariosORM,
    RepoSeccionesORM,
)
from apps.autogestion.infrastructure.repositories.repo_solicitudes_orm import RepoSolicitudesORM
from apps.autogestion.infrastructure.signals import PublicadorSenales
from apps.autogestion.presentation.serializers.actualizacion_serializers import (
    DatosComplementariosSerializer,
    DetalleSolicitudSerializer,
    EnviarSolicitudSerializer,
    GuardarBorradorSerializer,
    SeccionAutogestionableSerializer,
    SolicitarActualizacionSerializer,
    SolicitudSerializer,
    SoporteSerializer,
    SubirSoporteSerializer,
    a_dict_soporte,
    serializar_detalle,
    serializar_solicitud,
)
from apps.autogestion.presentation.views._comun import (
    ahora,
    auditar,
    cedula_de_sesion,
    permisos_trabajador,
    resumen,
    validar_entrada,
)
from core.infrastructure.storage.seaweedfs_storage import SeaweedFSStorage
from core.infrastructure.storage.validacion_archivo import (
    MAX_BYTES_FOTO,
    MAX_BYTES_SOPORTE,
    TIPOS_FOTO,
    TIPOS_SOPORTE,
    validar_archivo,
)
from core.presentation.archivos import respuesta_archivo
from core.presentation.envelope import ok
from core.presentation.permissions import HasPermission, usuario_tiene_permiso
from core.presentation.schema import MensajeRespuestaSerializer

TAG = ['Autogestión · Actualización de datos']
ERRORES = {400: MensajeRespuestaSerializer, 403: MensajeRespuestaSerializer, 404: MensajeRespuestaSerializer,
           409: MensajeRespuestaSerializer}


def _detalle_propio(cedula: str, solicitud_id: str) -> dict:
    repo = RepoSolicitudesORM()
    solicitud = obtener_solicitud_propia(repo, solicitud_id, cedula)
    return serializar_detalle(obtener_detalle(repo, RepoCambiosPropuestosORM(), RepoSoportesORM(), None, solicitud))


class SolicitudesView(APIView):
    """GET lista las solicitudes propias; POST solicita una actualización (condición ACTIVO)."""

    def get_permissions(self):
        if self.request.method == 'POST':
            return [c() for c in permisos_trabajador('autogestion.solicitar_actualizacion')]
        return [IsAuthenticated(), HasPermission('autogestion.ver_propio')()]

    @extend_schema(tags=TAG, summary='Mis solicitudes de actualización', responses={200: SolicitudSerializer(many=True)})
    def get(self, request):
        solicitudes = listar_mis_solicitudes(RepoSolicitudesORM(), cedula_de_sesion(request))
        return ok([serializar_solicitud(s) for s in solicitudes])

    @extend_schema(
        tags=TAG, summary='Solicitar la actualización de mis datos',
        description='Crea la solicitud en estado SOLICITADA (secciones y motivo). Bienestar Social habilita después la ventana.',
        request=SolicitarActualizacionSerializer, responses={201: SolicitudSerializer, **ERRORES},
    )
    def post(self, request):
        datos = validar_entrada(SolicitarActualizacionSerializer, request.data)
        cedula = cedula_de_sesion(request)
        with transaction.atomic():
            solicitud = solicitar_actualizacion(
                RepoSolicitudesORM(), RepoSeccionesORM(), PublicadorSenales(),
                cedula=cedula, secciones=datos['secciones'], motivo=datos['motivo'],
            )
            auditar(request, 'SOLICITUD_CREADA', solicitud.id, None,
                    {**resumen(solicitud), 'secciones': list(solicitud.secciones_solicitadas)})
        return ok(serializar_solicitud(solicitud), 'Solicitud registrada. Bienestar Social habilitará la ventana.', status=201)


class SolicitudDetalleView(APIView):
    permission_classes = [IsAuthenticated, HasPermission('autogestion.ver_propio')]

    @extend_schema(tags=TAG, summary='Detalle de mi solicitud (cambios, soportes y prórrogas)',
                   responses={200: DetalleSolicitudSerializer, 404: MensajeRespuestaSerializer})
    def get(self, request, solicitud_id):
        return ok(_detalle_propio(cedula_de_sesion(request), str(solicitud_id)))


class BorradorView(APIView):
    permission_classes = permisos_trabajador('autogestion.editar_borrador')

    @extend_schema(
        tags=TAG, summary='Guardar el borrador de cambios (reemplaza el anterior)',
        description='Solo con la ventana HABILITADA y vigente. La ficha real NO cambia. La foto se carga por /soportes/.',
        request=GuardarBorradorSerializer, responses={200: DetalleSolicitudSerializer, **ERRORES},
    )
    def put(self, request, solicitud_id):
        datos = validar_entrada(GuardarBorradorSerializer, request.data)
        cedula = cedula_de_sesion(request)
        items = [ItemCambioDTO(
            seccion=i['seccion'], entidad=i['entidad'], accion=i['accion'], campo=i['campo'],
            valor=i['valor'], entidad_id=i.get('entidad_id') or None,
        ) for i in datos['cambios']]
        with transaction.atomic():
            guardar_borrador(
                RepoSolicitudesORM(), RepoCambiosPropuestosORM(), LectorFichaORM(),
                solicitud_id=str(solicitud_id), cedula=cedula, items=items, version=datos.get('version'), ahora=ahora(),
            )
            auditar(request, 'BORRADOR_GUARDADO', str(solicitud_id), None, {'cambios': len(items)})
        return ok(_detalle_propio(cedula, str(solicitud_id)), 'Borrador guardado.')


class SoportesView(APIView):
    permission_classes = permisos_trabajador('autogestion.subir_soporte')
    parser_classes = [MultiPartParser, FormParser]

    @extend_schema(
        tags=TAG, summary='Subir un soporte documental (o la foto)',
        description='multipart: `seccion`, `tipo` y `file`. Formación y grupo familiar exigen al menos un soporte al enviar. '
                    'La foto (`seccion=foto`, `tipo=FOTO`) reemplaza a la anterior y crea el cambio del campo `profile`.',
        request=SubirSoporteSerializer, responses={201: SoporteSerializer, **ERRORES},
    )
    def post(self, request, solicitud_id):
        datos = validar_entrada(SubirSoporteSerializer, request.data)
        archivo = datos['file']
        es_foto = datos['seccion'] == 'foto'
        contenido, tipo, ext = validar_archivo(
            archivo, TIPOS_FOTO if es_foto else TIPOS_SOPORTE, MAX_BYTES_FOTO if es_foto else MAX_BYTES_SOPORTE,
        )
        cedula = cedula_de_sesion(request)
        with transaction.atomic():
            soporte = adjuntar_soporte(
                RepoSolicitudesORM(), RepoSoportesORM(), RepoCambiosPropuestosORM(), LectorFichaORM(), SeaweedFSStorage(),
                solicitud_id=str(solicitud_id), cedula=cedula, seccion=datos['seccion'], tipo=datos['tipo'],
                contenido=contenido, mime=tipo.mime, extension=ext, nombre_original=archivo.name, ahora=ahora(),
            )
            auditar(request, 'SOPORTE_ADJUNTADO', str(solicitud_id), None,
                    {'soporte_id': soporte.id, 'seccion': soporte.seccion, 'tipo': soporte.tipo, 'sha256': soporte.sha256})
        return ok(SoporteSerializer(a_dict_soporte(soporte)).data, 'Soporte cargado.', status=201)


class SoporteBorrarView(APIView):
    permission_classes = permisos_trabajador('autogestion.editar_borrador')

    @extend_schema(tags=TAG, summary='Quitar un soporte del borrador', responses={200: MensajeRespuestaSerializer, **ERRORES})
    def delete(self, request, solicitud_id, soporte_id):
        cedula = cedula_de_sesion(request)
        with transaction.atomic():
            eliminar_soporte(
                RepoSolicitudesORM(), RepoSoportesORM(), RepoCambiosPropuestosORM(),
                solicitud_id=str(solicitud_id), soporte_id=str(soporte_id), cedula=cedula, ahora=ahora(),
            )
            auditar(request, 'SOPORTE_ELIMINADO', str(solicitud_id), None, {'soporte_id': str(soporte_id)})
        return ok({'eliminado': True}, 'Soporte eliminado.')


class EnviarSolicitudView(APIView):
    permission_classes = permisos_trabajador('autogestion.editar_borrador')

    @extend_schema(
        tags=TAG, summary='Enviar la solicitud a Bienestar (cierra la ventana)',
        description='Valida que haya cambios, que la ventana siga vigente y los soportes obligatorios por sección.',
        request=EnviarSolicitudSerializer, responses={200: SolicitudSerializer, **ERRORES},
    )
    def post(self, request, solicitud_id):
        datos = validar_entrada(EnviarSolicitudSerializer, request.data or {})
        cedula = cedula_de_sesion(request)
        with transaction.atomic():
            solicitud = enviar_solicitud(
                RepoSolicitudesORM(), RepoCambiosPropuestosORM(), RepoSoportesORM(), RepoSeccionesORM(),
                PublicadorSenales(), solicitud_id=str(solicitud_id), cedula=cedula,
                version=datos.get('version'), ahora=ahora(),
            )
            auditar(request, 'SOLICITUD_ENVIADA', solicitud.id, {'estado': 'HABILITADA'}, resumen(solicitud))
        return ok(serializar_solicitud(solicitud), 'Solicitud enviada a Bienestar Social.')


class SoporteArchivoView(APIView):
    """Sirve el soporte por streaming: solo su dueño o Bienestar (`bienestar.ver_solicitudes`)."""

    permission_classes = [IsAuthenticated]

    @extend_schema(tags=TAG, summary='Descargar un soporte (binario)', responses={200: OpenApiTypes.BINARY, 404: MensajeRespuestaSerializer})
    def get(self, request, soporte_id):
        soporte = obtener_clave_soporte(
            RepoSoportesORM(), str(soporte_id), str(getattr(request.user, 'cedula_id', '') or ''),
            usuario_tiene_permiso(request.user, 'bienestar.ver_solicitudes'),
        )
        return respuesta_archivo(SeaweedFSStorage(), soporte.clave_s3, cache='private, no-store')


class SeccionesView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(tags=TAG, summary='Secciones autogestionables activas', responses={200: SeccionAutogestionableSerializer(many=True)})
    def get(self, request):
        secciones = listar_secciones(RepoSeccionesORM(), solo_activas=True)
        return ok(SeccionAutogestionableSerializer(
            [{'codigo': s.codigo, 'nombre': s.nombre, 'requiere_soporte': s.requiere_soporte, 'activa': s.activa} for s in secciones],
            many=True,
        ).data)


class MisDatosComplementariosView(APIView):
    permission_classes = [IsAuthenticated, HasPermission('autogestion.ver_propio')]

    @extend_schema(tags=TAG, summary='Mis datos complementarios (correo alternativo, ¿tiene hijos?)',
                   responses={200: DatosComplementariosSerializer})
    def get(self, request):
        datos = obtener_datos_complementarios(RepoDatosComplementariosORM(), cedula_de_sesion(request))
        return ok(DatosComplementariosSerializer(datos).data)

