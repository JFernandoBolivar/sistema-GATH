"""
Vistas de configuración de Correo de Acceso y aplicación masiva (A7).
"""
import uuid
from drf_spectacular.utils import extend_schema
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.configuracion.application.use_cases.gestionar_politica_correo_acceso import (
    actualizar_politica_correo_acceso,
    aplicar_politica_masiva,
    obtener_politica_correo_acceso,
    obtener_vista_previa_masiva,
)
from apps.configuracion.domain.correo_acceso import (
    ACCION_APLICACION_MASIVA_CORREO,
    ACCION_POLITICA_CORREO_ACTUALIZADA,
    MODULO_AUDITORIA_CONFIGURACION,
    RECURSO_CORREO_ACCESO_MASIVO,
    RECURSO_POLITICA_CORREO_ACCESO,
)
from apps.configuracion.infrastructure.repositories.repo_politica_correo_acceso_orm import (
    RepoPoliticaCorreoAccesoORM,
)
from apps.configuracion.infrastructure.serializers.politica_correo_acceso_serializers import (
    AplicarPoliticaMasivaRequestSerializer,
    PoliticaCorreoAccesoSerializer,
    ResumenVistaPreviaSerializer,
)
from core.domain.exceptions import ColaTareasNoDisponible
from core.domain.notificaciones import CorreoSolicitado, SolicitudNotificacion
from core.infrastructure.providers import obtener_notificador
from core.infrastructure.tasks.celery_queue import CeleryTaskQueue
from core.presentation.audit import origen_de_peticion, registrar_auditoria
from core.presentation.envelope import ok
from core.presentation.permissions import HasPermission
from core.presentation.schema import MensajeRespuestaSerializer

PERMISO_VER = 'configuracion.ver'
PERMISO_EDITAR = 'configuracion.editar'

# A partir de este tamaño el lote va a Celery; por debajo se aplica en la petición
# para que la pantalla reciba el resumen de inmediato.
UMBRAL_APLICACION_ASINCRONA = 200
TAREA_APLICAR_LOTE = 'configuracion.aplicar_correo_acceso_lote'


def _actor(request) -> dict:
    user = request.user
    return {
        'actor_id': getattr(user, 'pk', None),
        'actor_cedula': str(getattr(user, 'cedula_id', '') or ''),
        'actor_rol': str(getattr(getattr(user, 'rol', None), 'nombre_rol', '') or ''),
    }


def _trace(request) -> str:
    return getattr(request, 'trace_id', None) or uuid.uuid4().hex


class PoliticaCorreoAccesoView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=['Configuración'],
        summary='Consultar la política vigente de correo de acceso',
        responses={200: PoliticaCorreoAccesoSerializer},
    )
    def get(self, request):
        HasPermission(PERMISO_VER).has_permission(request, self)
        repo = RepoPoliticaCorreoAccesoORM()
        politica = obtener_politica_correo_acceso(repo)
        return ok(
            {
                'politica_pasivos': politica.politica_pasivos.value,
                'politica_activos': politica.politica_activos.value,
                'si_falta_elegido': politica.si_falta_elegido.value,
                'avisar_al_aplicar_masivo': politica.avisar_al_aplicar_masivo,
            }
        )

    @extend_schema(
        tags=['Configuración'],
        summary='Actualizar la política global de correo de acceso',
        request=PoliticaCorreoAccesoSerializer,
        responses={200: PoliticaCorreoAccesoSerializer, 400: MensajeRespuestaSerializer},
    )
    def put(self, request):
        HasPermission(PERMISO_EDITAR).has_permission(request, self)
        serializer = PoliticaCorreoAccesoSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        repo = RepoPoliticaCorreoAccesoORM()
        actor_id = getattr(request.user, 'pk', None)
        anterior, nuevo = actualizar_politica_correo_acceso(
            repo, serializer.validated_data, actor_id=actor_id
        )

        registrar_auditoria(
            trace_id=_trace(request),
            accion=ACCION_POLITICA_CORREO_ACTUALIZADA,
            modulo=MODULO_AUDITORIA_CONFIGURACION,
            recurso_tipo=RECURSO_POLITICA_CORREO_ACCESO,
            recurso_id='global',
            estado_previo={
                'politica_pasivos': anterior.politica_pasivos.value,
                'politica_activos': anterior.politica_activos.value,
                'si_falta_elegido': anterior.si_falta_elegido.value,
                'avisar_al_aplicar_masivo': anterior.avisar_al_aplicar_masivo,
            },
            estado_nuevo={
                'politica_pasivos': nuevo.politica_pasivos.value,
                'politica_activos': nuevo.politica_activos.value,
                'si_falta_elegido': nuevo.si_falta_elegido.value,
                'avisar_al_aplicar_masivo': nuevo.avisar_al_aplicar_masivo,
            },
            **_actor(request),
            **origen_de_peticion(request),
        )

        return ok(
            {
                'politica_pasivos': nuevo.politica_pasivos.value,
                'politica_activos': nuevo.politica_activos.value,
                'si_falta_elegido': nuevo.si_falta_elegido.value,
                'avisar_al_aplicar_masivo': nuevo.avisar_al_aplicar_masivo,
            },
            'Política de correo de acceso actualizada correctamente.',
        )


class VistaPreviaCorreoAccesoView(APIView):
    permission_classes = [IsAuthenticated, HasPermission(PERMISO_VER)]

    @extend_schema(
        tags=['Configuración'],
        summary='Vista previa de aplicación masiva de política de correo de acceso',
        responses={200: ResumenVistaPreviaSerializer},
    )
    def get(self, request):
        grupo = request.query_params.get('grupo', 'activos')
        incluir_excepciones = request.query_params.get('incluir_excepciones', 'false').lower() == 'true'

        repo = RepoPoliticaCorreoAccesoORM()
        resumen = obtener_vista_previa_masiva(
            repo, grupo=grupo, incluir_excepciones=incluir_excepciones
        )
        return ok(
            {
                'total_evaluados': resumen.total_evaluados,
                'cambian': resumen.cambian,
                'quedan_igual': resumen.quedan_igual,
                'quedan_sin_cuenta': resumen.quedan_sin_cuenta,
                'excepciones_manuales_ignoradas': resumen.excepciones_manuales_ignoradas,
                'items': [
                    {
                        'cedula': it.cedula,
                        'nombre_completo': it.nombre_completo,
                        'condicion': it.condicion,
                        'correo_actual': it.correo_actual,
                        'correo_propuesto': it.correo_propuesto,
                        'cambiara': it.cambiara,
                        'quedara_sin_cuenta': it.quedara_sin_cuenta,
                        'es_excepcion_manual': it.es_excepcion_manual,
                        'motivo_exclusion': it.motivo_exclusion,
                    }
                    for it in resumen.items
                ],
            }
        )


class AplicarPoliticaCorreoAccesoView(APIView):
    permission_classes = [IsAuthenticated, HasPermission(PERMISO_EDITAR)]

    @extend_schema(
        tags=['Configuración'],
        summary='Aplicar masivamente la política de correo de acceso a un grupo',
        request=AplicarPoliticaMasivaRequestSerializer,
        responses={200: MensajeRespuestaSerializer, 400: MensajeRespuestaSerializer},
    )
    def post(self, request):
        serializer = AplicarPoliticaMasivaRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        grupo = serializer.validated_data['grupo']
        motivo = serializer.validated_data['motivo']
        incluir_excepciones = serializer.validated_data['incluir_excepciones']

        repo = RepoPoliticaCorreoAccesoORM()
        total = len(repo.listar_trabajadores_por_grupo(grupo))
        if total > UMBRAL_APLICACION_ASINCRONA:
            try:
                tarea_id = CeleryTaskQueue().encolar(
                    TAREA_APLICAR_LOTE,
                    grupo=grupo,
                    motivo=motivo,
                    incluir_excepciones=incluir_excepciones,
                )
                return ok(
                    {'asincrono': True, 'tarea_id': tarea_id, 'total': total},
                    f'El lote de {total} cuentas se procesará en segundo plano.',
                )
            except ColaTareasNoDisponible:
                # Sin broker se aplica en la petición: mejor lento que perder el trabajo.
                pass

        trace_id = _trace(request)
        actor_data = _actor(request)
        origen_data = origen_de_peticion(request)

        def auditar_por_cuenta(cedula: str, correo_ant: str, correo_nuevo: str | None, mot: str):
            registrar_auditoria(
                trace_id=trace_id,
                accion=ACCION_APLICACION_MASIVA_CORREO,
                modulo=MODULO_AUDITORIA_CONFIGURACION,
                recurso_tipo=RECURSO_CORREO_ACCESO_MASIVO,
                recurso_id=cedula,
                estado_previo={'correo': correo_ant, 'motivo': mot},
                estado_nuevo={'correo': correo_nuevo, 'motivo': mot},
                **actor_data,
                **origen_data,
            )

        def notificar_por_cuenta(cedula: str, correo_nuevo: str, mot: str):
            notificador = obtener_notificador()
            if notificador is None:
                return
            notificador.notificar(SolicitudNotificacion(
                tipo='configuracion.correo_acceso_actualizado',
                titulo='Su correo de inicio de sesión cambió',
                mensaje=(
                    f'Desde ahora ingresa a GATH con {correo_nuevo}. '
                    f'Motivo: {mot}. '
                    'Si no reconoce este cambio, comuníquese con Gestión Humana.'
                ),
                cedula_destino=cedula,
                ref_tipo='correo_acceso',
                ref_id=cedula,
                clave=correo_nuevo,
                correo=CorreoSolicitado(asunto='Su correo de inicio de sesión en GATH'),
                modulo='seguridad',
            ))

        resultado = aplicar_politica_masiva(
            repo,
            grupo=grupo,
            motivo=motivo,
            incluir_excepciones=incluir_excepciones,
            auditar_cuenta=auditar_por_cuenta,
            notificar_cuenta=notificar_por_cuenta,
        )

        return ok(
            resultado,
            f'Se aplicó la política a {resultado["actualizados"]} cuenta(s) del grupo {grupo}.',
        )
