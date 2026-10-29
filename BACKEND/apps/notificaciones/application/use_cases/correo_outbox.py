"""
Outbox de correo: encolar (misma transacción del hecho), enviar con reintentos y reprocesar pendientes.

Garantías: el mensaje se escribe en la transacción del negocio (si ésta se revierte, no hay correo);
el envío es idempotente por `idempotency_key` (tipo:ref:clave:destinatario:canal) y por estado
(solo un PENDIENTE vencido y bloqueado se envía); es "al menos una vez" ante una caída entre el
envío SMTP y el commit. Los reintentos usan backoff exponencial y, al agotar los intentos, FALLIDO.
"""
import base64
import logging
from dataclasses import dataclass
from datetime import datetime, timedelta
from uuid import uuid4

from apps.notificaciones.domain.entities.mensaje_outbox import AdjuntoOutbox, MensajeOutbox
from apps.notificaciones.domain.ports.repo_outbox import RepoOutbox
from apps.notificaciones.domain.ports.servicios import EnviadorCorreo, PlanificadorEnvio
from apps.notificaciones.domain.services.plantilla_correo import render_correo
from apps.notificaciones.domain.services.politica_reintento import segundos_hasta_reintento
from apps.notificaciones.domain.value_objects.estado_outbox import Canal, EstadoOutbox
from core.domain.ports import FileStorage

logger = logging.getLogger('gath.notificaciones')

TOLERANCIA_RELOJ = timedelta(seconds=5)
GRACIA_REPROCESO = timedelta(minutes=2)  # el beat solo toma lo que lleva vencido más que esto


@dataclass(frozen=True)
class ResultadoEnvio:
    estado: str                      # ENVIADO | REINTENTAR | FALLIDO | OMITIDO
    reintentar_en: int | None = None  # segundos


def encolar_correo(
    repo: RepoOutbox, planificador: PlanificadorEnvio, *, tipo: str, destinatario: str, destinatario_cedula: str,
    asunto: str, titulo: str, mensaje: str, enlace: str = '', ref_id: str = '', clave: str = '',
    copia_a: tuple[str, ...] = (), adjuntos: tuple[AdjuntoOutbox, ...] = (),
) -> bool:
    """Escribe el mensaje en el outbox (transacción vigente) y programa el envío tras el commit."""
    llave = f'{tipo}:{ref_id}:{clave}:{destinatario.lower()}:{Canal.EMAIL.value}'[:250]
    creado = repo.agregar(MensajeOutbox(
        id=str(uuid4()), tipo=tipo, canal=Canal.EMAIL, destinatario=destinatario,
        destinatario_cedula=destinatario_cedula, asunto=asunto, titulo=titulo, mensaje=mensaje,
        enlace=enlace, idempotency_key=llave, copia_a=copia_a, adjuntos=adjuntos,
    ))
    if creado is None:
        logger.info('correo %s duplicado, se ignora (idempotency_key ya existe)', tipo)
        return False
    planificador.programar(creado.id)
    return True


def _adjuntos_a_bytes(adjuntos: tuple[AdjuntoOutbox, ...], almacen: FileStorage) -> list[tuple[str, bytes, str]]:
    salida = []
    for a in adjuntos:
        contenido = base64.b64decode(a.contenido_b64) if a.contenido_b64 else almacen.descargar(a.clave_almacen)
        salida.append((a.nombre, contenido, a.mime))
    return salida


def enviar_correo(
    repo: RepoOutbox, enviador: EnviadorCorreo, almacen: FileStorage, outbox_id: str, ahora: datetime,
    *, max_intentos: int = 5, backoff_base: int = 60, url_base: str = '',
) -> ResultadoEnvio:
    """Envía un mensaje del outbox. Debe ejecutarse dentro de una transacción (la fila queda bloqueada)."""
    msg = repo.obtener_bloqueado(outbox_id)
    if msg is None or msg.estado is not EstadoOutbox.PENDIENTE:
        return ResultadoEnvio('OMITIDO')
    if msg.proximo_intento and msg.proximo_intento > ahora + TOLERANCIA_RELOJ:
        return ResultadoEnvio('OMITIDO')  # un reintento anterior ya reprogramó; no adelantarlo
    try:
        enlace = f'{url_base.rstrip("/")}{msg.enlace}' if msg.enlace and url_base else ''
        texto, html = render_correo(msg.titulo, msg.mensaje, enlace)
        enviador.enviar(
            destinatario=msg.destinatario, copia_a=msg.copia_a, asunto=msg.asunto, texto=texto, html=html,
            adjuntos=_adjuntos_a_bytes(msg.adjuntos, almacen),
        )
    except Exception as exc:  # noqa: BLE001 - cualquier fallo de transporte o almacén cuenta como intento
        intentos = msg.intentos + 1
        error = f'{type(exc).__name__}: {exc}'[:500]
        if intentos >= max_intentos:
            repo.registrar_fallo(outbox_id, intentos, EstadoOutbox.FALLIDO, None, error)
            logger.error('correo %s FALLIDO tras %s intentos: %s', outbox_id, intentos, error)
            return ResultadoEnvio('FALLIDO')
        espera = segundos_hasta_reintento(intentos, backoff_base)
        repo.registrar_fallo(outbox_id, intentos, EstadoOutbox.PENDIENTE, ahora + timedelta(seconds=espera), error)
        logger.warning('correo %s falló (intento %s/%s), reintento en %ss: %s', outbox_id, intentos, max_intentos, espera, error)
        return ResultadoEnvio('REINTENTAR', espera)
    repo.marcar_enviado(outbox_id, ahora)
    logger.info('correo %s enviado (%s)', outbox_id, msg.tipo)
    return ResultadoEnvio('ENVIADO')


def reprocesar_pendientes(repo: RepoOutbox, planificador: PlanificadorEnvio, ahora: datetime, limite: int = 200) -> int:
    """Red de seguridad (beat): reprograma los PENDIENTES vencidos que nadie envió (broker caído, worker caído)."""
    ids = repo.ids_pendientes_vencidos(ahora - GRACIA_REPROCESO, limite)
    for outbox_id in ids:
        planificador.programar(outbox_id)
    return len(ids)
