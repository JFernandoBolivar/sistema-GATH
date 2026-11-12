"""
Vistas U2: restablecimiento de acceso (clave inicial) en bloque.

Solo el superadministrador (permiso de Parámetros + `SUPERADMIN_CEDULA`).
La vista previa es síncrona (200): contadores, muestra de 50 filas y la lista de `cuenta_id`
en caché 30 min. La ejecución reutiliza esa lista y exige que `confirmacion` sea su longitud:
con `VENCIDA`/`SIN_PRIMER_INGRESO` es síncrona (200); con `TODOS` va por Celery (202).
"""
from celery.result import AsyncResult
from django.core.cache import cache
from django.http import HttpResponse
from drf_spectacular.utils import extend_schema
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.identidad.application.dtos.permisos_dto import ActorSesionDTO
from apps.identidad.domain.value_objects.restablecimiento_bloque import Alcance
from apps.identidad.infrastructure.tasks.restablecer_acceso_bloque_tasks import (
    CANDADO,
    calcular_vista_previa,
    clave_preview,
    ejecutar_bloque,
    filas_del_excel,
    restablecer_acceso_en_bloque_tarea,
)
from apps.identidad.presentation.permissions.identidad_permissions import (
    EsSuperadministrador,
)
from apps.identidad.presentation.serializers.restablecer_acceso_bloque_serializers import (
    EjecutarRestablecimientoBloqueSerializer,
    EstadoRestablecimientoBloqueSerializer,
    FiltrosExcelBloqueSerializer,
    RestablecerAccesoBloqueSerializer,
)
from core.domain.exceptions import ConflictError
from core.infrastructure.auditoria_contexto import origen_para_tarea
from core.infrastructure.pdf.report_excel import generar_reporte_excel
from core.presentation.envelope import ok
from core.presentation.permissions import HasPermission

PERMISO = 'configuracion.editar'
PERMISOS = [IsAuthenticated, HasPermission(PERMISO), EsSuperadministrador]
TAG = 'Identidad · Restablecimiento en bloque'
XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
COLUMNAS_EXCEL = ['cédula', 'nombre', 'condición', 'correo de acceso', 'vence el']
CAMPOS_RESULTADO = (
    'revisadas', 'restablecidas', 'omitidas_administrativas', 'errores', 'vence_en_nuevo',
)


def _actor_sesion(request) -> ActorSesionDTO:
    user = request.user
    return ActorSesionDTO(
        cuenta_id=getattr(user, 'pk', None),
        rol_id=getattr(user, 'rol_id', None),
        cedula=str(getattr(user, 'cedula_id', '') or '') or None,
    )


def _dict_actor(request) -> dict:
    actor = _actor_sesion(request)
    return {'cuenta_id': actor.cuenta_id, 'rol_id': actor.rol_id, 'cedula': actor.cedula}


class RestablecerAccesoBloquePreviewView(APIView):
    permission_classes = PERMISOS

    @extend_schema(
        tags=[TAG], summary='Vista previa del restablecimiento en bloque',
        description=(
            'Responde 200 al instante con los contadores, una muestra de hasta 50 cuentas y la fecha '
            'del nuevo plazo. Deja la lista de cuentas en caché 30 minutos para la ejecución.'
        ),
        request=RestablecerAccesoBloqueSerializer,
        responses={200: None},
    )
    def post(self, request):
        serializer = RestablecerAccesoBloqueSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        datos = serializer.validated_data
        return ok(calcular_vista_previa(datos['clasificacion'], datos['alcance'], _dict_actor(request)))


class RestablecerAccesoBloquePreviewExcelView(APIView):
    permission_classes = PERMISOS

    @extend_schema(
        tags=[TAG], summary='Excel con todas las cuentas de la selección',
        parameters=[FiltrosExcelBloqueSerializer],
        responses={200: None},
    )
    def get(self, request):
        serializer = FiltrosExcelBloqueSerializer(data=request.query_params)
        serializer.is_valid(raise_exception=True)
        datos = serializer.validated_data
        filas = filas_del_excel(datos['clasificacion'], datos['alcance'], _dict_actor(request))
        contenido = generar_reporte_excel(
            titulo='Restablecimiento de contraseñas en bloque',
            columnas=COLUMNAS_EXCEL,
            filas=[
                {
                    'cédula': fila.cedula,
                    'nombre': fila.nombre,
                    'condición': fila.condicion,
                    'correo de acceso': fila.correo,
                    'vence el': fila.vence_en.strftime('%d/%m/%Y %H:%M') if fila.vence_en else '',
                }
                for fila in filas
            ],
            filtros=[
                ('Clasificación', datos['clasificacion']),
                ('Alcance', datos['alcance']),
            ],
        )
        respuesta = HttpResponse(contenido, content_type=XLSX)
        respuesta['Content-Disposition'] = 'attachment; filename="restablecimiento-bloque.xlsx"'
        return respuesta


class RestablecerAccesoBloqueEjecutarView(APIView):
    permission_classes = PERMISOS

    @extend_schema(
        tags=[TAG], summary='Ejecutar el restablecimiento de acceso en bloque',
        description=(
            'Reutiliza la lista de cuentas de la vista previa. `confirmacion` debe ser igual a la '
            'longitud de esa lista; si no hay vista previa vigente o el número no coincide, 409. '
            'Con `VENCIDA` o `SIN_PRIMER_INGRESO` responde 200 con el resultado; con `TODOS`, 202 '
            'con el `task_id`.'
        ),
        request=EjecutarRestablecimientoBloqueSerializer,
        responses={200: None, 202: EstadoRestablecimientoBloqueSerializer, 409: None},
    )
    def post(self, request):
        serializer = EjecutarRestablecimientoBloqueSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        datos = serializer.validated_data
        clave = clave_preview(
            getattr(request.user, 'pk', None), datos['clasificacion'], datos['alcance'],
        )
        cuenta_ids = cache.get(clave)
        if cuenta_ids is None:
            raise ConflictError(
                'No hay una vista previa vigente: calcúlela y confirme el número que muestre.'
            )
        if int(datos['confirmacion']) != len(cuenta_ids):
            raise ConflictError(
                'El número no coincide con la vista previa: vuelva a calcularla.'
            )
        if cache.get(CANDADO):
            raise ConflictError('Ya hay un restablecimiento en curso. Espere a que termine.')

        argumentos = (
            datos['clasificacion'],
            datos['alcance'],
            datos['enviar_correo'],
            datos['motivo'],
            _dict_actor(request),
            int(datos['confirmacion']),
            list(cuenta_ids),
        )
        if datos['alcance'] == Alcance.TODOS.value:
            tarea = restablecer_acceso_en_bloque_tarea.delay(
                *argumentos, origen=origen_para_tarea(),
            )
            cache.delete(clave)
            return ok(
                {'task_id': tarea.id, 'estado': 'EN_PROCESO'},
                'Restablecimiento en curso.', status=202,
            )

        resultado = ejecutar_bloque(*argumentos)
        if resultado.get('estado') != 'LISTO':
            raise ConflictError(
                resultado.get('mensaje')
                or 'Ya hay un restablecimiento en curso. Espere a que termine.'
            )
        cache.delete(clave)
        return ok({
            'estado': 'LISTO',
            'resultado': {campo: resultado[campo] for campo in CAMPOS_RESULTADO},
        })


class RestablecerAccesoBloqueEstadoView(APIView):
    permission_classes = PERMISOS

    @extend_schema(
        tags=[TAG], summary='Estado y resultado del restablecimiento en bloque',
        responses={200: EstadoRestablecimientoBloqueSerializer},
    )
    def get(self, request, task_id: str):
        resultado = AsyncResult(task_id)
        estado = {
            'PENDING': 'EN_PROCESO',
            'STARTED': 'EN_PROCESO',
            'RETRY': 'EN_PROCESO',
            'SUCCESS': 'LISTO',
            'FAILURE': 'ERROR',
            'REVOKED': 'CANCELADO',
        }.get(resultado.state, resultado.state)
        cuerpo = {'task_id': task_id, 'estado': estado}
        if resultado.state == 'SUCCESS':
            valor = resultado.result
            cuerpo['resultado'] = valor
            if isinstance(valor, dict) and valor.get('estado'):
                cuerpo['estado'] = valor['estado']
        elif resultado.state == 'FAILURE':
            cuerpo['mensaje'] = 'No se pudo completar el restablecimiento. Revise la bitácora.'
        return ok(cuerpo)
