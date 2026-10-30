from apps.notificaciones.domain.entities.mensaje_outbox import AdjuntoOutbox, MensajeOutbox
from apps.notificaciones.domain.entities.notificacion import Notificacion
from apps.notificaciones.domain.value_objects.estado_outbox import Canal, EstadoOutbox
from apps.notificaciones.infrastructure.models.notificacion_model import NotificacionModel
from apps.notificaciones.infrastructure.models.outbox_model import EventoOutboxModel


def notificacion_a_entidad(m: NotificacionModel) -> Notificacion:
    return Notificacion(
        id=str(m.pk), destinatario_cedula=m.destinatario_cedula, tipo=m.tipo, titulo=m.titulo, mensaje=m.mensaje,
        enlace=m.enlace, ref_tipo=m.ref_tipo, ref_id=m.ref_id, leida=m.leida, fecha_lectura=m.fecha_lectura,
        creada_en=m.created_at, clave_unica=m.clave_unica or '', modulo=m.modulo,
    )


def outbox_a_entidad(m: EventoOutboxModel) -> MensajeOutbox:
    p = m.payload or {}
    return MensajeOutbox(
        id=str(m.pk), tipo=m.tipo, canal=Canal(m.canal), destinatario=m.destinatario,
        destinatario_cedula=m.destinatario_cedula, asunto=p.get('asunto', ''), titulo=p.get('titulo', ''),
        mensaje=p.get('mensaje', ''), enlace=p.get('enlace', ''), idempotency_key=m.idempotency_key,
        copia_a=tuple(p.get('copia_a', [])),
        adjuntos=tuple(
            AdjuntoOutbox(a['nombre'], a['mime'], a.get('clave_almacen', ''), a.get('contenido_b64', ''))
            for a in p.get('adjuntos', [])
        ),
        estado=EstadoOutbox(m.estado), intentos=m.intentos, proximo_intento=m.proximo_intento,
        ultimo_error=m.ultimo_error, enviado_en=m.enviado_en,
    )


def outbox_a_payload(msg: MensajeOutbox) -> dict:
    return {
        'asunto': msg.asunto, 'titulo': msg.titulo, 'mensaje': msg.mensaje, 'enlace': msg.enlace,
        'copia_a': list(msg.copia_a),
        'adjuntos': [
            {'nombre': a.nombre, 'mime': a.mime, 'clave_almacen': a.clave_almacen, 'contenido_b64': a.contenido_b64}
            for a in msg.adjuntos
        ],
    }
