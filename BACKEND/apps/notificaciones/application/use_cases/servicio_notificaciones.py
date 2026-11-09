"""
Servicio de notificaciones: implementa el puerto transversal `core.domain.ports.Notificador`.

Para una `SolicitudNotificacion` resuelve destinatarios (una cédula, o todas las cuentas activas con
un PERMISO, jamás por nombre de rol), crea las filas de la campana y, si se pidió correo, escribe el
mensaje en el outbox. Todo en la transacción vigente del llamador; el envío real se encola después
del commit (lo hace el `PlanificadorEnvio`). Sin ORM, sin Celery.
"""
import base64
import logging

from apps.notificaciones.application.use_cases.correo_outbox import encolar_correo
from apps.notificaciones.domain.entities.mensaje_outbox import AdjuntoOutbox
from apps.notificaciones.domain.entities.notificacion import Notificacion
from apps.notificaciones.domain.ports.repo_notificaciones import RepoNotificaciones
from apps.notificaciones.domain.ports.repo_outbox import RepoOutbox
from apps.notificaciones.domain.ports.servicios import CacheConteo, PlanificadorEnvio, ResolutorDestinatarios
from core.domain.notificaciones import SolicitudNotificacion

logger = logging.getLogger('gath.notificaciones')


def _clave_unica(s: SolicitudNotificacion) -> str:
    """Dedupe por destinatario: solo cuando el emisor identificó el hecho (ref_id o clave)."""
    if not (s.ref_id or s.clave):
        return ''
    return f'{s.tipo}:{s.ref_id}:{s.clave}'[:160]


class ServicioNotificaciones:
    def __init__(
        self, repo: RepoNotificaciones, repo_outbox: RepoOutbox, resolutor: ResolutorDestinatarios,
        cache: CacheConteo, planificador: PlanificadorEnvio,
    ):
        self._repo, self._outbox, self._resolutor = repo, repo_outbox, resolutor
        self._cache, self._planificador = cache, planificador

    def _destinatarios(self, s: SolicitudNotificacion) -> list[str]:
        cedulas = [s.cedula_destino] if s.cedula_destino else self._resolutor.cedulas_con_permiso(s.permiso_destino)
        excluidas = set(s.excluir_cedulas)
        return [c for c in dict.fromkeys(cedulas) if c and c not in excluidas]

    def notificar(self, s: SolicitudNotificacion) -> int:
        destinatarios = self._destinatarios(s)
        if not destinatarios:
            logger.warning('notificación %s sin destinatarios (permiso=%s)', s.tipo, s.permiso_destino or '-')
            return 0
        clave = _clave_unica(s)
        creadas = self._repo.crear_muchas([
            Notificacion(
                id='', destinatario_cedula=c, tipo=s.tipo, titulo=s.titulo, mensaje=s.mensaje,
                enlace=s.enlace, ref_tipo=s.ref_tipo, ref_id=s.ref_id, clave_unica=clave, modulo=s.modulo,
            )
            for c in destinatarios
        ])
        for c in destinatarios:
            self._cache.invalidar(c)
        if s.correo is not None and creadas:
            for c in destinatarios:  # una persona o cada cuenta con el permiso; el outbox deduplica por destinatario
                self._correo(s, c)
        return creadas

    def _correo(self, s: SolicitudNotificacion, cedula: str) -> None:
        direccion = self._resolutor.correo_de(cedula)
        if not direccion:
            logger.info('sin correo para enviar %s (la notificación en el sistema sí se creó)', s.tipo)
            return
        adjuntos = tuple(
            AdjuntoOutbox(a.nombre, a.mime, clave_almacen=a.clave_almacen,
                          contenido_b64=_b64(a.contenido) if a.contenido else '')
            for a in s.correo.adjuntos
        )
        encolar_correo(
            self._outbox, self._planificador,
            tipo=s.tipo, destinatario=direccion, destinatario_cedula=cedula, asunto=s.correo.asunto,
            titulo=s.titulo, mensaje=s.mensaje, enlace=s.enlace, ref_id=s.ref_id, clave=s.clave,
            copia_a=s.correo.copia_a, adjuntos=adjuntos,
        )


def _b64(contenido: bytes) -> str:
    return base64.b64encode(contenido).decode('ascii')
