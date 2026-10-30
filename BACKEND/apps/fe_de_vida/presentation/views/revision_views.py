"""
Vistas de BIENESTAR SOCIAL (C5): bandeja, detalle con comparativo, foto (URL prefirmada de 90 s), doble check,
aprobación directa con justificación, rechazo y solicitud de repetición. Vistas delgadas; sin ORM.
"""
from django.db import transaction
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.views import APIView

from apps.fe_de_vida.application.use_cases.consultas import (
    EXPIRA_URL_EVIDENCIA_SEGUNDOS,
    bandeja_revision,
    detalle_para_revision,
    url_evidencia,
)
from apps.fe_de_vida.application.use_cases.revision import (
    aprobar_directo,
    dar_check,
    rechazar,
    devolver,
)
from apps.fe_de_vida.domain.entities.filtros import FiltroBandeja
from apps.fe_de_vida.domain.value_objects.estados import RolRevision
from apps.fe_de_vida.infrastructure.adaptadores_autogestion import (
    AplicadorCambiosActaORM,
    LectorValorActualORM,
    RepoCambiosActaORM,
)
from apps.fe_de_vida.infrastructure.repositories.lector_pasivos_orm import LectorPasivosORM
from apps.fe_de_vida.infrastructure.repositories.repo_solicitudes_orm import RepoSolicitudesFeDeVidaORM
from apps.fe_de_vida.infrastructure.signals import PublicadorSenales
from apps.fe_de_vida.presentation.permissions import fe_de_vida_permissions as permisos
from apps.fe_de_vida.presentation.serializers.fe_de_vida_serializers import (
    DetalleRevisionSerializer,
    FiltroBandejaSerializer,
    JustificacionSerializer,
    DevolverSerializer,
    MotivoSerializer,
    SolicitudSerializer,
    UrlEvidenciaSerializer,
    a_dict_revision,
    a_dict_solicitud,
)
from apps.fe_de_vida.presentation.views._comun import (
    actor_revision,
    ahora,
    auditar,
    cedula_de_sesion,
    parametros_pagina,
    respuesta_pagina,
    resumen,
    validar_entrada,
)
from core.domain.exceptions import PermissionDeniedError
from core.infrastructure.storage.seaweedfs_storage import SeaweedFSStorage
from core.presentation.envelope import ok
from core.presentation.schema import MensajeRespuestaSerializer

TAG = ['Fe de vida · Bienestar']
ERRORES = {400: MensajeRespuestaSerializer, 403: MensajeRespuestaSerializer, 404: MensajeRespuestaSerializer,
           409: MensajeRespuestaSerializer}


class BandejaView(APIView):
    permission_classes = permisos.permisos_bienestar(permisos.REVISAR, permisos.VER_PANEL)

    @extend_schema(
        tags=TAG, summary='Bandeja de fe de vida (paginada y filtrable)',
        parameters=[
            OpenApiParameter('texto', str, description='Cédula o nombre'), OpenApiParameter('estado', str),
            OpenApiParameter('proceso_id', str), OpenApiParameter('desde', str, description='YYYY-MM-DD'),
            OpenApiParameter('hasta', str, description='YYYY-MM-DD'),
            OpenApiParameter('limit', int, description='Por defecto 10, máximo 50'), OpenApiParameter('offset', int),
        ],
        responses={200: SolicitudSerializer(many=True), 400: MensajeRespuestaSerializer, 403: MensajeRespuestaSerializer},
    )
    def get(self, request):
        filtros = validar_entrada(FiltroBandejaSerializer, request.query_params)
        limite, desplazamiento = parametros_pagina(filtros)
        proceso_id = filtros.get('proceso_id')
        filas, total = bandeja_revision(
            RepoSolicitudesFeDeVidaORM(), LectorPasivosORM(), limite=limite, desplazamiento=desplazamiento,
            filtro=FiltroBandeja(
                proceso_id=str(proceso_id) if proceso_id else None, estado=filtros.get('estado'),
                texto=filtros.get('texto'), desde=filtros.get('desde'), hasta=filtros.get('hasta'),
            ),
        )
        return ok(respuesta_pagina(total, filtros, [a_dict_solicitud(s, nombre) for s, nombre in filas]))


class DetalleRevisionView(APIView):
    permission_classes = permisos.permisos_bienestar(permisos.REVISAR, permisos.VER_PANEL)

    @extend_schema(
        tags=TAG, summary='Detalle de una fe de vida con el comparativo valor actual / propuesto',
        responses={200: DetalleRevisionSerializer, 403: MensajeRespuestaSerializer, 404: MensajeRespuestaSerializer},
    )
    def get(self, request, solicitud_id):
        detalle = detalle_para_revision(
            RepoSolicitudesFeDeVidaORM(), RepoCambiosActaORM(), LectorValorActualORM(), LectorPasivosORM(),
            solicitud_id=str(solicitud_id),
        )
        return ok(a_dict_revision(detalle))


class EvidenciaUrlView(APIView):
    permission_classes = permisos.permisos_bienestar(permisos.VER_EVIDENCIA)

    @extend_schema(
        tags=TAG, summary='URL prefirmada de la foto (vigencia corta; cada consulta se audita)',
        responses={200: UrlEvidenciaSerializer, 403: MensajeRespuestaSerializer, 404: MensajeRespuestaSerializer},
    )
    def get(self, request, solicitud_id):
        actor = cedula_de_sesion(request)
        with transaction.atomic():
            url = url_evidencia(
                RepoSolicitudesFeDeVidaORM(), SeaweedFSStorage(), PublicadorSenales(),
                solicitud_id=str(solicitud_id), actor_cedula=actor,
            )
            auditar(request, 'EVIDENCIA_CONSULTADA', str(solicitud_id), None, {'expira_en_segundos': EXPIRA_URL_EVIDENCIA_SEGUNDOS})
        return ok({'url': url, 'expira_en_segundos': EXPIRA_URL_EVIDENCIA_SEGUNDOS})


class CheckView(APIView):
    permission_classes = permisos.permisos_bienestar(permisos.CHECK_ANALISTA, permisos.CHECK_ADMINISTRADORA)

    @extend_schema(
        tags=TAG, summary='Dar mi check (Analista o Administradora, orden indistinto)',
        description='El primer check deja la solicitud en PENDIENTE_SEGUNDO_CHECK; el segundo, de otra persona y del '
                    'otro rol, la valida y aplica el acta a los datos reales. El rol se deduce del permiso.',
        request=None, responses={200: SolicitudSerializer, **ERRORES},
    )
    def post(self, request, solicitud_id):
        actor = actor_revision(request, exigir_check=True)
        with transaction.atomic():
            repo = RepoSolicitudesFeDeVidaORM()
            anterior = repo.obtener(str(solicitud_id))
            previa = resumen(anterior) if anterior else None
            solicitud = dar_check(
                repo, AplicadorCambiosActaORM(), PublicadorSenales(), solicitud_id=str(solicitud_id), actor=actor, ahora=ahora(),
            )
            auditar(request, 'CHECK_DADO', solicitud.id, previa, {**resumen(solicitud), 'rol': actor.rol.value})
        return ok(a_dict_solicitud(solicitud), 'Check registrado.')


class AprobarDirectoView(APIView):
    permission_classes = permisos.permisos_bienestar(permisos.APROBAR_DIRECTO)

    @extend_schema(
        tags=TAG, summary='Aprobación directa de la Administradora (justificación obligatoria)',
        request=JustificacionSerializer, responses={200: SolicitudSerializer, **ERRORES},
    )
    def post(self, request, solicitud_id):
        datos = validar_entrada(JustificacionSerializer, request.data)
        actor = actor_revision(request)
        if actor.rol is not RolRevision.ADMINISTRADORA:
            raise PermissionDeniedError("Solo la Administradora puede aprobar de forma directa.")
        with transaction.atomic():
            solicitud = aprobar_directo(
                RepoSolicitudesFeDeVidaORM(), AplicadorCambiosActaORM(), PublicadorSenales(),
                solicitud_id=str(solicitud_id), actor=actor, justificacion=datos['justificacion'], ahora=ahora(),
            )
            auditar(request, 'APROBACION_DIRECTA_ADMINISTRADORA', solicitud.id, None,
                    {**resumen(solicitud), 'justificacion': datos['justificacion']})
        return ok(a_dict_solicitud(solicitud), 'Fe de vida validada por aprobación directa.')


class RechazarView(APIView):
    permission_classes = permisos.permisos_bienestar(permisos.REVISAR)

    @extend_schema(tags=TAG, summary='Rechazar la fe de vida (motivo obligatorio)',
                   request=MotivoSerializer, responses={200: SolicitudSerializer, **ERRORES})
    def post(self, request, solicitud_id):
        datos = validar_entrada(MotivoSerializer, request.data)
        with transaction.atomic():
            solicitud = rechazar(
                RepoSolicitudesFeDeVidaORM(), PublicadorSenales(), solicitud_id=str(solicitud_id),
                actor=actor_revision(request), motivo=datos['motivo'], ahora=ahora(),
            )
            auditar(request, 'RECHAZADA', solicitud.id, None, {**resumen(solicitud), 'motivo': datos['motivo']})
        return ok(a_dict_solicitud(solicitud), 'Fe de vida rechazada.')


class DevolverView(APIView):
    permission_classes = permisos.permisos_bienestar(permisos.REVISAR)

    @extend_schema(
        tags=TAG, summary='Devolver la fe de vida para corrección (motivo obligatorio)',
        description='El pasivo corrige los datos del acta y reenvía. `requiere_nueva_foto`: además debe cambiar la foto.',
        request=DevolverSerializer, responses={200: SolicitudSerializer, **ERRORES},
    )
    def post(self, request, solicitud_id):
        datos = validar_entrada(DevolverSerializer, request.data)
        with transaction.atomic():
            solicitud = devolver(
                RepoSolicitudesFeDeVidaORM(), PublicadorSenales(), solicitud_id=str(solicitud_id),
                actor=actor_revision(request), motivo=datos['motivo'],
                requiere_nueva_foto=datos['requiere_nueva_foto'], ahora=ahora(),
            )
            auditar(request, 'SOLICITUD_DEVUELTA', solicitud.id, None,
                    {**resumen(solicitud), 'motivo': datos['motivo'], 'requiere_nueva_foto': datos['requiere_nueva_foto']})
        return ok(a_dict_solicitud(solicitud), 'Fe de vida devuelta para corrección.')
