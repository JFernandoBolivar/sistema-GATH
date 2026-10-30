"""
Vistas delgadas de Pasivos (Reglas B4, B7).
Con Envelope unificado `ok()` / `fail()` y permiso `pasivos.ver`.
"""
import uuid

from django.db import transaction
from django.http import HttpResponse
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from drf_spectacular.utils import extend_schema

from core.presentation.audit import origen_de_peticion, registrar_auditoria
from core.presentation.envelope import ok
from core.presentation.permissions import HasPermission
from apps.pasivos.application.dtos.pasivos_dtos import CrearSobrevivientesDTO, ProcesarEgresoDTO
from apps.pasivos.application.use_cases.crear_sobrevivientes import ejecutar_creacion_sobrevivientes
from apps.pasivos.application.use_cases.listar_pasivos import listar_pasivos
from apps.pasivos.application.use_cases.obtener_pasivo import obtener_pasivo_por_cedula
from apps.pasivos.application.use_cases.procesar_egreso import procesar_egreso
from apps.pasivos.infrastructure.pdf_pasivo import construir_pdf_expediente_pasivo
from apps.pasivos.infrastructure.repositories.repo_pasivos_orm import RepoPasivosORM
from apps.pasivos.presentation.serializers.pasivos_serializers import (
    CrearSobrevivientesInputSerializer,
    PasivoSerializer,
    ProcesarEgresoInputSerializer,
    ResultadoSobrevivienteSerializer,
)


def _respuesta_pdf(pdf_bytes: bytes, nombre_archivo: str) -> HttpResponse:
    respuesta = HttpResponse(pdf_bytes, content_type='application/pdf')
    respuesta['Content-Disposition'] = f'inline; filename="{nombre_archivo}"'
    respuesta['X-Content-Type-Options'] = 'nosniff'
    respuesta['Cache-Control'] = 'private, no-store'
    return respuesta


def _auditar_altas_sobrevivientes(request, cedula_titular: str, resultados) -> None:
    """Una entrada de auditoría por cada pensionado por sobrevivencia dado de alta (C20)."""
    user = request.user
    rol = getattr(getattr(user, 'rol', None), 'nombre_rol', '') or ''
    trace_id = getattr(request, 'trace_id', None) or uuid.uuid4().hex
    for r in resultados:
        if not r.creado:
            continue
        registrar_auditoria(
            trace_id=trace_id, actor_id=getattr(user, 'pk', None),
            actor_cedula=str(getattr(user, 'cedula_id', '') or ''), actor_rol=rol,
            accion='pasivos.alta_sobreviviente', modulo='pasivos',
            recurso_tipo='Employee', recurso_id=r.cedula,
            estado_nuevo={'titular_fallecido': cedula_titular, 'asignacion': r.codigo_asignacion},
            **origen_de_peticion(request),
        )


class PasivosListView(APIView):
    permission_classes = [IsAuthenticated, HasPermission('pasivos.ver')]

    @extend_schema(tags=['Pasivos'], summary='Listar trabajadores jubilados y pensionados', responses={200: PasivoSerializer(many=True)})
    def get(self, request):
        busqueda = request.query_params.get('q')
        repo = RepoPasivosORM()
        dtos = listar_pasivos(repo, busqueda=busqueda)
        return ok(PasivoSerializer(dtos, many=True).data)


class PasivoDetailView(APIView):
    permission_classes = [IsAuthenticated, HasPermission('pasivos.ver')]

    @extend_schema(tags=['Pasivos'], summary='Obtener expediente de trabajador pasivo por cédula', responses={200: PasivoSerializer})
    def get(self, request, cedula: str):
        repo = RepoPasivosORM()
        dto = obtener_pasivo_por_cedula(repo, cedula=cedula)
        return ok(PasivoSerializer(dto).data)


class PasivoDetallePdfView(APIView):
    permission_classes = [IsAuthenticated, HasPermission('pasivos.exportar_pdf')]

    @extend_schema(tags=['Pasivos'], summary='Exportar el expediente de un trabajador pasivo en PDF')
    def get(self, request, cedula: str):
        repo = RepoPasivosORM()
        dto = obtener_pasivo_por_cedula(repo, cedula=cedula)
        pdf_bytes = construir_pdf_expediente_pasivo(dto)
        return _respuesta_pdf(pdf_bytes, f"expediente-pasivo-{cedula}.pdf")


class ProcesarEgresoView(APIView):
    """
    POST /api/v1/pasivos/<cedula>/procesar-egreso/ — transición activo →
    pasivo (Fase 2.1 del plan de reparación). Antes de este endpoint,
    `apps.pasivos` solo podía listar pasivos ya existentes; no había forma
    de crear la transición.
    """

    permission_classes = [IsAuthenticated, HasPermission('pasivos.cambiar_condicion')]

    @extend_schema(
        tags=['Pasivos'],
        summary='Procesar transición activo → pasivo',
        request=ProcesarEgresoInputSerializer,
        responses={200: PasivoSerializer},
    )
    def post(self, request, cedula: str):
        serializer = ProcesarEgresoInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        datos = serializer.validated_data

        repo = RepoPasivosORM()
        # Atómico: egreso + alta de sobrevivientes (C20) se confirman juntos.
        sobrevivientes: list = []
        with transaction.atomic():
            dto = procesar_egreso(
                repo,
                ProcesarEgresoDTO(
                    cedula=cedula,
                    motivo_movimiento_id=datos['motivo_movimiento_id'],
                    tipo_nomina_id=datos['tipo_nomina_id'],
                    liberar_activos=datos['liberar_activos'],
                    usuario_id=request.user.pk,
                    sobrevivientes_familiar_ids=tuple(datos['sobrevivientes_familiar_ids']),
                ),
                sobrevivientes,
            )
            _auditar_altas_sobrevivientes(request, cedula, sobrevivientes)
        return ok(PasivoSerializer(dto).data, 'Transición a pasivo procesada correctamente.')


class CrearSobrevivientesView(APIView):
    """
    POST /api/v1/pasivos/<cedula>/sobrevivientes/ — C20: da de alta como
    personal pasivo a los familiares beneficiarios de un titular fallecido.
    No crea cuenta de usuario (C7/C16, tras cargar el correo).
    """

    permission_classes = [IsAuthenticated, HasPermission('pasivos.crear')]

    @extend_schema(
        tags=['Pasivos'],
        summary='Dar de alta pensionados por sobrevivencia',
        request=CrearSobrevivientesInputSerializer,
        responses={201: ResultadoSobrevivienteSerializer(many=True)},
    )
    def post(self, request, cedula: str):
        serializer = CrearSobrevivientesInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        datos = serializer.validated_data
        ids = datos.get('familiar_ids')
        resultados = ejecutar_creacion_sobrevivientes(
            RepoPasivosORM(),
            CrearSobrevivientesDTO(
                cedula_titular=cedula,
                tipo_nomina_id=datos['tipo_nomina_id'],
                familiar_ids=tuple(ids) if ids else None,
                usuario_id=request.user.pk,
            ),
        )
        _auditar_altas_sobrevivientes(request, cedula, resultados)
        return ok(
            ResultadoSobrevivienteSerializer(resultados, many=True).data,
            'Pensionados por sobrevivencia procesados.',
            status=201,
        )
