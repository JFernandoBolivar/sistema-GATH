"""
Receivers de los eventos de fe de vida (C6): los traducen a notificaciones (sistema + correo) por el
puerto `Notificador` del kernel. Un fallo al notificar nunca tumba la decisión de negocio: se aísla en un
savepoint y se registra.

- En la transacción: avisos de trámite (recibida, repetición, rechazo, nuevas solicitudes, segundo check).
- Tras el commit: la validada genera la constancia PDF (C4) y avisa al pasivo con el PDF adjunto y copia
  a su correo alternativo.
"""
import logging
from datetime import datetime, timezone

from django.conf import settings
from django.db import transaction
from django.dispatch import receiver

from apps.fe_de_vida.application.use_cases.constancias import emitir_constancia
from apps.fe_de_vida.domain.events import TipoEvento
from apps.fe_de_vida.domain.services.notificaciones_eventos import notificacion_validada, solicitudes_de_evento
from apps.fe_de_vida.infrastructure.pdf.constancia_pdf import GeneradorConstanciaPDF
from apps.fe_de_vida.infrastructure.repositories.lector_pasivos_orm import LectorPasivosORM
from apps.fe_de_vida.infrastructure.repositories.repo_constancias_orm import RepoConstanciasORM
from apps.fe_de_vida.infrastructure.repositories.repo_procesos_orm import RepoProcesosORM
from apps.fe_de_vida.infrastructure.repositories.repo_solicitudes_orm import RepoSolicitudesFeDeVidaORM
from apps.fe_de_vida.infrastructure.signals import evento_fe_de_vida, evento_fe_de_vida_en_transaccion
from core.domain.configuracion import CLAVE_NOTIFICAR_BIENESTAR_POR_CORREO
from core.domain.exceptions import DomainError
from core.infrastructure.providers import obtener_lector_configuracion, obtener_notificador
from core.infrastructure.storage.seaweedfs_storage import SeaweedFSStorage

logger = logging.getLogger('gath.fe_de_vida')


@receiver(evento_fe_de_vida_en_transaccion, dispatch_uid='fe_de_vida_notificar_evento')
def notificar_evento_fe_de_vida(sender, evento, **kwargs):
    notificador = obtener_notificador()
    if notificador is None:
        logger.warning('sin Notificador registrado: el evento %s no genera avisos', evento.tipo.value)
        return
    lector = obtener_lector_configuracion()
    try:
        with transaction.atomic():
            correo_bienestar = (
                lector.obtener_booleano(CLAVE_NOTIFICAR_BIENESTAR_POR_CORREO)
                if lector is not None else False
            )
            for solicitud in solicitudes_de_evento(evento, correo_bienestar):
                notificador.notificar(solicitud)
    except DomainError:
        logger.exception('no se pudieron generar las notificaciones del evento %s', evento.tipo.value)


@receiver(evento_fe_de_vida, dispatch_uid='fe_de_vida_emitir_constancia')
def emitir_constancia_al_validar(sender, evento, **kwargs):
    if evento.tipo is not TipoEvento.VALIDADA:
        return
    try:
        with transaction.atomic():
            repo_proc = RepoProcesosORM()
            lector = LectorPasivosORM()

            # A7: Si la política de pasivos es ALTERNATIVO, actualizar el correo de acceso al VALIDAR la fe de vida
            try:
                from apps.configuracion.domain.correo_acceso import PoliticaFuenteCorreo
                from apps.configuracion.infrastructure.repositories.repo_politica_correo_acceso_orm import (
                    RepoPoliticaCorreoAccesoORM,
                )
                from apps.identidad.infrastructure.repositories.repo_correo_acceso_orm import (
                    RepoCorreoAccesoORM,
                )
                from core.presentation.audit import registrar_auditoria
                import uuid

                politica = RepoPoliticaCorreoAccesoORM().obtener_politica()
                if politica.politica_pasivos == PoliticaFuenteCorreo.ALTERNATIVO:
                    from apps.fe_de_vida.infrastructure.adaptadores_autogestion import RepoCambiosActaORM
                    cambios_acta = RepoCambiosActaORM().listar(evento.solicitud_id)
                    propuesta_alternativo = next(
                        (c for c in cambios_acta if c.campo == 'correo_alternativo' and c.valor_propuesto),
                        None,
                    )
                    if propuesta_alternativo:
                        nuevo_alternativo = str(propuesta_alternativo.valor_propuesto).strip()
                        pasivo_datos = lector.datos(evento.cedula)
                        if (
                            nuevo_alternativo
                            and nuevo_alternativo != pasivo_datos.correo
                        ):
                            repo_correo = RepoCorreoAccesoORM()
                            if not repo_correo.correo_en_uso_por_otro(
                                evento.cedula, nuevo_alternativo
                            ):
                                correo_previo = pasivo_datos.correo
                                repo_correo.establecer_correo(
                                    evento.cedula, nuevo_alternativo
                                )
                                registrar_auditoria(
                                    trace_id=uuid.uuid4().hex,
                                    accion='FE_DE_VIDA_CORREO_ACCESO_ACTUALIZADO',
                                    modulo='fe_de_vida',
                                    recurso_tipo='trabajador',
                                    recurso_id=str(evento.cedula),
                                    estado_previo={'correo': correo_previo},
                                    estado_nuevo={
                                        'correo': nuevo_alternativo,
                                        'origen': 'fe_de_vida_validada',
                                    },
                                    actor_cedula=str(evento.actor_cedula or ''),
                                )
            except Exception:
                logger.exception(
                    'no se pudo sincronizar el correo de acceso al validar fe de vida de %s',
                    evento.cedula,
                )

            constancia = emitir_constancia(
                repo_proc, RepoSolicitudesFeDeVidaORM(), RepoConstanciasORM(), lector, GeneradorConstanciaPDF(),
                SeaweedFSStorage(), solicitud_id=evento.solicitud_id,
                url_verificacion_base=settings.FE_DE_VIDA_URL_VERIFICACION, ahora=datetime.now(timezone.utc),
            )
            notificador = obtener_notificador()
            if notificador is None:
                logger.warning('sin Notificador registrado: la constancia %s no se avisa', constancia.numero)
                return
            pasivo = lector.datos(evento.cedula)
            copia = (pasivo.correo_alternativo,) if pasivo.correo_alternativo and pasivo.correo_alternativo != pasivo.correo else ()
            proceso = repo_proc.obtener(evento.proceso_id)
            notificador.notificar(notificacion_validada(
                evento, numero=constancia.numero, proceso_nombre=proceso.nombre if proceso else '',
                clave_pdf=constancia.clave_pdf, nombre_pdf=f'{constancia.numero}.pdf', correos_copia=copia,
            ))
    except DomainError:
        logger.exception('no se pudo emitir ni avisar la constancia de la solicitud %s', evento.solicitud_id)
