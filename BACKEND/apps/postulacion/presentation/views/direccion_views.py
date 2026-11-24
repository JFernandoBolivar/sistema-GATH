"""Vistas de Dirección General (E-6): bandeja de ingresos, detalle y decisión sobre el Punto de Cuenta."""
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.postulacion.application.use_cases.direccion import filtros_direccion, transicionar_direccion
from apps.postulacion.application.use_cases.presupuesto import listar_bandeja_enriquecida
from apps.postulacion.domain.services.maquina_estados import P_APROBAR_INGRESO, P_VER_INGRESOS
from apps.postulacion.domain.value_objects.estados import EstadoExpediente
from apps.postulacion.infrastructure.repositories.repo_postulacion_orm import RepoPostulacionORM
from apps.postulacion.presentation.serializers.postulacion_serializers import (
    BandejaRespuestaSerializer,
    DetalleAreaSerializer,
    FiltrosSolicitudesSerializer,
    TransicionAreaSerializer,
)
from apps.postulacion.presentation.views._comun import (
    PERMISOS_DE_DIRECCION,
    ErroresConCodigoMixin,
    a_dict_fila_area,
    actor_con_permisos,
    ahora,
    auditar_captacion,
    configuracion,
    sin_cache,
    validar_entrada,
)
from apps.postulacion.presentation.views.presupuesto_views import (
    ERRORES,
    ConstanciaAdjuntoView,
    PuntoCuentaDocumentoView,
    VistaConPermiso,
    _detalle,
)
from core.domain.paginacion import Paginacion
from core.infrastructure.providers import obtener_notificador
from core.presentation.envelope import ok
from core.presentation.permissions import HasPermission

TAG = ['Postulación · Dirección General']
PRIORITARIOS = (EstadoExpediente.EN_DIRECCION_GENERAL,)


def _detalle_direccion(request, expediente_id: str) -> dict:
    return _detalle(request, expediente_id, area='direccion', permisos=PERMISOS_DE_DIRECCION)


class IngresosView(VistaConPermiso):
    permiso = P_VER_INGRESOS

    @extend_schema(
        tags=TAG, summary='Bandeja de Dirección General: ingresos pendientes e histórico',
        parameters=[
            OpenApiParameter('vista', str, enum=['pendientes', 'historico', 'todos'], description='`pendientes`: EN_DIRECCION_GENERAL. `historico`: con Punto de Cuenta FIRMADO o RECHAZADO (aunque el expediente ya haya avanzado). `todos` (por defecto): ambos.'),
            OpenApiParameter('estado', str, many=True, description='EN_DIRECCION_GENERAL, APROBADO o RECHAZADO_DIRECCION (mandan sobre `vista`).'),
            OpenApiParameter('q', str, description='Cédula, nombre o número de expediente.'),
            OpenApiParameter('desde', OpenApiTypes.DATE), OpenApiParameter('hasta', OpenApiTypes.DATE),
            OpenApiParameter('pagina', int), OpenApiParameter('page_size', int),
        ],
        description="Orden: primero los EN_DIRECCION_GENERAL y luego por fecha del último cambio, el más antiguo primero.",
        responses={200: BandejaRespuestaSerializer, **ERRORES},
    )
    def get(self, request):
        params = request.query_params
        entrada = validar_entrada(FiltrosSolicitudesSerializer, {
            'estado': [e.strip() for valor in params.getlist('estado') for e in valor.split(',') if e.strip()],
            **{k: params[k] for k in ('vista', 'q', 'desde', 'hasta') if k in params},
        })
        filtros = filtros_direccion(
            entrada.get('vista'), entrada.get('estado'), entrada.get('q'), entrada.get('desde'), entrada.get('hasta'),
        )
        paginacion = Paginacion.desde_parametros(params)
        filas, total = listar_bandeja_enriquecida(RepoPostulacionORM(), filtros, paginacion)
        return sin_cache(ok(paginacion.envolver([a_dict_fila_area(f, PRIORITARIOS) for f in filas], total)))


class IngresoDetalleView(VistaConPermiso):
    permiso = P_VER_INGRESOS

    @extend_schema(
        tags=TAG, summary='Detalle del ingreso: postulante, cargo, constancia, Punto de Cuenta, historial y acciones',
        description=(
            "Incluye `documentos.punto_cuenta` (ruta de descarga del PDF) y `acciones` (aprobar o rechazar, según el "
            "permiso de quien consulta). Solo expedientes que llegaron a Dirección General (si no, 404)."
        ),
        responses={200: DetalleAreaSerializer, **ERRORES},
    )
    def get(self, request, expediente_id):
        return sin_cache(ok(_detalle_direccion(request, str(expediente_id))))


class IngresoTransicionView(ErroresConCodigoMixin, APIView):
    permission_classes = [IsAuthenticated, HasPermission(P_APROBAR_INGRESO)]

    @extend_schema(
        tags=TAG, summary='Aprobar o rechazar el ingreso', request=TransicionAreaSerializer,
        description=(
            "`APROBADO` (marca el Punto de Cuenta FIRMADO) o `RECHAZADO_DIRECCION` (motivo obligatorio; libera la reserva "
            "y marca el Punto de Cuenta RECHAZADO). Ambos exigen `aprobar_ingreso`. Errores: `data.codigo` = "
            "TRANSICION_NO_PERMITIDA, EXPEDIENTE_FINAL, SIN_PERMISO, MOTIVO_OBLIGATORIO, DESTINO_INVALIDO, NO_ENCONTRADO."
        ),
        responses={200: DetalleAreaSerializer, **ERRORES},
    )
    def post(self, request, expediente_id):
        datos = validar_entrada(TransicionAreaSerializer, request.data)
        r = transicionar_direccion(
            RepoPostulacionORM(), configuracion(), obtener_notificador(), expediente_id=str(expediente_id),
            destino=datos['destino'], actor=actor_con_permisos(request, PERMISOS_DE_DIRECCION),
            motivo=datos.get('motivo', ''), ahora=ahora(),
        )
        exp = r.expediente
        auditar_captacion(request, 'INGRESO_TRANSICION', exp.id, {
            'numero': exp.numero, 'origen': r.origen, 'destino': exp.estado.value, 'motivo': datos.get('motivo', ''),
            'reserva_liberada': r.reserva_liberada.puesto_id if r.reserva_liberada else None,
        })
        return sin_cache(ok(_detalle_direccion(request, exp.id), f'Ingreso: {exp.estado.value}.'))


class IngresoPuntoCuentaDocumentoView(PuntoCuentaDocumentoView):
    area = 'direccion'


class IngresoConstanciaAdjuntoView(ConstanciaAdjuntoView):
    area = 'direccion'
