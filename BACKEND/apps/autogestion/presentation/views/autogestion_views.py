"""
Vistas delgadas de Autogestión (Reglas B4, B7).
Con Envelope unificado `ok()` / `fail()` y permisos PBAC.
Compatibilidad 100% con la UI de referencia y la nueva arquitectura.
"""
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from django.db import transaction
from django.http import HttpResponse
from drf_spectacular.utils import extend_schema

from core.presentation.envelope import ok, fail
from core.presentation.permissions import EsPropiaCedulaOTienePermiso, HasPermission
from apps.autogestion.application.use_cases.obtener_mi_expediente import (
    obtener_mi_carnet_pdf,
    obtener_mi_expediente,
    solicitar_mi_carnet,
)
from apps.autogestion.infrastructure.repositories.repo_autogestion_orm import (
    RepoAutogestionORM,
)
from apps.autogestion.infrastructure.repositories.repo_portal_trabajador_orm import (
    RepoPortalTrabajadorORM,
)
from apps.autogestion.infrastructure.serializers.mi_expediente_serializers import (
    serializar_carnet,
    serializar_mi_expediente,
)


class PreguntasCensoListView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(tags=['Autogestión'], summary='Listar preguntas activas del censo')
    def get(self, request):
        repo = RepoAutogestionORM()
        preguntas = repo.listar_preguntas_con_detalle()
        return ok(preguntas)


def _id_entero(valor) -> int | None:
    if valor in (None, ''):
        return None
    try:
        return int(valor)
    except (TypeError, ValueError):
        return None


def validar_respuestas_censo(respuestas, preguntas_activas: list[dict]) -> str | None:
    """
    Valida las respuestas del censo contra el catálogo real de preguntas
    activas (`RepoAutogestionORM.listar_preguntas_con_detalle`). Devuelve el
    primer error o None. Réplica de `CensoViviendaSubmitSerializer.
    validate_respuestas` del legado (pregunta activa; en las de tipo
    `cerrada`, opción obligatoria y perteneciente a la pregunta), más: una
    pregunta abierta no admite opción, y una pregunta no se repite.
    """
    if not isinstance(respuestas, list) or not respuestas:
        return "Debe enviar al menos una respuesta."
    catalogo = {p['id']: p for p in preguntas_activas}
    vistas = set()
    for i, item in enumerate(respuestas, start=1):
        if not isinstance(item, dict):
            return f"La respuesta #{i} no tiene el formato esperado."
        pregunta_id = _id_entero(item.get('pregunta') or item.get('pregunta_id'))
        pregunta = catalogo.get(pregunta_id)
        if pregunta is None:
            return f"La pregunta con id {item.get('pregunta') or item.get('pregunta_id')} no existe o no está activa."
        if pregunta_id in vistas:
            return f"La pregunta '{pregunta['enunciado']}' se respondió más de una vez."
        vistas.add(pregunta_id)

        opcion_crudo = item.get('opcion') or item.get('opcion_id')
        opcion_id = _id_entero(opcion_crudo)
        opciones_validas = {o['id'] for o in pregunta['opciones']}
        if pregunta['tipo']['nombre'] == 'cerrada':
            if opcion_id is None:
                return f"Debe seleccionar una opción para '{pregunta['enunciado']}'."
            if opcion_id not in opciones_validas:
                return f"La opción {opcion_crudo} no pertenece a la pregunta '{pregunta['enunciado']}'."
        elif opcion_crudo not in (None, ''):
            return f"La pregunta '{pregunta['enunciado']}' es de respuesta abierta y no admite opción."
    return None


class CensoEmpleadoView(APIView):
    """
    Consultar / registrar el censo de una cédula.
    Permite al titular (ALTA-07) o a un analista/administrador consultar o registrar respuestas.
    """
    def get_permissions(self):
        if self.request.method == 'POST':
            return [
                IsAuthenticated(),
                EsPropiaCedulaOTienePermiso('autogestion.censo_actualizar_propio', 'autogestion.censo_ver_todos')(),
            ]
        return [
            IsAuthenticated(),
            EsPropiaCedulaOTienePermiso('autogestion.censo_ver_propio', 'autogestion.censo_ver_todos')(),
        ]

    @extend_schema(tags=['Autogestión'], summary='Consultar respuestas de censo de un empleado')
    def get(self, request, cedula: str):
        repo = RepoAutogestionORM()
        detalle = repo.obtener_detalle_empleado_censo(cedula)
        if detalle is None:
            return ok([], message="Sin respuestas registradas para esta cédula.")
        return ok([detalle])

    @extend_schema(tags=['Autogestión'], summary='Registrar o actualizar respuestas de censo')
    def post(self, request, cedula: str):
        repo = RepoAutogestionORM()
        data = request.data or {}

        # Accept either { carnet_patria, datos_vivienda, respuestas } or { respuestas }
        carnet_patria = data.get('carnet_patria', '')
        datos_vivienda = data.get('datos_vivienda')
        respuestas = data.get('respuestas', [])

        # Validar contra el catálogo ANTES de persistir nada (carnet y
        # vivienda incluidos), y guardar todo o nada como el legado.
        error = validar_respuestas_censo(respuestas, repo.listar_preguntas_con_detalle())
        if error:
            return fail(error, status=status.HTTP_400_BAD_REQUEST)

        # Sin `except Exception`: los errores de dominio los traduce el handler
        # global (4xx con su mensaje) y cualquier otro fallo queda como 500
        # genérico con traza en el log; nunca se devuelve `str(e)` al cliente.
        with transaction.atomic():
            detalle = repo.guardar_censo_vivienda(
                cedula=cedula,
                carnet_patria=carnet_patria,
                datos_vivienda=datos_vivienda,
                respuestas=respuestas,
            )
        return ok(detalle, message="Censo de vivienda registrado correctamente", status=status.HTTP_201_CREATED)


class CensoConsultarView(APIView):
    """
    Consultar todos los censos o buscar por cédula.
    Paridad con /censo-vivienda/consultar/ y /censo-vivienda/consultar/<cedula>/
    """
    permission_classes = [IsAuthenticated, HasPermission('autogestion.censo_ver_todos')]

    @extend_schema(tags=['Autogestión'], summary='Consultar todos los censos o filtrar por cédula')
    def get(self, request, cedula: str | None = None):
        repo = RepoAutogestionORM()
        target_cedula = cedula or request.query_params.get('cedula')
        resultados = repo.consultar_todos_censos(cedula=target_cedula)
        return ok(resultados)


class ReporteCensoDependenciasView(APIView):
    """
    Reporte agregado de censo para gráficos (torta y barras).
    """
    permission_classes = [IsAuthenticated, HasPermission('autogestion.censo_ver_todos')]

    @extend_schema(tags=['Autogestión'], summary='Consolidado del censo por dependencias (RRHH)')
    def get(self, request):
        def _get_int_list(param_name: str) -> list[int]:
            vals = (
                request.query_params.getlist(param_name) +
                request.query_params.getlist(f"{param_name}[]") +
                request.query_params.getlist(f"{param_name}s") +
                request.query_params.getlist(f"{param_name}s[]")
            )
            res = []
            for v in vals:
                if str(v).isdigit():
                    res.append(int(v))
            return res

        dep_ids = _get_int_list("dependencia_id")
        dg_ids = _get_int_list("direccion_general_id")
        dl_ids = _get_int_list("direccion_linea_id")
        coord_ids = _get_int_list("coordinacion_id")

        repo = RepoAutogestionORM()
        reporte = repo.obtener_reporte_dependencias(
            dep_ids=dep_ids or None,
            dg_ids=dg_ids or None,
            dl_ids=dl_ids or None,
            coord_ids=coord_ids or None,
        )
        return ok(reporte)


class MetricasCensoView(APIView):
    """GET /api/v1/autogestion/censo/metricas/ — paridad con métricas del censo."""
    permission_classes = [IsAuthenticated, HasPermission('autogestion.censo_ver_todos')]

    @extend_schema(tags=['Autogestión'], summary='Métricas del censo (RRHH)')
    def get(self, request):
        repo = RepoAutogestionORM()
        return ok(repo.obtener_metricas_censo())


class CensoExcelView(APIView):
    """Exportar respuestas del censo a archivo Excel (.xlsx) con o sin filtros."""
    permission_classes = [IsAuthenticated, HasPermission('autogestion.censo_exportar')]

    def _generar_respuesta(self, filtros: dict | None):
        repo = RepoAutogestionORM()
        output = repo.generar_excel_censo(filtros)
        response = HttpResponse(
            output.read(),
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        )
        response['Content-Disposition'] = 'attachment; filename="censo_vivienda.xlsx"'
        return response

    @extend_schema(tags=['Autogestión'], summary='Exportar respuestas del censo a Excel (POST con filtros)')
    def post(self, request):
        filtros = request.data.get('filtros') if isinstance(request.data, dict) else {}
        return self._generar_respuesta(filtros)

    @extend_schema(tags=['Autogestión'], summary='Exportar respuestas del censo a Excel (GET general)')
    def get(self, request):
        return self._generar_respuesta(None)


class MiExpedienteView(APIView):
    """
    GET /api/v1/autogestion/mi-expediente/
    Permite al trabajador autenticado consultar su expediente completo
    (datos personales, laborales/cargo, salud, vivienda, educación y cargas familiares).
    Estricta protección Zero-IDOR: se lee exclusivamente request.user.cedula_id.
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(tags=['Autogestión'], summary='Obtener expediente completo del trabajador autenticado')
    def get(self, request):
        cedula = getattr(request.user, 'cedula_id', None)
        if not cedula:
            return fail("El usuario autenticado no tiene un expediente de trabajador asociado.", status=404)

        dto = obtener_mi_expediente(RepoPortalTrabajadorORM(), str(cedula))
        return ok(serializar_mi_expediente(dto))


class SolicitarCarnetView(APIView):
    """
    POST /api/v1/autogestion/solicitar-carnet/
    Permite al trabajador autenticado solicitar / emitir su carnet institucional.
    Estricta protección Zero-IDOR: se genera exclusivamente para request.user.cedula_id.
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(tags=['Autogestión'], summary='Solicitar o emitir carnet institucional del trabajador')
    def post(self, request):
        cedula = getattr(request.user, 'cedula_id', None)
        if not cedula:
            return fail("El usuario autenticado no tiene un expediente de trabajador asociado.", status=404)

        carnet = solicitar_mi_carnet(
            RepoPortalTrabajadorORM(),
            str(cedula),
            motivo_id=request.data.get('motivo_id'),
            observaciones=request.data.get('observaciones'),
        )
        return ok(
            serializar_carnet(carnet),
            message="Carnet institucional generado exitosamente",
            status=status.HTTP_201_CREATED,
        )


class MiCarnetPdfView(APIView):
    """
    GET /api/v1/autogestion/mi-carnet/pdf/
    Descarga el PDF del carnet institucional activo del trabajador autenticado.
    Zero-IDOR: solo permite descargar el carnet perteneciente a request.user.cedula_id.
    """
    permission_classes = [IsAuthenticated]

    @extend_schema(tags=['Autogestión'], summary='Descargar carnet institucional activo en PDF (Zero-IDOR)')
    def get(self, request):
        cedula = getattr(request.user, 'cedula_id', None)
        if not cedula:
            return fail("El usuario no tiene expediente asociado.", status=404)

        pdf_bytes = obtener_mi_carnet_pdf(RepoPortalTrabajadorORM(), str(cedula))
        respuesta = HttpResponse(pdf_bytes, content_type='application/pdf')
        respuesta['Content-Disposition'] = f'inline; filename="carnet_conatel_{cedula}.pdf"'
        respuesta['X-Content-Type-Options'] = 'nosniff'
        respuesta['Cache-Control'] = 'private, no-store'
        return respuesta

