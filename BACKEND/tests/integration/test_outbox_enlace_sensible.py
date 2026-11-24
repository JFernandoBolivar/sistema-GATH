"""El enlace con secreto (token) se retira del payload del outbox al enviar o al fallar definitivo, no en el reintento."""
from datetime import datetime, timezone

from apps.notificaciones.application.use_cases.correo_outbox import enviar_correo
from apps.notificaciones.domain.entities.mensaje_outbox import MensajeOutbox
from apps.notificaciones.domain.value_objects.estado_outbox import Canal, EstadoOutbox
from apps.notificaciones.infrastructure.models.outbox_model import EventoOutboxModel
from apps.notificaciones.infrastructure.repositories.repo_outbox_orm import RepoOutboxORM
from tests.unit.notificaciones.memoria import AlmacenMem, EnviadorMem

T0 = datetime(2026, 10, 29, 12, 0, tzinfo=timezone.utc)


def _fila(repo, *, sensible, clave='k'):
    return repo.agregar(MensajeOutbox(
        id='00000000-0000-0000-0000-000000000001' if sensible else '00000000-0000-0000-0000-000000000002',
        tipo='t', canal=Canal.EMAIL, destinatario='a@b.com', destinatario_cedula='', asunto='A', titulo='T',
        mensaje='M', enlace='/activar?t=SECRETO', idempotency_key=f'{clave}-{sensible}',
        texto_boton='Crear mi contraseña', enlace_sensible=sensible,
    )).id


def _enlace(oid):
    return EventoOutboxModel.objects.get(pk=oid).payload['enlace']


def test_al_enviar_se_retira_el_enlace_sensible(db):
    repo = RepoOutboxORM()
    oid = _fila(repo, sensible=True)
    assert _enlace(oid) == '/activar?t=SECRETO'
    r = enviar_correo(repo, EnviadorMem(), AlmacenMem(), oid, T0, url_base='https://gath')
    assert r.estado == 'ENVIADO' and _enlace(oid) == '[retirado]'
    assert EventoOutboxModel.objects.get(pk=oid).payload['texto_boton'] == 'Crear mi contraseña'


def test_en_reintento_se_conserva_y_al_fallar_definitivo_se_retira(db):
    repo, enviador = RepoOutboxORM(), EnviadorMem(fallos=99)
    oid = _fila(repo, sensible=True)
    assert enviar_correo(repo, enviador, AlmacenMem(), oid, T0, max_intentos=2).estado == 'REINTENTAR'
    assert _enlace(oid) == '/activar?t=SECRETO'
    fila = EventoOutboxModel.objects.get(pk=oid)
    r = enviar_correo(repo, enviador, AlmacenMem(), oid, fila.proximo_intento, max_intentos=2)
    assert r.estado == 'FALLIDO' and _enlace(oid) == '[retirado]'
    assert repo.obtener_bloqueado(oid).estado is EstadoOutbox.FALLIDO


def test_un_correo_no_sensible_conserva_su_enlace(db):
    repo = RepoOutboxORM()
    oid = _fila(repo, sensible=False)
    enviar_correo(repo, EnviadorMem(), AlmacenMem(), oid, T0, url_base='https://gath')
    assert _enlace(oid) == '/activar?t=SECRETO'
