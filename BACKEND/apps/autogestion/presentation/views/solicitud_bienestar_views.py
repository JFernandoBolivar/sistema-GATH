"""
Vistas de BIENESTAR SOCIAL en la autogestión por solicitud (B4, PLAN_PRIORIDAD §2.1 y §2.4).

Habilitar/prorrogar la ventana, revisar el comparativo y decidir campo por campo con UNA sola
persona (`bienestar.aprobar`: Analista o Administradora). Vistas delgadas; sin ORM.
"""
from django.db import transaction
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.autogestion.application.dtos.actualizacion_dtos import DecisionCampoDTO
from apps.autogestion.application.use_cases.consultas_gestion import (
    configurar_seccion,
    guardar_datos_complementarios,
    listar_bandeja,
    obtener_datos_complementarios,
)
from apps.autogestion.application.use_cases.decision_bienestar import (
    decidir_cambios,
    obtener_comparativo,
    obtener_detalle,
    rechazar_solicitud,
)
from apps.autogestion.application.use_cases.solicitud_ciclo import (
    habilitar_ventana,
    obtener_solicitud,
    prorrogar_ventana,
)
from apps.autogestion.domain.value_objects.estado_solicitud import EstadoSolicitud
from apps.autogestion.infrastructure.repositories.aplicador_cambios_orm import AplicadorCambiosORM
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
    ConfigurarSeccionSerializer,
    DatosComplementariosEscrituraSerializer,
    DatosComplementariosSerializer,
    DecidirCambiosSerializer,
    DetalleSolicitudSerializer,
    HabilitarVentanaSerializer,
    ListaSolicitudesSerializer,
    ProrrogarVentanaSerializer,
    RechazarSolicitudSerializer,
    SeccionAutogestionableSerializer,
    SolicitudSerializer,
    a_dict_solicitud,
    serializar_detalle,
    serializar_solicitud,
)
from apps.autogestion.presentation.views._comun import (
    ahora,
    auditar,
    cedula_de_sesion,
    resumen,
    validar_entrada,
)
from core.domain.exceptions import PermissionDeniedError
from core.presentation.envelope import ok
from core.presentation.permissions import HasPermission, usuario_tiene_permiso
from core.presentation.schema import MensajeRespuestaSerializer

TAG = ['Bienestar · Actualización de datos']
ERRORES = {400: MensajeRespuestaSerializer, 403: MensajeRespuestaSerializer, 404: MensajeRespuestaSerializer,
           409: MensajeRespuestaSerializer}


def _entero(valor, defecto: int) -> int:
    try:
        return int(valor)
    except (TypeError, ValueError):
        return defecto


class BandejaView(APIView):
    permission_classes = [IsAuthenticated, HasPermission('bienestar.ver_solicitudes')]

    @extend_schema(
        tags=TAG, summary='Bandeja de solicitudes de actualización',
        parameters=[
            OpenApiParameter('estado', str, description='SOLICITADA, HABILITADA, ENVIADA, APROBADA, APROBADA_PARCIAL, RECHAZADA o EXPIRADA'),
            OpenApiParameter('cedula', str, description='Cédula del trabajador'),
            OpenApiParameter('limit', int, description='Por defecto 20, máximo 100'),
            OpenApiParameter('offset', int),
        ],
        responses={200: ListaSolicitudesSerializer, 403: MensajeRespuestaSerializer},
    )
    def get(self, request):
        limite, desplazamiento = _entero(request.query_params.get('limit'), 20), _entero(request.query_params.get('offset'), 0)
        solicitudes, total = listar_bandeja(
            RepoSolicitudesORM(), estado=request.query_params.get('estado'),
            cedula=request.query_params.get('cedula'), limite=limite, desplazamiento=desplazamiento,
        )
        return ok({
            'count': total, 'limit': max(1, min(limite, 100)), 'offset': max(0, desplazamiento),
            'results': [a_dict_solicitud(s) for s in solicitudes],
        })


class DetalleBienestarView(APIView):
    permission_classes = [IsAuthenticated, HasPermission('bienestar.ver_solicitudes')]

    @extend_schema(tags=TAG, summary='Detalle de una solicitud (cambios, soportes y prórrogas)',
                   responses={200: DetalleSolicitudSerializer, 404: MensajeRespuestaSerializer})
    def get(self, request, solicitud_id):
        repo = RepoSolicitudesORM()
        solicitud = obtener_solicitud(repo, str(solicitud_id))
        return ok(serializar_detalle(obtener_detalle(repo, RepoCambiosPropuestosORM(), RepoSoportesORM(), None, solicitud)))


class ComparativoView(APIView):
    permission_classes = [IsAuthenticated, HasPermission('bienestar.revisar_actualizacion')]

    @extend_schema(
        tags=TAG, summary='Comparativo valor actual / propuesto',
        description='Cada cambio trae `valor_anterior` (al proponer), `valor_actual` (hoy) y `conflicto` si la ficha cambió.',
        responses={200: DetalleSolicitudSerializer, 404: MensajeRespuestaSerializer},
    )
    def get(self, request, solicitud_id):
        dto = obtener_comparativo(
            RepoSolicitudesORM(), RepoCambiosPropuestosORM(), RepoSoportesORM(), LectorFichaORM(),
            solicitud_id=str(solicitud_id),
        )
        return ok(serializar_detalle(dto))


class HabilitarVentanaView(APIView):
    permission_classes = [IsAuthenticated, HasPermission('bienestar.habilitar_ventana')]

    @extend_schema(
        tags=TAG, summary='Habilitar la ventana de actualización (plazo configurable)',
        request=HabilitarVentanaSerializer, responses={200: SolicitudSerializer, **ERRORES},
    )
    def post(self, request, solicitud_id):
        datos = validar_entrada(HabilitarVentanaSerializer, request.data)
        with transaction.atomic():
            solicitud = habilitar_ventana(
                RepoSolicitudesORM(), PublicadorSenales(), solicitud_id=str(solicitud_id),
                plazo_dias=datos['plazo_dias'], secciones=datos.get('secciones'),
                actor=cedula_de_sesion(request), ahora=ahora(),
            )
            auditar(request, 'VENTANA_HABILITADA', solicitud.id, {'estado': 'SOLICITADA'},
                    {**resumen(solicitud), 'plazo_dias': solicitud.plazo_dias,
                     'ventana_fin': solicitud.ventana_fin.isoformat(), 'secciones': list(solicitud.secciones_habilitadas)})
        return ok(serializar_solicitud(solicitud), 'Ventana de actualización habilitada.')


class ProrrogarVentanaView(APIView):
    permission_classes = [IsAuthenticated, HasPermission('bienestar.prorrogar_ventana')]

    @extend_schema(
        tags=TAG, summary='Prorrogar la ventana (nueva fecha límite y motivo; repetible)',
        request=ProrrogarVentanaSerializer, responses={200: SolicitudSerializer, **ERRORES},
    )
    def post(self, request, solicitud_id):
        datos = validar_entrada(ProrrogarVentanaSerializer, request.data)
        with transaction.atomic():
            solicitud = prorrogar_ventana(
                RepoSolicitudesORM(), PublicadorSenales(), solicitud_id=str(solicitud_id),
                nueva_fin=datos['nueva_fecha_fin'], motivo=datos['motivo'],
                actor=cedula_de_sesion(request), ahora=ahora(),
            )
            auditar(request, 'VENTANA_PRORROGADA', solicitud.id, None,
                    {**resumen(solicitud), 'ventana_fin': solicitud.ventana_fin.isoformat(), 'motivo': datos['motivo']})
        return ok(serializar_solicitud(solicitud), 'Ventana prorrogada.')


class DecidirView(APIView):
    permission_classes = [IsAuthenticated, HasPermission('bienestar.aprobar')]

    @extend_schema(
        tags=TAG, summary='Decidir campo por campo (aprobación total, parcial o rechazo) — una sola persona',
        description=(
            'Debe decidir TODOS los cambios pendientes. Todo aprobado -> APROBADA; mezcla -> APROBADA_PARCIAL; '
            'nada aprobado -> RECHAZADA (exige `motivo_general`). SOLO lo aprobado se escribe en la ficha, en una '
            'transacción. Un campo cuya ficha cambió tras la propuesta (`conflicto`) no puede aprobarse (409). '
            'Quien decide no puede ser el propio solicitante.'
        ),
        request=DecidirCambiosSerializer, responses={200: DetalleSolicitudSerializer, **ERRORES},
    )
    def post(self, request, solicitud_id):
        datos = validar_entrada(DecidirCambiosSerializer, request.data)
        decisiones = [DecisionCampoDTO(str(d['cambio_id']), d['aprobado'], d.get('motivo', '')) for d in datos['decisiones']]
        with transaction.atomic():
            dto = decidir_cambios(
                RepoSolicitudesORM(), RepoCambiosPropuestosORM(), RepoSoportesORM(), LectorFichaORM(),
                AplicadorCambiosORM(), PublicadorSenales(),
                solicitud_id=str(solicitud_id), decisiones=decisiones, version=datos['version'],
                actor=cedula_de_sesion(request), motivo_general=datos.get('motivo_general', ''), ahora=ahora(),
            )
            auditar(request, 'ACTUALIZACION_DECIDIDA', dto.solicitud.id, {'estado': 'ENVIADA'}, {
                **resumen(dto.solicitud),
                'campos': [{'id': c.cambio.id, 'seccion': c.cambio.seccion, 'campo': c.cambio.campo,
                            'decision': c.cambio.decision.value, 'motivo': c.cambio.motivo_decision}
                           for c in dto.cambios],
            })
        return ok(serializar_detalle(dto), 'Decisión registrada.')


class RechazarView(APIView):
    permission_classes = [IsAuthenticated, HasPermission('bienestar.revisar_actualizacion')]

    @extend_schema(
        tags=TAG, summary='Rechazar la solicitud completa con motivo',
        description='De una SOLICITADA (sin habilitar) o de una ENVIADA (sin aplicar nada). Rechazar una ENVIADA exige `bienestar.aprobar`.',
        request=RechazarSolicitudSerializer, responses={200: SolicitudSerializer, **ERRORES},
    )
    def post(self, request, solicitud_id):
        datos = validar_entrada(RechazarSolicitudSerializer, request.data)
        repo = RepoSolicitudesORM()
        with transaction.atomic():
            actual = obtener_solicitud(repo, str(solicitud_id))
            if actual.estado is EstadoSolicitud.ENVIADA and not usuario_tiene_permiso(request.user, 'bienestar.aprobar'):
                raise PermissionDeniedError("Rechazar una solicitud enviada requiere el permiso 'bienestar.aprobar'.")
            solicitud = rechazar_solicitud(
                repo, RepoCambiosPropuestosORM(), PublicadorSenales(), solicitud_id=str(solicitud_id),
                motivo=datos['motivo'], version=datos.get('version'), actor=cedula_de_sesion(request), ahora=ahora(),
            )
            auditar(request, 'SOLICITUD_RECHAZADA', solicitud.id, {'estado': actual.estado.value},
                    {**resumen(solicitud), 'motivo': datos['motivo']})
        return ok(serializar_solicitud(solicitud), 'Solicitud rechazada.')


class SeccionConfigurarView(APIView):
    permission_classes = [IsAuthenticated, HasPermission('bienestar.configurar_secciones')]

    @extend_schema(
        tags=TAG, summary='Configurar una sección (¿exige soporte? ¿está activa?)',
        request=ConfigurarSeccionSerializer, responses={200: SeccionAutogestionableSerializer, **ERRORES},
    )
    def patch(self, request, codigo):
        datos = validar_entrada(ConfigurarSeccionSerializer, request.data)
        s = configurar_seccion(
            RepoSeccionesORM(), codigo=codigo,
            requiere_soporte=datos.get('requiere_soporte'), activa=datos.get('activa'),
        )
        return ok(SeccionAutogestionableSerializer(
            {'codigo': s.codigo, 'nombre': s.nombre, 'requiere_soporte': s.requiere_soporte, 'activa': s.activa},
        ).data, 'Sección actualizada.')


class DatosComplementariosRRHHView(APIView):
    """Ficha complementaria de cualquier trabajador (RRHH): correo alternativo y «¿tiene hijos?»."""

    def get_permissions(self):
        codigo = 'personal.editar_personales' if self.request.method == 'PUT' else 'personal.ver_detalle'
        return [IsAuthenticated(), HasPermission(codigo)()]

    @extend_schema(tags=TAG, summary='Datos complementarios de un trabajador', responses={200: DatosComplementariosSerializer})
    def get(self, request, cedula):
        return ok(DatosComplementariosSerializer(obtener_datos_complementarios(RepoDatosComplementariosORM(), cedula)).data)

    @extend_schema(
        tags=TAG, summary='Registrar/corregir datos complementarios (RRHH)',
        request=DatosComplementariosEscrituraSerializer, responses={200: DatosComplementariosSerializer, **ERRORES},
    )
    def put(self, request, cedula):
        datos = validar_entrada(DatosComplementariosEscrituraSerializer, request.data)
        guardados = guardar_datos_complementarios(
            RepoDatosComplementariosORM(), cedula=cedula, campos=dict(datos), actor_cedula=cedula_de_sesion(request),
        )
        return ok(DatosComplementariosSerializer(guardados).data, 'Datos complementarios guardados.')
