"""E5: la purga respeta la retención y nunca toca auditoría ni constancias."""
from datetime import timedelta

import pytest
from django.utils import timezone

from apps.autogestion.infrastructure.models.actualizacion_models import SoporteDocumentalModel
from apps.configuracion.infrastructure.tasks import retencion_tasks
from apps.fe_de_vida.infrastructure.models.proceso_models import ProcesoFeDeVidaModel
from apps.fe_de_vida.infrastructure.models.solicitud_models import (
    ConstanciaFeDeVidaModel,
    SolicitudFeDeVidaModel,
)
from apps.notificaciones.infrastructure.models.notificacion_model import NotificacionModel
from apps.notificaciones.infrastructure.models.outbox_model import EventoOutboxModel
from core.infrastructure.models.auditoria import AuditoriaLog

pytestmark = pytest.mark.django_db


class AlmacenFalso:
    def __init__(self):
        self.eliminados = []

    def eliminar(self, clave):
        self.eliminados.append(clave)


def _hace(dias):
    return timezone.now() - timedelta(days=dias)


def _proceso(nombre):
    ahora = timezone.now()
    return ProcesoFeDeVidaModel.objects.create(
        nombre=nombre, fecha_apertura=ahora, fecha_cierre=ahora + timedelta(days=30),
    )


def test_purga_respeta_retencion_y_no_toca_auditoria_ni_constancias(monkeypatch):
    almacen = AlmacenFalso()
    monkeypatch.setattr(retencion_tasks, 'SeaweedFSStorage', lambda: almacen)

    proceso = _proceso('Proceso retención')
    vieja = SolicitudFeDeVidaModel.objects.create(
        proceso=proceso, cedula='V-1', evidencia_clave='evidencias/vieja.jpg',
        evidencias_previas=['evidencias/previa.jpg'], metadatos_captura={'ip': 'x'},
    )
    nueva = SolicitudFeDeVidaModel.objects.create(
        proceso=proceso, cedula='V-2', evidencia_clave='evidencias/nueva.jpg',
    )
    constancia = ConstanciaFeDeVidaModel.objects.create(
        solicitud=vieja, numero='FV-2026-000001', codigo_verificacion='codigo-1',
    )
    SolicitudFeDeVidaModel.objects.filter(pk=vieja.pk).update(created_at=_hace(400))

    soporte_viejo = SoporteDocumentalModel.objects.create(
        origen_tipo='AUTOGESTION', origen_id=vieja.pk, seccion='datos', tipo='OTRO',
        clave_s3='soportes/viejo.pdf', mime_real='application/pdf', tamano_bytes=10,
        sha256='a' * 64, subido_por='V-1',
    )
    soporte_nuevo = SoporteDocumentalModel.objects.create(
        origen_tipo='AUTOGESTION', origen_id=nueva.pk, seccion='datos', tipo='OTRO',
        clave_s3='soportes/nuevo.pdf', mime_real='application/pdf', tamano_bytes=10,
        sha256='b' * 64, subido_por='V-2',
    )
    SoporteDocumentalModel.objects.filter(pk=soporte_viejo.pk).update(created_at=_hace(400))

    notif_leida = NotificacionModel.objects.create(
        destinatario_cedula='V-1', tipo='aviso', titulo='Vieja', mensaje='x', leida=True,
    )
    notif_sin_leer = NotificacionModel.objects.create(
        destinatario_cedula='V-1', tipo='aviso', titulo='Nueva', mensaje='x', leida=False,
    )
    NotificacionModel.objects.filter(pk=notif_leida.pk).update(created_at=_hace(400))

    outbox_viejo = EventoOutboxModel.objects.create(
        tipo='aviso', destinatario='a@ejemplo.com', idempotency_key='k-viejo',
        estado=EventoOutboxModel.Estado.ENVIADO,
        payload={'adjuntos': [{'nombre': 'a.pdf', 'clave_almacen': 'adjuntos/viejo.pdf'}]},
    )
    outbox_nuevo = EventoOutboxModel.objects.create(
        tipo='aviso', destinatario='b@ejemplo.com', idempotency_key='k-nuevo',
        estado=EventoOutboxModel.Estado.PENDIENTE,
    )
    EventoOutboxModel.objects.filter(pk=outbox_viejo.pk).update(created_at=_hace(400))

    auditoria_antes = AuditoriaLog.objects.count()

    resultado = retencion_tasks.purgar_retencion()

    assert resultado == {'evidencias': 1, 'soportes': 1, 'notificaciones': 1, 'outbox': 1}
    assert set(almacen.eliminados) == {
        'evidencias/vieja.jpg', 'evidencias/previa.jpg',
        'soportes/viejo.pdf', 'adjuntos/viejo.pdf',
    }
    vieja.refresh_from_db()
    nueva.refresh_from_db()
    assert vieja.evidencia_clave == '' and vieja.evidencias_previas == []
    assert nueva.evidencia_clave == 'evidencias/nueva.jpg'
    assert not SoporteDocumentalModel.objects.filter(pk=soporte_viejo.pk).exists()
    assert SoporteDocumentalModel.objects.filter(pk=soporte_nuevo.pk).exists()
    assert not NotificacionModel.objects.filter(pk=notif_leida.pk).exists()
    assert NotificacionModel.objects.filter(pk=notif_sin_leer.pk).exists()
    assert not EventoOutboxModel.objects.filter(pk=outbox_viejo.pk).exists()
    assert EventoOutboxModel.objects.filter(pk=outbox_nuevo.pk).exists()
    assert ConstanciaFeDeVidaModel.objects.filter(pk=constancia.pk).exists()
    assert AuditoriaLog.objects.count() == auditoria_antes + 1
    assert AuditoriaLog.objects.order_by('-fecha_hora').first().accion == 'configuracion.retencion_aplicada'
