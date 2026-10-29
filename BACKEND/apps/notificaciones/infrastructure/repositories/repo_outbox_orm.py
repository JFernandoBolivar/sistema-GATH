from django.db import IntegrityError, transaction

from apps.notificaciones.domain.entities.mensaje_outbox import MensajeOutbox
from apps.notificaciones.infrastructure.mappers.mapper_notificaciones import outbox_a_entidad, outbox_a_payload
from apps.notificaciones.infrastructure.models.outbox_model import EventoOutboxModel

PENDIENTE = EventoOutboxModel.Estado.PENDIENTE


class RepoOutboxORM:
    def agregar(self, mensaje: MensajeOutbox):
        if EventoOutboxModel.objects.filter(idempotency_key=mensaje.idempotency_key).exists():
            return None
        try:
            with transaction.atomic():  # savepoint: un choque concurrente no aborta la transacción del negocio
                m = EventoOutboxModel.objects.create(
                    id=mensaje.id, tipo=mensaje.tipo, canal=mensaje.canal.value, destinatario=mensaje.destinatario,
                    destinatario_cedula=mensaje.destinatario_cedula, payload=outbox_a_payload(mensaje),
                    idempotency_key=mensaje.idempotency_key, estado=PENDIENTE,
                )
        except IntegrityError:
            return None
        return outbox_a_entidad(m)

    def obtener_bloqueado(self, outbox_id: str):
        try:
            m = EventoOutboxModel.objects.select_for_update(skip_locked=True).filter(pk=outbox_id).first()
        except (ValueError, TypeError):
            return None
        return outbox_a_entidad(m) if m else None

    def marcar_enviado(self, outbox_id, ahora) -> None:
        EventoOutboxModel.objects.filter(pk=outbox_id).update(
            estado=EventoOutboxModel.Estado.ENVIADO, enviado_en=ahora, proximo_intento=None, ultimo_error='',
        )

    def registrar_fallo(self, outbox_id, intentos, estado, proximo_intento, error) -> None:
        EventoOutboxModel.objects.filter(pk=outbox_id).update(
            intentos=intentos, estado=estado.value, proximo_intento=proximo_intento, ultimo_error=error,
        )

    def ids_pendientes_vencidos(self, ahora, limite) -> list[str]:
        qs = EventoOutboxModel.objects.filter(estado=PENDIENTE).filter(
            proximo_intento__lte=ahora,
        ) | EventoOutboxModel.objects.filter(estado=PENDIENTE, proximo_intento__isnull=True, created_at__lte=ahora)
        return [str(i) for i in qs.order_by('created_at').values_list('pk', flat=True)[:limite]]
