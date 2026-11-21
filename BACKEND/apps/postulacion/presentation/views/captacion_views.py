"""Vistas de Captación (personal con permiso, token normal de empleado): alta del postulante y reposición de clave."""
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.postulacion.application.use_cases.bandeja import (
    construir_filtros,
    detalle_para_captacion,
    listar_bandeja,
)
from apps.postulacion.application.use_cases.captacion import transicionar_captacion
from apps.postulacion.application.use_cases.credenciales import alta_postulante_con_credencial, emitir_credencial
from apps.postulacion.application.use_cases.psicofisico import (
    PREFIJO_CLAVE_INFORME,
    InformeSubido,
    consultar_psicofisico,
    informe_de,
    registrar_psicofisico,
)
from apps.postulacion.infrastructure.hasheador_django import HasheadorDjango
from apps.postulacion.infrastructure.repositories.repo_postulacion_orm import (
    BuscadorEmpleadosORM,
    CatalogoPropuestaORM,
    RepoPostulacionORM,
)
from apps.postulacion.presentation.permissions.postulante_permissions import (
    REGISTRAR_PSICOFISICO,
    VER_BANDEJA,
    permisos_captacion,
)
from apps.postulacion.presentation.serializers.postulacion_serializers import (
    AltaPostulanteRespuestaSerializer,
    AltaPostulanteSerializer,
    BandejaRespuestaSerializer,
    CredencialEmitidaSerializer,
    ExpedienteDetalleSerializer,
    FiltrosBandejaSerializer,
    PsicofisicoRespuestaSerializer,
    PsicofisicoSerializer,
    TransicionSerializer,
)
from apps.postulacion.presentation.views._comun import (
    PERMISOS_DE_CAPTACION,
    ErroresConCodigoMixin,
    a_dict_credencial,
    a_dict_detalle_captacion,
    a_dict_expediente_resumen,
    a_dict_fila_bandeja,
    a_dict_psicofisico,
    actor_de_captacion,
    ahora,
    auditar_captacion,
    configuracion,
    sin_cache,
    validar_entrada,
)
from core.domain.exceptions import PermissionDeniedError
from core.domain.paginacion import Paginacion
from core.infrastructure.providers import obtener_notificador
from core.infrastructure.storage.seaweedfs_storage import SeaweedFSStorage
from core.infrastructure.storage.validacion_archivo import MAX_BYTES_DOCUMENTO, PDF, clave_segura, validar_archivo
from core.presentation.archivos import respuesta_archivo
from core.presentation.envelope import ok
from core.presentation.permissions import HasAnyPermission, HasPermission
from core.presentation.schema import MensajeRespuestaSerializer

TAG = ['Postulación · Captación']
ERRORES = {
    400: MensajeRespuestaSerializer, 401: MensajeRespuestaSerializer, 403: MensajeRespuestaSerializer,
    404: MensajeRespuestaSerializer, 409: MensajeRespuestaSerializer,
}


def _cedula_del_analista(request) -> str:
    cedula = getattr(request.user, 'cedula_id', None)
    if not cedula:
        raise PermissionDeniedError("El usuario autenticado no tiene un expediente de trabajador asociado.")
    return str(cedula)


class AltaPostulanteView(APIView):
    """`postulacion.crear_postulante`: crea el postulante con su expediente y emite la credencial (clave UNA vez)."""

    permission_classes = permisos_captacion()

    @extend_schema(
        tags=TAG, summary='Alta del postulante con su expediente y credencial de la Ventana 1',
        request=AltaPostulanteSerializer, responses={201: AltaPostulanteRespuestaSerializer, **ERRORES},
    )
    def post(self, request):
        datos = validar_entrada(AltaPostulanteSerializer, request.data)
        alta = alta_postulante_con_credencial(
            RepoPostulacionORM(), BuscadorEmpleadosORM(), configuracion(), HasheadorDjango(),
            cedula=datos['cedula'], nombres=datos['nombres'], apellidos=datos['apellidos'],
            correo=datos.get('correo', ''), telefono_movil=datos.get('telefono_movil', ''),
            creado_por=_cedula_del_analista(request), ahora=ahora(),
        )
        auditar_captacion(
            request, 'POSTULANTE_CREADO', alta.expediente.id,
            {'cedula': alta.postulante.cedula, 'numero': alta.expediente.numero, 'reingreso': alta.es_reingreso,
             'ventana': alta.emision.credencial.ventana,
             'vence_el': alta.emision.credencial.vence_el.isoformat()},
        )
        p = alta.postulante
        return sin_cache(ok(
            {
                'postulante': {
                    'id': p.id, 'cedula': p.cedula, 'nombres': p.nombres, 'apellidos': p.apellidos,
                    'correo': p.correo, 'telefono_movil': p.telefono_movil,
                },
                'expediente': a_dict_expediente_resumen(alta.expediente), 'es_reingreso': alta.es_reingreso,
                'credencial': a_dict_credencial(alta.emision),
            },
            'Postulante creado. Entregue la contraseña temporal en persona: no se volverá a mostrar.', status=201,
        ))


class ReponerCredencialView(APIView):
    """`postulacion.crear_postulante`: nueva contraseña temporal; la anterior y las sesiones abiertas quedan invalidadas."""

    permission_classes = permisos_captacion()

    @extend_schema(
        tags=TAG, summary='Reponer la credencial (nueva contraseña temporal, una sola vez)', request=None,
        responses={200: CredencialEmitidaSerializer, **ERRORES},
    )
    def post(self, request, expediente_id):
        emision = emitir_credencial(
            RepoPostulacionORM(), HasheadorDjango(), expediente_id=str(expediente_id),
            emitida_por=_cedula_del_analista(request), ahora=ahora(),
        )
        auditar_captacion(
            request, 'CREDENCIAL_REPUESTA', emision.credencial.expediente_id,
            {'ventana': emision.credencial.ventana, 'vence_el': emision.credencial.vence_el.isoformat()},
        )
        return sin_cache(ok(
            a_dict_credencial(emision),
            'Credencial repuesta. Entregue la contraseña temporal en persona: no se volverá a mostrar.',
        ))


# ---------------------------------------------------------------------------------------------------------------
# Bandeja de Captación (D-7) y test psicofísico (D-8)
# ---------------------------------------------------------------------------------------------------------------
class _VistaBandeja(ErroresConCodigoMixin, APIView):
    """Base: empleado autenticado + código de permiso `postulacion.*`; los errores de dominio llevan `data.codigo`."""

    permiso: str = VER_BANDEJA

    def get_permissions(self):
        from rest_framework.permissions import IsAuthenticated
        return [IsAuthenticated(), HasPermission(self.permiso)()]


class BandejaView(_VistaBandeja):
    @extend_schema(
        tags=TAG, summary='Bandeja de expedientes de Captación (paginada y filtrable)',
        parameters=[
            OpenApiParameter('estado', str, many=True, description='Uno o varios estados (repetido o separado por comas).'),
            OpenApiParameter('q', str, description='Cédula, nombre o número de expediente.'),
            OpenApiParameter('desde', OpenApiTypes.DATE, description='Último cambio desde (inclusive).'),
            OpenApiParameter('hasta', OpenApiTypes.DATE, description='Último cambio hasta (inclusive).'),
            OpenApiParameter('pagina', int), OpenApiParameter('page_size', int),
        ],
        description=(
            "Orden: primero los que esperan a Captación (ENVIADO_CAPTACION y EN_REVISION_FINAL) y luego por fecha del "
            "último cambio, el más antiguo primero. Respuesta: `{resultados, total, pagina, tamano, total_paginas}`."
        ),
        responses={200: BandejaRespuestaSerializer, **ERRORES},
    )
    def get(self, request):
        params = request.query_params
        entrada = validar_entrada(FiltrosBandejaSerializer, {
            'estado': [e.strip() for valor in params.getlist('estado') for e in valor.split(',') if e.strip()],
            **{k: params[k] for k in ('q', 'desde', 'hasta') if k in params},
        })
        filtros = construir_filtros(entrada.get('estado'), entrada.get('q'), entrada.get('desde'), entrada.get('hasta'))
        paginacion = Paginacion.desde_parametros(params)
        filas, total = listar_bandeja(RepoPostulacionORM(), filtros, paginacion)
        return sin_cache(ok(paginacion.envolver([a_dict_fila_bandeja(f) for f in filas], total)))


def _detalle(request, expediente_id: str) -> dict:
    actor = actor_de_captacion(request)
    return a_dict_detalle_captacion(detalle_para_captacion(
        RepoPostulacionORM(), configuracion(), expediente_id=expediente_id, permisos=actor.permisos,
    ))


class ExpedienteDetalleView(_VistaBandeja):
    @extend_schema(
        tags=TAG, summary='Detalle del expediente: postulante, Ventana 1, historial y acciones disponibles',
        description=(
            "`acciones` sale de la máquina de estados y de los permisos de quien consulta: cada una trae `destino`, "
            "`etiqueta`, `requiere_motivo`, `requiere_propuesta` (cargo y oficina), `bloqueada` + `motivo_bloqueo` "
            "(guarda que hoy no se cumple, p. ej. psicofísico obligatorio) y `sugerida` (NO_APTO sugiere rechazar)."
        ),
        responses={200: ExpedienteDetalleSerializer, **ERRORES},
    )
    def get(self, request, expediente_id):
        return sin_cache(ok(_detalle(request, str(expediente_id))))


class TransicionView(ErroresConCodigoMixin, APIView):
    """Cualquier permiso de Captación abre la puerta; la máquina de estados decide con el permiso EXACTO de la transición."""

    permission_classes = [IsAuthenticated, HasAnyPermission(*PERMISOS_DE_CAPTACION)]

    @extend_schema(
        tags=TAG, summary='Aplicar una transición de Captación al expediente', request=TransicionSerializer,
        description=(
            "Destinos del flujo de Captación: EN_CORRECCION_DATOS (devolver con observaciones, motivo obligatorio), "
            "RECHAZADO_CAPTACION (motivo obligatorio), EN_PRESUPUESTO (abrir/reabrir: `datos` con cargo y oficina; "
            "exige psicofísico si el parámetro es obligatorio), CONSOLIDANDO (reabrir la Ventana 2 o observar "
            "faltantes; este último con motivo) y LISTO_PARA_ASIGNAR (conforme). Errores: `data.codigo` = "
            "TRANSICION_NO_PERMITIDA, EXPEDIENTE_FINAL, SIN_PERMISO, MOTIVO_OBLIGATORIO, PSICOFISICO_OBLIGATORIO, "
            "CARGO_Y_OFICINA_REQUERIDOS, PROPUESTA_INVALIDA, DESTINO_INVALIDO, NO_ENCONTRADO."
        ),
        responses={200: ExpedienteDetalleSerializer, **ERRORES},
    )
    def post(self, request, expediente_id):
        datos = validar_entrada(TransicionSerializer, request.data)
        exp, asiento, origen = transicionar_captacion(
            RepoPostulacionORM(), configuracion(), CatalogoPropuestaORM(), obtener_notificador(),
            expediente_id=str(expediente_id), destino=datos['destino'], actor=actor_de_captacion(request),
            motivo=datos.get('motivo', ''), datos=datos.get('datos') or {}, ahora=ahora(),
        )
        auditar_captacion(
            request, 'EXPEDIENTE_TRANSICION', exp.id,
            {'numero': exp.numero, 'origen': origen, 'destino': exp.estado.value, 'motivo': datos.get('motivo', '')},
        )
        return sin_cache(ok(_detalle(request, exp.id), f'Expediente pasado a {exp.estado.value}.'))


class PsicofisicoView(_VistaBandeja):
    """GET con `postulacion.ver_bandeja`; POST (multipart) con `postulacion.registrar_psicofisico`."""

    parser_classes = [MultiPartParser, FormParser]

    def get_permissions(self):
        self.permiso = REGISTRAR_PSICOFISICO if self.request.method == 'POST' else VER_BANDEJA
        return super().get_permissions()

    @extend_schema(
        tags=TAG, summary='Resultado psicofísico del expediente', responses={200: PsicofisicoRespuestaSerializer, **ERRORES},
    )
    def get(self, request, expediente_id):
        r = consultar_psicofisico(RepoPostulacionORM(), expediente_id=str(expediente_id))
        return sin_cache(ok(a_dict_psicofisico(r)))

    @extend_schema(
        tags=TAG, summary='Registrar (o corregir) el resultado psicofísico y su informe PDF opcional',
        request={'multipart/form-data': PsicofisicoSerializer}, responses={200: PsicofisicoRespuestaSerializer, **ERRORES},
        description=(
            "Uno por expediente: registrar de nuevo corrige el anterior (sin informe nuevo se conserva el que había). "
            "El informe es PDF de hasta 10 MB; se valida la firma real del archivo. Solo mientras el expediente no "
            "pasó a Presupuesto. NO_APTO no bloquea nada: sugiere rechazar."
        ),
    )
    def post(self, request, expediente_id):
        datos = validar_entrada(PsicofisicoSerializer, request.data)
        informe = None
        archivo = datos.get('informe')
        if archivo is not None:
            contenido, tipo, extension = validar_archivo(archivo, (PDF,), MAX_BYTES_DOCUMENTO)
            informe = InformeSubido(contenido, tipo.mime, clave_segura(PREFIJO_CLAVE_INFORME, extension))
        exp, r, correccion = registrar_psicofisico(
            RepoPostulacionORM(), SeaweedFSStorage(), expediente_id=str(expediente_id),
            resultado=datos['resultado'], fecha_aplicacion=datos['fecha_aplicacion'],
            observaciones=datos.get('observaciones', ''), informe=informe,
            registrado_por=_cedula_del_analista(request), ahora=ahora(),
        )
        auditar_captacion(
            request, 'PSICOFISICO_REGISTRADO', exp.id,
            {'numero': exp.numero, 'resultado': r.resultado, 'fecha_aplicacion': r.fecha_aplicacion.isoformat(),
             'con_informe': r.tiene_informe, 'correccion': correccion},
        )
        return sin_cache(ok(a_dict_psicofisico(r), 'Resultado psicofísico registrado.'))


class InformePsicofisicoView(_VistaBandeja):
    @extend_schema(
        tags=TAG, summary='Descargar el informe psicofísico (PDF, como adjunto)', responses={200: OpenApiTypes.BINARY, **ERRORES},
    )
    def get(self, request, expediente_id):
        r, numero = informe_de(RepoPostulacionORM(), expediente_id=str(expediente_id))
        respuesta = respuesta_archivo(SeaweedFSStorage(), r.informe_clave, cache='private, no-store', mime='application/pdf')
        respuesta['Content-Disposition'] = f'attachment; filename="informe-psicofisico-{numero}.pdf"'
        auditar_captacion(request, 'INFORME_PSICOFISICO_CONSULTADO', str(expediente_id), {'numero': numero})
        return respuesta
