"""Vistas de Presupuesto (E-1 a E-5): bandeja, detalle, vacantes, reserva, constancia, transición y Punto de Cuenta."""
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.postulacion.application.use_cases.constancia import (
    PREFIJO_CLAVE_CONSTANCIA,
    DeclaranteConstancia,
    declarar_disponibilidad,
)
from apps.postulacion.application.use_cases.presupuesto import (
    adjunto_constancia,
    detalle_area,
    documento_punto_cuenta,
    filtros_presupuesto,
    listar_bandeja_enriquecida,
    transicionar_presupuesto,
)
from apps.postulacion.application.use_cases.psicofisico import InformeSubido
from apps.postulacion.application.use_cases.reservas import (
    FiltrosVacantesEntrada,
    liberar_reserva,
    reservar_puesto,
    vacantes_del_expediente,
)
from apps.postulacion.domain.entities.expediente import ExpedientePostulacion
from apps.postulacion.domain.services.maquina_estados import (
    P_DECLARAR_DISPONIBILIDAD,
    P_DEVOLVER_SOLICITUD,
    P_EMITIR_PUNTO_CUENTA,
    P_RESERVAR_PUESTO,
    P_VER_INGRESOS,
    P_VER_SOLICITUDES,
)
from apps.postulacion.domain.value_objects.estados import EstadoExpediente
from apps.postulacion.infrastructure.emisor_punto_cuenta import EmisorPuntoCuentaORM
from apps.postulacion.infrastructure.repositories.puestos_vacantes_orm import PuestosVacantesORM
from apps.postulacion.infrastructure.repositories.repo_postulacion_orm import CatalogoPropuestaORM, RepoPostulacionORM
from apps.postulacion.presentation.serializers.postulacion_serializers import (
    BandejaRespuestaSerializer,
    ConstanciaSerializer,
    DetalleAreaSerializer,
    FiltrosSolicitudesSerializer,
    FiltrosVacantesSerializer,
    LiberarReservaSerializer,
    ReservaSerializer,
    TransicionAreaSerializer,
    VacantesRespuestaSerializer,
)
from apps.postulacion.presentation.views._comun import (
    PERMISOS_DE_PRESUPUESTO,
    ErroresConCodigoMixin,
    a_dict_detalle_area,
    a_dict_fila_area,
    a_dict_puesto,
    a_dict_reserva,
    actor_con_permisos,
    ahora,
    auditar_captacion,
    configuracion,
    quien_actua,
    sin_cache,
    validar_entrada,
)
from core.domain.paginacion import Paginacion
from core.infrastructure.providers import obtener_notificador
from core.infrastructure.storage.seaweedfs_storage import SeaweedFSStorage
from core.infrastructure.storage.validacion_archivo import MAX_BYTES_DOCUMENTO, PDF, clave_segura, validar_archivo
from core.presentation.archivos import respuesta_archivo
from core.presentation.envelope import ok
from core.presentation.permissions import HasAnyPermission, HasPermission
from core.presentation.schema import MensajeRespuestaSerializer

TAG = ['Postulación · Presupuesto']
ERRORES = {
    400: MensajeRespuestaSerializer, 401: MensajeRespuestaSerializer, 403: MensajeRespuestaSerializer,
    404: MensajeRespuestaSerializer, 409: MensajeRespuestaSerializer,
}
E = EstadoExpediente
PRIORITARIOS = (E.EN_PRESUPUESTO,)


class VistaConPermiso(ErroresConCodigoMixin, APIView):
    """Base: empleado autenticado + código de permiso `postulacion.*`; los errores de dominio llevan `data.codigo`."""

    permiso: str = P_VER_SOLICITUDES

    def get_permissions(self):
        return [IsAuthenticated(), HasPermission(self.permiso)()]


def _detalle(request, expediente_id: str, area: str = 'presupuesto', permisos=PERMISOS_DE_PRESUPUESTO) -> dict:
    actor = actor_con_permisos(request, permisos)
    return a_dict_detalle_area(detalle_area(
        RepoPostulacionORM(), PuestosVacantesORM(), CatalogoPropuestaORM(), expediente_id=expediente_id,
        permisos=actor.permisos, area=area,
    ), area)


def _descargar_pdf(clave: str, nombre: str):
    respuesta = respuesta_archivo(SeaweedFSStorage(), clave, cache='private, no-store', mime='application/pdf')
    respuesta['Content-Disposition'] = f'attachment; filename="{nombre}"'
    return respuesta


class SolicitudesView(VistaConPermiso):
    permiso = P_VER_SOLICITUDES

    @extend_schema(
        tags=TAG, summary='Bandeja de Presupuesto (paginada y filtrable)',
        parameters=[
            OpenApiParameter('vista', str, enum=['pendientes', 'todos'], description='`pendientes` (por defecto): EN_PRESUPUESTO, DIFERIDO_PRESUPUESTO y EN_CORRECCION_CARGO. `todos`: todo lo que llegó a Presupuesto.'),
            OpenApiParameter('estado', str, many=True, description='Estado(s) explícitos (mandan sobre `vista`).'),
            OpenApiParameter('q', str, description='Cédula, nombre o número de expediente.'),
            OpenApiParameter('desde', OpenApiTypes.DATE), OpenApiParameter('hasta', OpenApiTypes.DATE),
            OpenApiParameter('pagina', int), OpenApiParameter('page_size', int),
        ],
        description="Orden: primero los EN_PRESUPUESTO y luego por fecha del último cambio, el más antiguo primero.",
        responses={200: BandejaRespuestaSerializer, **ERRORES},
    )
    def get(self, request):
        params = request.query_params
        entrada = validar_entrada(FiltrosSolicitudesSerializer, {
            'estado': [e.strip() for valor in params.getlist('estado') for e in valor.split(',') if e.strip()],
            **{k: params[k] for k in ('vista', 'q', 'desde', 'hasta') if k in params},
        })
        filtros = filtros_presupuesto(
            entrada.get('vista'), entrada.get('estado'), entrada.get('q'), entrada.get('desde'), entrada.get('hasta'),
        )
        paginacion = Paginacion.desde_parametros(params)
        filas, total = listar_bandeja_enriquecida(RepoPostulacionORM(), filtros, paginacion)
        return sin_cache(ok(paginacion.envolver([a_dict_fila_area(f, PRIORITARIOS) for f in filas], total)))


class SolicitudDetalleView(VistaConPermiso):
    permiso = P_VER_SOLICITUDES

    @extend_schema(
        tags=TAG, summary='Detalle de la solicitud: propuesta, reserva, constancia, Punto de Cuenta, historial y acciones',
        description=(
            "`acciones` sale de la máquina de estados y de los permisos de quien consulta (`bloqueada` + `motivo_bloqueo` "
            "cuando falta la reserva vigente o la constancia). `capacidades` indica si puede reservar el puesto y declarar "
            "la disponibilidad. No incluye la Ventana 1 ni los datos de contacto. Solo expedientes que ya llegaron a Presupuesto (si no, 404)."
        ),
        responses={200: DetalleAreaSerializer, **ERRORES},
    )
    def get(self, request, expediente_id):
        return sin_cache(ok(_detalle(request, str(expediente_id))))


class VacantesView(VistaConPermiso):
    permiso = P_RESERVAR_PUESTO

    @extend_schema(
        tags=TAG, summary='Puestos vacantes compatibles con la propuesta del expediente',
        parameters=[
            OpenApiParameter('cargo', int, description='Id de la denominación de cargo (reemplaza al cargo de la propuesta).'),
            OpenApiParameter('oficina', int, description='Id de la dirección general (reemplaza a la oficina de la propuesta).'),
            OpenApiParameter('dependencia', int), OpenApiParameter('direccion_linea', int), OpenApiParameter('coordinacion', int),
            OpenApiParameter('q', str, description='Código, denominación o unidad.'),
            OpenApiParameter('pagina', int), OpenApiParameter('page_size', int),
        ],
        description=(
            "Sin filtros, rige la propuesta del expediente: mismo cargo y la jerarquía de oficina propuesta. Cualquier "
            "criterio de oficina (`oficina`, `dependencia`, `direccion_linea`, `coordinacion`) reemplaza TODA la oficina de la "
            "propuesta; `cargo` reemplaza al cargo. Excluye los puestos con una reserva ACTIVA de OTRO expediente (la "
            "propia se muestra). Respuesta paginada con `filtros` (lo aplicado) y `reserva` (la del expediente)."
        ),
        responses={200: VacantesRespuestaSerializer, **ERRORES},
    )
    def get(self, request, expediente_id):
        entrada = validar_entrada(FiltrosVacantesSerializer, request.query_params)
        paginacion = Paginacion.desde_parametros(request.query_params)
        r = vacantes_del_expediente(
            RepoPostulacionORM(), PuestosVacantesORM(), expediente_id=str(expediente_id),
            entrada=FiltrosVacantesEntrada(
                cargo_id=entrada.get('cargo'), dependencia_id=entrada.get('dependencia'),
                direccion_general_id=entrada.get('oficina'), direccion_linea_id=entrada.get('direccion_linea'),
                coordinacion_id=entrada.get('coordinacion'), texto=(entrada.get('q') or '').strip(),
            ),
            paginacion=paginacion,
        )
        cuerpo = paginacion.envolver([
            {**a_dict_puesto(p), 'reserva_propia': bool(r.reserva_propia and r.reserva_propia.puesto_id == p.id)}
            for p in r.puestos
        ], r.total)
        cuerpo['filtros'] = {
            'cargo': r.filtro.cargo_id, 'dependencia': r.filtro.dependencia_id, 'oficina': r.filtro.direccion_general_id,
            'direccion_linea': r.filtro.direccion_linea_id, 'coordinacion': r.filtro.coordinacion_id,
            'q': r.filtro.texto, 'de_propuesta': r.de_propuesta,
        }
        cuerpo['reserva'] = a_dict_reserva(r.reserva_propia)
        return sin_cache(ok(cuerpo))


class ReservaView(VistaConPermiso):
    permiso = P_RESERVAR_PUESTO

    @extend_schema(
        tags=TAG, summary='Reservar un puesto para el expediente (o cambiar la reserva)', request=ReservaSerializer,
        description=(
            "Solo con el expediente EN_PRESUPUESTO. Bloquea el puesto y revalida que siga vacante y sin otra reserva; "
            "vence a los `captacion.vigencia_reserva_puesto_dias` días. Cambiar de puesto libera la reserva anterior "
            "(motivo «cambio de puesto»); reservar el mismo puesto no cambia nada. Responde el detalle de la solicitud. "
            "Errores: `data.codigo` = EXPEDIENTE_NO_EN_PRESUPUESTO, PUESTO_NO_ENCONTRADO, PUESTO_NO_VACANTE, PUESTO_RESERVADO."
        ),
        responses={200: DetalleAreaSerializer, **ERRORES},
    )
    def post(self, request, expediente_id):
        datos = validar_entrada(ReservaSerializer, request.data)
        nueva, liberada = reservar_puesto(
            RepoPostulacionORM(), PuestosVacantesORM(), configuracion(), expediente_id=str(expediente_id),
            puesto_id=datos['puesto_id'], reservado_por=quien_actua(request).cedula, ahora=ahora(),
        )
        auditar_captacion(request, 'RESERVA_PUESTO', str(expediente_id), {
            'puesto_id': nueva.puesto_id, 'vence_el': nueva.vence_el.isoformat(),
            'libera_puesto_id': liberada.puesto_id if liberada else None,
        })
        return sin_cache(ok(_detalle(request, str(expediente_id)), 'Puesto reservado.'))

    @extend_schema(
        tags=TAG, summary='Liberar la reserva del expediente', request=LiberarReservaSerializer,
        responses={200: DetalleAreaSerializer, **ERRORES},
    )
    def delete(self, request, expediente_id):
        datos = validar_entrada(LiberarReservaSerializer, request.data or {})
        liberada = liberar_reserva(
            RepoPostulacionORM(), expediente_id=str(expediente_id), motivo=datos.get('motivo', ''), ahora=ahora(),
        )
        auditar_captacion(request, 'RESERVA_PUESTO_LIBERADA', str(expediente_id), {
            'puesto_id': liberada.puesto_id, 'motivo': liberada.motivo_liberacion,
        })
        return sin_cache(ok(_detalle(request, str(expediente_id)), 'Reserva liberada.'))


class ConstanciaView(VistaConPermiso):
    permiso = P_DECLARAR_DISPONIBILIDAD
    parser_classes = [MultiPartParser, FormParser]

    @extend_schema(
        tags=TAG, summary='Declarar la disponibilidad presupuestaria (constancia)',
        request={'multipart/form-data': ConstanciaSerializer}, responses={200: DetalleAreaSerializer, **ERRORES},
        description=(
            "Queda registrada con el nombre de quien la declara (C-2). Una por expediente: declarar de nuevo corrige la "
            "anterior (sin adjunto nuevo se conserva el que había). El adjunto es PDF de hasta 10 MB con firma real; se "
            "guarda con clave opaca (sin la cédula). Solo con el expediente EN_PRESUPUESTO."
        ),
    )
    def post(self, request, expediente_id):
        datos = validar_entrada(ConstanciaSerializer, request.data)
        adjunto = None
        archivo = datos.get('adjunto')
        if archivo is not None:
            contenido, tipo, extension = validar_archivo(archivo, (PDF,), MAX_BYTES_DOCUMENTO)
            adjunto = InformeSubido(contenido, tipo.mime, clave_segura(PREFIJO_CLAVE_CONSTANCIA, extension))
        quien = quien_actua(request)
        exp, c, correccion = declarar_disponibilidad(
            RepoPostulacionORM(), SeaweedFSStorage(), expediente_id=str(expediente_id), referencia=datos['referencia'],
            observaciones=datos.get('observaciones', ''), adjunto=adjunto,
            declarante=DeclaranteConstancia(quien.cedula, quien.nombre), ahora=ahora(),
        )
        auditar_captacion(request, 'CONSTANCIA_PRESUPUESTARIA_DECLARADA', exp.id, {
            'numero': exp.numero, 'referencia': c.referencia, 'con_adjunto': c.tiene_adjunto, 'correccion': correccion,
        })
        return sin_cache(ok(_detalle(request, exp.id), 'Disponibilidad presupuestaria declarada.'))


class SolicitudTransicionView(ErroresConCodigoMixin, APIView):
    """Cualquier permiso de Presupuesto abre la puerta; la máquina decide con el permiso EXACTO de la transición."""

    permission_classes = [
        IsAuthenticated, HasAnyPermission(P_DEVOLVER_SOLICITUD, P_DECLARAR_DISPONIBILIDAD, P_EMITIR_PUNTO_CUENTA),
    ]

    @extend_schema(
        tags=TAG, summary='Aplicar una transición de Presupuesto al expediente', request=TransicionAreaSerializer,
        description=(
            "Destinos: EN_CORRECCION_CARGO (`devolver_solicitud`, motivo obligatorio) y DIFERIDO_PRESUPUESTO "
            "(`devolver_solicitud`, motivo obligatorio) desde EN_PRESUPUESTO, ambos liberan la reserva; EN_PRESUPUESTO "
            "desde DIFERIDO_PRESUPUESTO (`declarar_disponibilidad`, «se liberó la partida»); EN_DIRECCION_GENERAL "
            "(`emitir_punto_cuenta`): exige reserva vigente y constancia, genera el Punto de Cuenta y fija el vencimiento "
            "de la reserva. Errores: `data.codigo` = TRANSICION_NO_PERMITIDA, EXPEDIENTE_FINAL, SIN_PERMISO, "
            "MOTIVO_OBLIGATORIO, PUESTO_Y_DISPONIBILIDAD_REQUERIDOS, DESTINO_INVALIDO, NO_ENCONTRADO."
        ),
        responses={200: DetalleAreaSerializer, **ERRORES},
    )
    def post(self, request, expediente_id):
        datos = validar_entrada(TransicionAreaSerializer, request.data)
        r = transicionar_presupuesto(
            RepoPostulacionORM(), configuracion(), PuestosVacantesORM(), EmisorPuntoCuentaORM(), obtener_notificador(),
            expediente_id=str(expediente_id), destino=datos['destino'],
            actor=actor_con_permisos(request, PERMISOS_DE_PRESUPUESTO), quien=quien_actua(request),
            motivo=datos.get('motivo', ''), ahora=ahora(),
        )
        exp: ExpedientePostulacion = r.expediente
        auditar_captacion(request, 'SOLICITUD_TRANSICION', exp.id, {
            'numero': exp.numero, 'origen': r.origen, 'destino': exp.estado.value, 'motivo': datos.get('motivo', ''),
            'reserva_liberada': r.reserva_liberada.puesto_id if r.reserva_liberada else None,
        })
        if r.punto_cuenta is not None:
            auditar_captacion(request, 'PUNTO_CUENTA_INGRESO_EMITIDO', exp.id, {
                'numero': exp.numero, 'punto_cuenta_id': r.punto_cuenta.punto_cuenta_id,
                'punto_cuenta_numero': r.punto_cuenta.numero,
            })
        return sin_cache(ok(_detalle(request, exp.id), f'Expediente pasado a {exp.estado.value}.'))


class _VistaDescarga(ErroresConCodigoMixin, APIView):
    """Descargas de PDF (constancia y Punto de Cuenta): las ve Presupuesto (`ver_solicitudes`) o Dirección General (`ver_ingresos`)."""

    permission_classes = [IsAuthenticated, HasAnyPermission(P_VER_SOLICITUDES, P_VER_INGRESOS)]
    area = 'presupuesto'


class PuntoCuentaDocumentoView(_VistaDescarga):
    @extend_schema(
        tags=TAG, summary='Descargar el PDF del Punto de Cuenta de ingreso (adjunto)',
        responses={200: OpenApiTypes.BINARY, **ERRORES},
    )
    def get(self, request, expediente_id):
        punto, numero = documento_punto_cuenta(RepoPostulacionORM(), expediente_id=str(expediente_id), area=self.area)
        respuesta = _descargar_pdf(punto.pdf_clave, f'punto-cuenta-{punto.numero or numero}.pdf')
        auditar_captacion(request, 'PUNTO_CUENTA_INGRESO_CONSULTADO', str(expediente_id), {'numero': punto.numero})
        return respuesta


class ConstanciaAdjuntoView(_VistaDescarga):
    @extend_schema(
        tags=TAG, summary='Descargar el adjunto de la constancia presupuestaria (PDF, como adjunto)',
        responses={200: OpenApiTypes.BINARY, **ERRORES},
    )
    def get(self, request, expediente_id):
        c, numero = adjunto_constancia(RepoPostulacionORM(), expediente_id=str(expediente_id), area=self.area)
        respuesta = _descargar_pdf(c.adjunto_clave, f'constancia-presupuestaria-{numero}.pdf')
        auditar_captacion(request, 'CONSTANCIA_ADJUNTO_CONSULTADO', str(expediente_id), {'numero': numero})
        return respuesta
