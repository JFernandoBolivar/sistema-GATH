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
from core.presentation.envelope import fail, ok
from core.presentation.permissions import HasPermission, usuario_tiene_permiso
from apps.pasivos.application.dtos.pasivos_dtos import (
    CrearSobrevivientesDTO,
    EgresarPasivoDTO,
    ProcesarEgresoDTO,
    RegistrarPasivoDirectoDTO,
)
from apps.pasivos.application.use_cases.actualizar_pasivo import actualizar_pasivo
from apps.pasivos.application.use_cases.egresar_pasivo import (
    egresar_pasivo,
    listar_motivos_egreso_pasivo,
)
from apps.pasivos.application.use_cases.crear_sobrevivientes import ejecutar_creacion_sobrevivientes
from apps.pasivos.application.use_cases.listar_pasivos import listar_pasivos_paginados
from apps.pasivos.application.use_cases.obtener_pasivo import obtener_pasivo_por_cedula
from apps.pasivos.application.use_cases.procesar_egreso import procesar_egreso
from apps.pasivos.application.use_cases.registrar_pasivo_directo import registrar_pasivo_directo
from apps.pasivos.infrastructure.pdf_pasivo import construir_pdf_expediente_pasivo
from apps.pasivos.infrastructure.repositories.repo_pasivos_orm import RepoPasivosORM
from apps.pasivos.infrastructure.serializers.pasivo_actualizar_serializer import (
    PasivoActualizarInputSerializer,
)
from apps.pasivos.presentation.serializers.pasivos_serializers import (
    CrearSobrevivientesInputSerializer,
    PasivoCrearInputSerializer,
    PasivoEgresoInputSerializer,
    PasivoListaInputSerializer,
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

    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsAuthenticated(), HasPermission('pasivos.crear')()]
        return [IsAuthenticated(), HasPermission('pasivos.ver')()]

    @extend_schema(tags=['Pasivos'], summary='Listar trabajadores jubilados y pensionados', responses={200: PasivoSerializer(many=True)})
    def get(self, request):
        entrada = PasivoListaInputSerializer(data=request.query_params)
        entrada.is_valid(raise_exception=True)
        filtros = entrada.validated_data
        dtos, total = listar_pasivos_paginados(
            RepoPasivosORM(),
            cedula=filtros.get('cedula') or None,
            nombre=filtros.get('nombre') or None,
            codigo=filtros.get('codigo') or None,
            tipo_nomina_id=filtros.get('tipo_nomina_id') or None,
            motivo_id=filtros.get('motivo_id') or None,
            fecha_desde=filtros.get('fecha_desde'),
            fecha_hasta=filtros.get('fecha_hasta'),
            sin_cuenta=filtros.get('sin_cuenta'),
            limite=filtros.get('limit', 10),
            desplazamiento=filtros.get('offset', 0),
        )
        return ok({
            'count': total,
            'limit': filtros.get('limit', 10),
            'offset': filtros.get('offset', 0),
            'results': PasivoSerializer(dtos, many=True).data,
        })

    @extend_schema(
        tags=['Pasivos'], summary='Registrar jubilado/pensionado (alta directa)',
        request=PasivoCrearInputSerializer, responses={201: PasivoSerializer},
    )
    def post(self, request):
        entrada = PasivoCrearInputSerializer(data=request.data)
        entrada.is_valid(raise_exception=True)
        datos = dict(entrada.validated_data)
        tipo_nomina_id = datos.pop('tipo_nomina_id')
        motivo_id = datos.pop('motivo_id')
        fecha_vigencia = datos.pop('fecha_vigencia')
        with transaction.atomic():
            dto = registrar_pasivo_directo(
                RepoPasivosORM(),
                RegistrarPasivoDirectoDTO(
                    datos=datos,
                    tipo_nomina_id=tipo_nomina_id,
                    motivo_id=motivo_id,
                    fecha_vigencia=fecha_vigencia,
                    usuario_id=getattr(request.user, 'pk', None),
                ),
            )
            registrar_auditoria(
                trace_id=getattr(request, 'trace_id', None) or uuid.uuid4().hex,
                actor_id=getattr(request.user, 'pk', None),
                actor_cedula=str(getattr(request.user, 'cedula_id', '') or ''),
                actor_rol=getattr(getattr(request.user, 'rol', None), 'nombre_rol', '') or '',
                accion='pasivos.pasivo_creado', modulo='pasivos',
                recurso_tipo='Employee', recurso_id=dto.cedula,
                estado_nuevo={'cedula': dto.cedula, 'tipo_nomina_id': tipo_nomina_id, 'motivo_id': motivo_id, 'fecha_vigencia': str(fecha_vigencia)},
                **origen_de_peticion(request),
            )
        return ok(PasivoSerializer(dto).data, 'Pasivo registrado correctamente.', status=201)


class PasivoDetailView(APIView):
    permission_classes = [IsAuthenticated, HasPermission('pasivos.ver')]

    def get_permissions(self):
        if self.request.method in ('PUT', 'PATCH'):
            return [IsAuthenticated(), HasPermission('pasivos.editar')()]
        return [IsAuthenticated(), HasPermission('pasivos.ver')()]

    @extend_schema(tags=['Pasivos'], summary='Obtener expediente de trabajador pasivo por cédula', responses={200: PasivoSerializer})
    def get(self, request, cedula: str):
        repo = RepoPasivosORM()
        dto = obtener_pasivo_por_cedula(repo, cedula=cedula)
        return ok(PasivoSerializer(dto).data)

    @extend_schema(
        tags=['Pasivos'], summary='Actualizar datos básicos del pasivo',
        request=PasivoActualizarInputSerializer, responses={200: PasivoSerializer},
    )
    def patch(self, request, cedula: str):
        entrada = PasivoActualizarInputSerializer(
            data=request.data, partial=True, context={'request': request, 'view': self, 'cedula': cedula}
        )
        entrada.is_valid(raise_exception=True)
        nueva = entrada.validated_data.get('nacionalidad_id')
        if nueva and nueva != obtener_pasivo_por_cedula(RepoPasivosORM(), cedula=cedula).nacionalidad_id                 and not usuario_tiene_permiso(request.user, 'personal.editar_nacionalidad'):
            return fail('No posee permiso para modificar la nacionalidad del trabajador.', status=403)
        with transaction.atomic():
            dto = actualizar_pasivo(RepoPasivosORM(), cedula, dict(entrada.validated_data))
            registrar_auditoria(
                trace_id=getattr(request, 'trace_id', None) or uuid.uuid4().hex,
                actor_id=getattr(request.user, 'pk', None),
                actor_cedula=str(getattr(request.user, 'cedula_id', '') or ''),
                actor_rol=getattr(getattr(request.user, 'rol', None), 'nombre_rol', '') or '',
                accion='pasivos.pasivo_actualizado', modulo='pasivos',
                recurso_tipo='Employee', recurso_id=cedula,
                estado_nuevo=dict(entrada.validated_data),
                **origen_de_peticion(request),
            )
        return ok(PasivoSerializer(dto).data, 'Datos del pasivo actualizados.')

    put = patch


class PasivoDetallePdfView(APIView):
    permission_classes = [IsAuthenticated, HasPermission('pasivos.exportar_pdf')]

    @extend_schema(tags=['Pasivos'], summary='Exportar el expediente de un trabajador pasivo en PDF')
    def get(self, request, cedula: str):
        repo = RepoPasivosORM()
        dto = obtener_pasivo_por_cedula(repo, cedula=cedula)
        pdf_bytes = construir_pdf_expediente_pasivo(dto)
        return _respuesta_pdf(pdf_bytes, f"expediente-pasivo-{cedula}.pdf")


class MotivosEgresoPasivoView(APIView):
    """Motivos válidos para egresar un pasivo (solo fallecimiento)."""

    permission_classes = [IsAuthenticated, HasPermission('pasivos.cambiar_condicion')]

    @extend_schema(tags=['Pasivos'], summary='Motivos de egreso de un pasivo')
    def get(self, request):
        return ok(listar_motivos_egreso_pasivo(RepoPasivosORM()))


class PasivoEgresoView(APIView):
    """Egreso de un pasivo; si hay fallecimiento, permite dar de alta sobrevivientes."""

    permission_classes = [IsAuthenticated, HasPermission('pasivos.cambiar_condicion')]

    @extend_schema(
        tags=['Pasivos'], summary='Egresar un pasivo (fallecimiento) y sus sobrevivientes',
        request=PasivoEgresoInputSerializer, responses={200: PasivoSerializer},
    )
    def post(self, request, cedula: str):
        entrada = PasivoEgresoInputSerializer(data=request.data)
        entrada.is_valid(raise_exception=True)
        datos = entrada.validated_data
        with transaction.atomic():
            dto, resultados = egresar_pasivo(
                RepoPasivosORM(),
                EgresarPasivoDTO(
                    cedula=cedula,
                    motivo_id=datos['motivo_id'],
                    sobrevivientes_familiar_ids=tuple(
                        datos.get('sobrevivientes_familiar_ids') or ()
                    ),
                    usuario_id=getattr(request.user, 'pk', None),
                    fecha_egreso=datos.get('fecha_egreso'),
                ),
            )
            registrar_auditoria(
                trace_id=getattr(request, 'trace_id', None) or uuid.uuid4().hex,
                actor_id=getattr(request.user, 'pk', None),
                actor_cedula=str(getattr(request.user, 'cedula_id', '') or ''),
                actor_rol=getattr(getattr(request.user, 'rol', None), 'nombre_rol', '') or '',
                accion='pasivo_egresado', modulo='pasivos',
                recurso_tipo='Employee', recurso_id=cedula,
                estado_nuevo={'motivo_id': datos['motivo_id']},
                **origen_de_peticion(request),
            )
            _auditar_altas_sobrevivientes(request, cedula, resultados)
        return ok(PasivoSerializer(dto).data, 'Egreso de pasivo procesado.')


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
                    fecha_egreso=datos.get('fecha_egreso'),
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
