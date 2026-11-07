"""Vistas de la carga masiva: plantilla (F1), subida/análisis (F2), aplicación (F4)
y confirmación de cambios de condición (FIX-CARGA1)."""
from io import BytesIO

from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema
from openpyxl import Workbook
from rest_framework import status
from rest_framework.exceptions import PermissionDenied
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.carga_masiva.application.use_cases.gestionar_carga import (
    analizar_carga,
    aplicar_carga as aplicar_carga_uc,
    aprobar_carga as aprobar_carga_uc,
    confirmar_filas as confirmar_filas_uc,
    rechazar_carga as rechazar_carga_uc,
    revertir_carga as revertir_carga_uc,
)
from apps.carga_masiva.domain.constantes import permiso_de_poblacion
from apps.carga_masiva.domain.registro_campos import (
    POBLACIONES,
    TIPOS_POR_CLAVE,
    claves_por_poblacion,
)
from apps.carga_masiva.infrastructure.adaptadores import (
    AnalizadorCargaORM,
    AplicadorCargaORM,
)
from apps.carga_masiva.infrastructure.models import CargaMasivaModel
from apps.carga_masiva.infrastructure.plantilla_excel import generar_plantilla
from apps.carga_masiva.presentation.permissions import APLICAR, APROBAR, REVERTIR
from apps.carga_masiva.presentation.serializers import (
    ConfirmarFilasSerializer,
    PlantillaQuerySerializer,
)
from core.domain.exceptions import ValidationError
from core.presentation.audit import origen_de_peticion, registrar_auditoria
from core.presentation.envelope import ok
from core.presentation.permissions import HasPermission, usuario_tiene_permiso
from core.presentation.schema import MensajeRespuestaSerializer

TAG = ['Personal · Carga masiva']
XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
MAX_BYTES = 10 * 1024 * 1024


def _cedula(request) -> str:
    return str(getattr(request.user, 'cedula_id', '') or getattr(request.user, 'cedula', '') or '')


def _exigir_permiso_poblacion(request, poblacion: str) -> None:
    if not usuario_tiene_permiso(request.user, permiso_de_poblacion(poblacion)):
        raise PermissionDenied(
            f"No posee el permiso requerido para cargar personal {poblacion.lower()}."
        )


def _poblaciones_visibles(request) -> list[str]:
    if usuario_tiene_permiso(request.user, APROBAR):
        return list(POBLACIONES)
    return [
        poblacion for poblacion in POBLACIONES
        if usuario_tiene_permiso(request.user, permiso_de_poblacion(poblacion))
    ]


def _carga_visible(request, carga_id: str) -> CargaMasivaModel:
    """Quien no puede aprobar solo ve sus propias cargas y de su población."""
    cargas = CargaMasivaModel.objects.all()
    if not usuario_tiene_permiso(request.user, APROBAR):
        cargas = cargas.filter(solicitada_por_cedula=_cedula(request))
    carga = get_object_or_404(cargas, pk=carga_id)
    if not usuario_tiene_permiso(request.user, APROBAR):
        _exigir_permiso_poblacion(request, carga.poblacion)
    return carga


def _auditar(request, accion: str, carga: CargaMasivaModel, nuevo: dict | None = None) -> None:
    registrar_auditoria(
        trace_id=getattr(request, 'trace_id', None) or str(carga.id),
        actor_id=getattr(request.user, 'pk', None), actor_cedula=_cedula(request),
        actor_rol=getattr(getattr(request.user, 'rol', None), 'nombre_rol', ''), accion=accion,
        modulo=carga.modulo, recurso_tipo='CargaMasiva', recurso_id=str(carga.id),
        estado_nuevo=nuevo or {}, **origen_de_peticion(request),
    )


class PlantillaCargaMasivaView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=TAG, summary='Descargar la plantilla Excel de carga masiva',
        parameters=[
            OpenApiParameter('poblacion', str, description='ACTIVOS | PASIVOS.'),
            OpenApiParameter('tipos', str, description='Claves separadas por coma; vacío = todos los de la población.'),
            OpenApiParameter('modo', str, description='obligatorios | completo'),
        ],
        responses={200: OpenApiTypes.BINARY, 400: MensajeRespuestaSerializer, 403: MensajeRespuestaSerializer},
    )
    def get(self, request):
        datos = PlantillaQuerySerializer(data=request.query_params)
        datos.is_valid(raise_exception=True)
        poblacion = datos.validated_data['poblacion']
        _exigir_permiso_poblacion(request, poblacion)
        contenido = generar_plantilla(
            datos.validated_data.get('tipos') or None,
            datos.validated_data['modo'],
            poblacion,
        )
        respuesta = HttpResponse(contenido, content_type=XLSX)
        respuesta['Content-Disposition'] = 'attachment; filename="plantilla-carga-masiva.xlsx"'
        respuesta['Cache-Control'] = 'private, no-store'
        return respuesta


class CargasMasivasView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    @extend_schema(tags=TAG, summary='Subir y analizar un archivo de carga masiva')
    def post(self, request):
        poblacion = str(request.data.get('poblacion') or '').strip().upper()
        if not poblacion:
            raise ValidationError('Seleccione la población: ACTIVOS o PASIVOS.', campo='poblacion')
        if poblacion not in POBLACIONES:
            raise ValidationError('La población debe ser «ACTIVOS» o «PASIVOS».', campo='poblacion')
        _exigir_permiso_poblacion(request, poblacion)
        archivo = request.FILES.get('archivo')
        if archivo is None:
            raise ValidationError('Debe adjuntar el archivo .xlsx.', campo='archivo')
        if not archivo.name.lower().endswith('.xlsx'):
            raise ValidationError('Solo se admite un archivo .xlsx.', campo='archivo')
        if archivo.size > MAX_BYTES:
            raise ValidationError('El archivo supera los 10 MB.', campo='archivo')
        tipos = [t for t in str(request.data.get('tipos') or '').split(',') if t in TIPOS_POR_CLAVE]
        if not tipos:
            tipos = list(claves_por_poblacion(poblacion))
        no_aplican = [t for t in tipos if not TIPOS_POR_CLAVE[t].aplica_a(poblacion)]
        if no_aplican:
            raise ValidationError(
                'Tipo de carga no disponible para la población: ' + ', '.join(no_aplican) + '.',
                campo='tipos',
            )
        modo = str(request.data.get('modo') or 'obligatorios')
        if modo not in ('obligatorios', 'completo'):
            raise ValidationError('El modo debe ser «obligatorios» o «completo».', campo='modo')
        contenido = archivo.read()
        carga = CargaMasivaModel.objects.create(
            archivo_nombre=archivo.name[:255], tamano_bytes=archivo.size, tipos=tipos,
            modo=modo, poblacion=poblacion, solicitada_por_cedula=_cedula(request),
        )
        try:
            analizar_carga(carga, contenido, tipos, AnalizadorCargaORM())
        except Exception as exc:  # noqa: BLE001
            carga.estado = CargaMasivaModel.Estado.ERROR
            carga.save(update_fields=['estado'])
            raise ValidationError(f'No se pudo analizar el archivo: {exc}', campo='archivo') from exc
        _auditar(request, 'CARGA_MASIVA_ANALIZADA', carga, {
            'filas': carga.filas_total, 'errores': carga.filas_error,
            'confirmacion': carga.filas_confirmacion, 'poblacion': poblacion,
        })
        return ok(_resumen(carga), 'Archivo analizado. Revise los resultados antes de aplicar.', status.HTTP_202_ACCEPTED)

    @extend_schema(tags=TAG, summary='Historial de cargas masivas')
    def get(self, request):
        cargas = CargaMasivaModel.objects.all()
        if not usuario_tiene_permiso(request.user, APROBAR):
            cargas = cargas.filter(
                solicitada_por_cedula=_cedula(request),
                poblacion__in=_poblaciones_visibles(request),
            )
        poblacion = str(request.query_params.get('poblacion') or '').strip().upper()
        if poblacion in POBLACIONES:
            cargas = cargas.filter(poblacion=poblacion)
        estado = str(request.query_params.get('estado') or '').strip().upper()
        if estado:
            cargas = cargas.filter(estado=estado)
        return ok([_resumen(c) for c in cargas[:50]])


class CargaMasivaDetalleView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(tags=TAG, summary='Detalle y filas analizadas de una carga')
    def get(self, request, carga_id):
        carga = _carga_visible(request, carga_id)
        filas = carga.filas.all()
        estado = request.query_params.get('estado')
        if estado:
            filas = filas.filter(estado=estado)
        if request.query_params.get('solo_confirmacion') in ('1', 'true', 'True'):
            filas = filas.filter(estado='REQUIERE_CONFIRMACION')
        return ok({
            **_resumen(carga),
            'filas': [
                {
                    'id': str(f.id), 'tipo': f.tipo, 'numero_fila': f.numero_fila, 'estado': f.estado,
                    'detalle': f.detalle, 'datos': f.datos, 'aplicada': f.aplicada,
                    'confirmada': f.confirmada, 'confirmada_por_cedula': f.confirmada_por_cedula,
                    'confirmada_en': f.confirmada_en, 'movimiento': f.movimiento or None,
                    'error_aplicacion': f.error_aplicacion,
                }
                for f in filas[:500]
            ],
        })


class ConfirmarFilasCargaMasivaView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=TAG, summary='Confirmar los movimientos de cambio de condición seleccionados',
        request=ConfirmarFilasSerializer,
    )
    def post(self, request, carga_id):
        carga = _carga_visible(request, carga_id)
        datos = ConfirmarFilasSerializer(data=request.data)
        datos.is_valid(raise_exception=True)
        fila_ids = [str(fila_id) for fila_id in datos.validated_data['filas']]
        confirmar_filas_uc(
            carga, fila_ids, _cedula(request), AplicadorCargaORM(),
            getattr(request.user, 'pk', None),
        )
        _auditar(request, 'CARGA_MASIVA_FILAS_CONFIRMADAS', carga, {
            'filas': fila_ids, 'confirmadas': carga.filas_confirmadas,
        })
        return ok(_resumen(carga), 'Filas confirmadas.')


class AplicarCargaMasivaView(APIView):
    permission_classes = [IsAuthenticated, HasPermission(APLICAR)]

    @extend_schema(tags=TAG, summary='Aplicar las filas sin error y confirmadas de una carga analizada')
    def post(self, request, carga_id):
        carga = _carga_visible(request, carga_id)
        aplicar_carga_uc(carga, _cedula(request), AplicadorCargaORM(), getattr(request.user, 'pk', None))
        _auditar(request, 'CARGA_MASIVA_APLICADA', carga, {'estado': carga.estado})
        return ok(_resumen(carga), 'Carga aplicada.')


class AprobarCargaMasivaView(APIView):
    permission_classes = [IsAuthenticated, HasPermission(APROBAR)]

    @extend_schema(tags=TAG, summary='Aprobar y aplicar una carga pendiente de aprobación')
    def post(self, request, carga_id):
        carga = _carga_visible(request, carga_id)
        aprobar_carga_uc(carga, _cedula(request), AplicadorCargaORM(), getattr(request.user, 'pk', None))
        _auditar(request, 'CARGA_MASIVA_APROBADA', carga, {'estado': carga.estado})
        return ok(_resumen(carga), 'Carga aprobada y aplicada.')


class RechazarCargaMasivaView(APIView):
    permission_classes = [IsAuthenticated, HasPermission(APROBAR)]

    @extend_schema(tags=TAG, summary='Rechazar una carga pendiente de aprobación')
    def post(self, request, carga_id):
        carga = _carga_visible(request, carga_id)
        motivo = str(request.data.get('motivo') or '').strip()
        rechazar_carga_uc(carga, _cedula(request), motivo, AplicadorCargaORM())
        _auditar(request, 'CARGA_MASIVA_RECHAZADA', carga, {'motivo': motivo})
        return ok(_resumen(carga), 'Carga rechazada.')


class RevertirCargaMasivaView(APIView):
    permission_classes = [IsAuthenticated, HasPermission(REVERTIR)]

    @extend_schema(tags=TAG, summary='Revertir una carga aplicada y sus movimientos')
    def post(self, request, carga_id):
        carga = _carga_visible(request, carga_id)
        revertir_carga_uc(carga, AplicadorCargaORM(), getattr(request.user, 'pk', None))
        _auditar(request, 'CARGA_MASIVA_REVERTIDA', carga, {'estado': carga.estado})
        return ok(_resumen(carga), 'Carga revertida.')


class ResultadosCargaMasivaView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(tags=TAG, summary='Excel de resultados del análisis')
    def get(self, request, carga_id):
        carga = _carga_visible(request, carga_id)
        libro = Workbook()
        hoja = libro.active
        hoja.title = 'Resultados'
        filas = list(carga.filas.all())
        claves = []
        for fila in filas:
            for clave in fila.datos:
                if clave not in claves:
                    claves.append(clave)
        columnas = ['Población', 'Archivo', 'Tipo', 'Fila', 'Estado', 'Detalle', *claves]
        hoja.append(columnas)
        for fila in filas:
            hoja.append([
                carga.poblacion, carga.archivo_nombre, fila.tipo, fila.numero_fila, fila.estado,
                fila.detalle, *[fila.datos.get(clave, '') for clave in claves],
            ])
        buffer = BytesIO()
        libro.save(buffer)
        respuesta = HttpResponse(buffer.getvalue(), content_type=XLSX)
        respuesta['Content-Disposition'] = f'attachment; filename="resultados-{carga.id}.xlsx"'
        return respuesta


def _resumen(carga: CargaMasivaModel) -> dict:
    return {
        'id': str(carga.id), 'archivo': carga.archivo_nombre, 'estado': carga.estado,
        'poblacion': carga.poblacion,
        'tipos': carga.tipos, 'filas_total': carga.filas_total, 'filas_validas': carga.filas_validas,
        'filas_error': carga.filas_error, 'filas_confirmacion': carga.filas_confirmacion,
        'filas_confirmadas': carga.filas_confirmadas, 'creada_en': carga.created_at,
    }
