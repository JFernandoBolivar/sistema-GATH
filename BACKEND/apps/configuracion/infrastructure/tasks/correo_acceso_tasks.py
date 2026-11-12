"""
O15: aplicación masiva del correo de acceso en segundo plano (Celery).

El endpoint encola esta tarea cuando el grupo es grande. Procesa la política por
lotes, audita por cuenta y, si el interruptor de avisos está encendido, notifica
al nuevo correo.
"""
import logging
import uuid

from celery import shared_task

from apps.configuracion.application.use_cases.gestionar_politica_correo_acceso import (
    aplicar_politica_masiva,
)
from apps.configuracion.domain.correo_acceso import (
    ACCION_APLICACION_MASIVA_CORREO,
    MODULO_AUDITORIA_CONFIGURACION,
    RECURSO_CORREO_ACCESO_MASIVO,
)
from apps.configuracion.infrastructure.repositories.repo_politica_correo_acceso_orm import (
    RepoPoliticaCorreoAccesoORM,
)
from core.domain.notificaciones import CorreoSolicitado, SolicitudNotificacion
from core.infrastructure.providers import obtener_notificador
from core.infrastructure.auditoria_contexto import con_origen_de_tarea
from core.presentation.audit import registrar_auditoria

logger = logging.getLogger('gath.tasks')


@shared_task(name='configuracion.aplicar_correo_acceso_lote', acks_late=True)
@con_origen_de_tarea
def aplicar_correo_acceso_lote(grupo: str, motivo: str, incluir_excepciones: bool = False) -> dict:
    trace_id = uuid.uuid4().hex
    actor = {
        'actor_id': None,
        'actor_cedula': 'sistema (lote)',
        'actor_rol': 'SISTEMA',
    }

    def auditar(cedula: str, correo_ant: str, correo_nuevo: str | None, mot: str) -> None:
        registrar_auditoria(
            trace_id=trace_id,
            accion=ACCION_APLICACION_MASIVA_CORREO,
            modulo=MODULO_AUDITORIA_CONFIGURACION,
            recurso_tipo=RECURSO_CORREO_ACCESO_MASIVO,
            recurso_id=cedula,
            estado_previo={'correo': correo_ant, 'motivo': mot},
            estado_nuevo={'correo': correo_nuevo, 'motivo': mot},
            **actor,
        )

    def notificar(cedula: str, correo_nuevo: str, mot: str) -> None:
        notificador = obtener_notificador()
        if notificador is None:
            return
        notificador.notificar(SolicitudNotificacion(
            tipo='configuracion.correo_acceso_actualizado',
            titulo='Su correo de inicio de sesión cambió',
            mensaje=(
                f'Desde ahora ingresa a GATH con {correo_nuevo}. Motivo: {mot}. '
                'Si no reconoce este cambio, comuníquese con Gestión Humana.'
            ),
            cedula_destino=cedula,
            ref_tipo='correo_acceso',
            ref_id=cedula,
            clave=correo_nuevo,
            correo=CorreoSolicitado(asunto='Su correo de inicio de sesión en GATH'),
            modulo='seguridad',
        ))

    try:
        resultado = aplicar_politica_masiva(
            RepoPoliticaCorreoAccesoORM(),
            grupo=grupo,
            motivo=motivo,
            incluir_excepciones=incluir_excepciones,
            auditar_cuenta=auditar,
            notificar_cuenta=notificar,
        )
        logger.info('Correo de acceso: lote %s terminado (%s)', grupo, resultado)
        return resultado
    except Exception:
        logger.exception('Correo de acceso: falló el lote %s', grupo)
        raise
