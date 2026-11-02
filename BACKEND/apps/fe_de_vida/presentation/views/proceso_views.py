"""Vistas de procesos y prórrogas (C17): listar, crear, abrir, cerrar y prorrogar (individual o general)."""
from django.db import transaction
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.views import APIView

from apps.fe_de_vida.application.use_cases._comun import obtener_proceso
from apps.fe_de_vida.application.use_cases.consultas import listar_procesos, listar_prorrogas
from apps.fe_de_vida.application.use_cases.procesos import (
    abrir_proceso,
    cerrar_proceso,
    crear_proceso,
    editar_proceso,
    prorrogar_proceso,
)
from apps.fe_de_vida.infrastructure.repositories.lector_alcance_orm import LectorAlcanceORM
from apps.fe_de_vida.infrastructure.repositories.repo_procesos_orm import RepoProcesosORM
from apps.fe_de_vida.infrastructure.repositories.repo_solicitudes_orm import RepoSolicitudesFeDeVidaORM
from apps.fe_de_vida.infrastructure.signals import PublicadorSenales
from apps.fe_de_vida.presentation.permissions import fe_de_vida_permissions as permisos
from apps.fe_de_vida.presentation.serializers.fe_de_vida_serializers import (
    CrearProcesoSerializer,
    EditarProcesoSerializer,
    FiltroProcesosSerializer,
    PaginaSerializer,
    ProcesoSerializer,
    ProrrogarSerializer,
    ProrrogaSerializer,
    TipoPensionSerializer,
    a_dict_proceso,
    a_dict_prorroga,
)
from apps.fe_de_vida.presentation.views._comun import (
    RECURSO_PROCESO,
    ahora,
    auditar,
    cedula_de_sesion,
    nombres_de_tipos,
    parametros_pagina,
    respuesta_pagina,
    validar_entrada,
)
from core.presentation.envelope import ok
from core.presentation.schema import MensajeRespuestaSerializer

TAG = ['Fe de vida · Procesos']
ERRORES = {400: MensajeRespuestaSerializer, 403: MensajeRespuestaSerializer, 404: MensajeRespuestaSerializer,
           409: MensajeRespuestaSerializer}
PARAMETROS_PAGINA = [OpenApiParameter('limit', int, description='Por defecto 10, máximo 50'), OpenApiParameter('offset', int)]


class ProcesosView(APIView):
    """GET lista (gestionar, prorrogar o ver panel); POST crea (solo gestionar procesos)."""

    def get_permissions(self):
        codigos = (permisos.GESTIONAR_PROCESOS,) if self.request.method == 'POST' else (
            permisos.GESTIONAR_PROCESOS, permisos.PRORROGAR, permisos.VER_PANEL)
        return [p() for p in permisos.permisos_bienestar(*codigos)]

    @extend_schema(
        tags=TAG, summary='Procesos de fe de vida (paginado)',
        parameters=[OpenApiParameter('estado', str, description='BORRADOR, ABIERTO o CERRADO'), *PARAMETROS_PAGINA],
        responses={200: ProcesoSerializer(many=True), 400: MensajeRespuestaSerializer, 403: MensajeRespuestaSerializer},
    )
    def get(self, request):
        filtros = validar_entrada(FiltroProcesosSerializer, request.query_params)
        limite, desplazamiento = parametros_pagina(filtros)
        procesos, total = listar_procesos(
            RepoProcesosORM(), estado=filtros.get('estado'), limite=limite, desplazamiento=desplazamiento,
        )
        nombres = nombres_de_tipos(*procesos)
        return ok(respuesta_pagina(total, filtros, [a_dict_proceso(p, nombres) for p in procesos]))

    @extend_schema(tags=TAG, summary='Crear un proceso (queda en BORRADOR)', request=CrearProcesoSerializer,
                   responses={201: ProcesoSerializer, **ERRORES})
    def post(self, request):
        datos = validar_entrada(CrearProcesoSerializer, request.data)
        with transaction.atomic():
            proceso = crear_proceso(
                RepoProcesosORM(), LectorAlcanceORM(), nombre=datos['nombre'], fecha_apertura=datos['fecha_apertura'],
                fecha_cierre=datos['fecha_cierre'], actor=cedula_de_sesion(request),
                tipos_nomina=tuple(datos.get('tipos_nomina', ())),
                dias_recordatorio=tuple(datos.get('dias_recordatorio', ())),
            )
            auditar(request, 'PROCESO_CREADO', proceso.id, None,
                    {'nombre': proceso.nombre, 'apertura': proceso.fecha_apertura.isoformat(),
                     'cierre': proceso.fecha_cierre.isoformat(), 'tipos_nomina': list(proceso.tipos_nomina),
                     'dias_recordatorio': list(proceso.dias_recordatorio)}, recurso_tipo=RECURSO_PROCESO)
        return ok(a_dict_proceso(proceso, nombres_de_tipos(proceso)), 'Proceso creado.', status=201)


class ProcesoView(APIView):
    """PATCH edita el proceso (BORRADOR: todo; ABIERTO: solo recordatorios). Solo gestionar procesos."""

    permission_classes = permisos.permisos_bienestar(permisos.GESTIONAR_PROCESOS)

    @extend_schema(
        tags=TAG, summary='Editar el proceso (alcance, fechas, recordatorios)', request=EditarProcesoSerializer,
        responses={200: ProcesoSerializer, **ERRORES},
    )
    def patch(self, request, proceso_id):
        datos = dict(validar_entrada(EditarProcesoSerializer, request.data))
        with transaction.atomic():
            repo = RepoProcesosORM()
            previo = obtener_proceso(repo, str(proceso_id))
            proceso = editar_proceso(repo, LectorAlcanceORM(), proceso_id=str(proceso_id), cambios=datos)
            auditar(request, 'PROCESO_EDITADO', proceso.id,
                    {'tipos_nomina': list(previo.tipos_nomina), 'dias_recordatorio': list(previo.dias_recordatorio)},
                    {'campos': sorted(datos), 'tipos_nomina': list(proceso.tipos_nomina),
                     'dias_recordatorio': list(proceso.dias_recordatorio)}, recurso_tipo=RECURSO_PROCESO)
        return ok(a_dict_proceso(proceso, nombres_de_tipos(proceso)), 'Proceso actualizado.')


class TiposPensionView(APIView):
    """Catálogo para elegir el alcance: tipos de nómina usados por asignaciones PASIVO (por consulta)."""

    permission_classes = permisos.permisos_bienestar(permisos.GESTIONAR_PROCESOS, permisos.PRORROGAR, permisos.VER_PANEL)

    @extend_schema(tags=TAG, summary='Tipos de pensión disponibles para el alcance',
                   responses={200: TipoPensionSerializer(many=True), 403: MensajeRespuestaSerializer})
    def get(self, request):
        return ok([{'id': t.id, 'nombre': t.nombre} for t in LectorAlcanceORM().tipos_pension()])


class AbrirProcesoView(APIView):
    permission_classes = permisos.permisos_bienestar(permisos.GESTIONAR_PROCESOS)

    @extend_schema(tags=TAG, summary='Abrir el proceso', request=None, responses={200: ProcesoSerializer, **ERRORES})
    def post(self, request, proceso_id):
        with transaction.atomic():
            proceso = abrir_proceso(
                RepoProcesosORM(), PublicadorSenales(), proceso_id=str(proceso_id), actor=cedula_de_sesion(request),
            )
            auditar(request, 'PROCESO_ABIERTO', proceso.id, {'estado': 'BORRADOR'}, {'estado': proceso.estado.value},
                    recurso_tipo=RECURSO_PROCESO)
        return ok(a_dict_proceso(proceso, nombres_de_tipos(proceso)), 'Proceso abierto.')


class CerrarProcesoView(APIView):
    permission_classes = permisos.permisos_bienestar(permisos.GESTIONAR_PROCESOS)

    @extend_schema(
        tags=TAG, summary='Cerrar el proceso',
        description='Las solicitudes sin enviar y sin prórroga vigente pasan a EXPIRADA (sin sanción automática).',
        request=None, responses={200: ProcesoSerializer, **ERRORES},
    )
    def post(self, request, proceso_id):
        with transaction.atomic():
            proceso, expiradas = cerrar_proceso(
                RepoProcesosORM(), RepoSolicitudesFeDeVidaORM(), PublicadorSenales(), proceso_id=str(proceso_id),
                actor=cedula_de_sesion(request), ahora=ahora(),
            )
            auditar(request, 'PROCESO_CERRADO', proceso.id, {'estado': 'ABIERTO'},
                    {'estado': proceso.estado.value, 'expiradas': expiradas}, recurso_tipo=RECURSO_PROCESO)
        return ok(a_dict_proceso(proceso, nombres_de_tipos(proceso)), 'Proceso cerrado.')


class ProrrogasView(APIView):
    """GET historial de prórrogas del proceso; POST concede una (individual con cédula, general sin ella)."""

    def get_permissions(self):
        codigos = (permisos.PRORROGAR, permisos.GESTIONAR_PROCESOS)
        if self.request.method == 'GET':
            codigos += (permisos.VER_PANEL,)
        return [p() for p in permisos.permisos_bienestar(*codigos)]

    @extend_schema(tags=TAG, summary='Prórrogas del proceso (paginado)', parameters=PARAMETROS_PAGINA,
                   responses={200: ProrrogaSerializer(many=True), **ERRORES})
    def get(self, request, proceso_id):
        filtros = validar_entrada(PaginaSerializer, request.query_params)
        limite, desplazamiento = parametros_pagina(filtros)
        prorrogas, total = listar_prorrogas(
            RepoProcesosORM(), proceso_id=str(proceso_id), limite=limite, desplazamiento=desplazamiento,
        )
        return ok(respuesta_pagina(total, filtros, [a_dict_prorroga(p) for p in prorrogas]))

    @extend_schema(tags=TAG, summary='Conceder una prórroga (individual o general)', request=ProrrogarSerializer,
                   responses={201: ProrrogaSerializer, **ERRORES})
    def post(self, request, proceso_id):
        datos = validar_entrada(ProrrogarSerializer, request.data)
        with transaction.atomic():
            prorroga = prorrogar_proceso(
                RepoProcesosORM(), RepoSolicitudesFeDeVidaORM(), PublicadorSenales(), proceso_id=str(proceso_id),
                cedula=datos.get('cedula'), nueva_fecha_limite=datos['nueva_fecha_limite'], motivo=datos['motivo'],
                actor=cedula_de_sesion(request), ahora=ahora(),
            )
            auditar(request, 'PRORROGA_CONCEDIDA', str(proceso_id), None,
                    {'general': prorroga.general, 'cedula': prorroga.cedula, 'hasta': prorroga.nueva_fecha_limite.isoformat(),
                     'motivo': prorroga.motivo}, recurso_tipo=RECURSO_PROCESO)
        return ok(a_dict_prorroga(prorroga), 'Prórroga concedida.', status=201)
