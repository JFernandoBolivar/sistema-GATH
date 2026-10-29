"""Difusión por permiso, correo en el outbox, deduplicación y bandeja propia (A2/A3, sin BD)."""
from datetime import datetime, timezone

import pytest

from apps.notificaciones.application.use_cases.gestionar_notificaciones import (
    conteo_no_leidas,
    listar_notificaciones,
    marcar_leida,
    marcar_todas_leidas,
)
from apps.notificaciones.application.use_cases.servicio_notificaciones import ServicioNotificaciones
from core.domain.exceptions import NotFoundError, ValidationError
from core.domain.notificaciones import AdjuntoCorreo, CorreoSolicitado, SolicitudNotificacion
from tests.unit.notificaciones.memoria import CacheMem, PlanificadorMem, RepoNotifMem, RepoOutboxMem, ResolutorMem

AHORA = datetime(2026, 10, 29, 12, 0, tzinfo=timezone.utc)


def montar(por_permiso=None, correos=None):
    repo, outbox, cache, plan = RepoNotifMem(), RepoOutboxMem(), CacheMem(), PlanificadorMem()
    servicio = ServicioNotificaciones(repo, outbox, ResolutorMem(por_permiso, correos), cache, plan)
    return servicio, repo, outbox, cache, plan


def test_difusion_por_permiso_crea_una_fila_por_cuenta_y_excluye_al_actor():
    servicio, repo, *_ = montar({'bienestar.habilitar_ventana': ['1', '2', '3']})
    creadas = servicio.notificar(SolicitudNotificacion(
        tipo='x.y', titulo='T', mensaje='M', permiso_destino='bienestar.habilitar_ventana', excluir_cedulas=('2',),
    ))
    assert creadas == 2
    assert {n.destinatario_cedula for n in repo.filas} == {'1', '3'}


def test_sin_destinatarios_no_falla_y_no_crea_nada():
    servicio, repo, *_ = montar({})
    assert servicio.notificar(SolicitudNotificacion(tipo='x', titulo='T', mensaje='M', permiso_destino='p.q')) == 0
    assert repo.filas == []


def test_la_misma_ocurrencia_no_se_duplica_pero_otra_clave_si():
    servicio, repo, *_ = montar()
    base = dict(tipo='autogestion.ventana_prorrogada', titulo='T', mensaje='M', cedula_destino='9', ref_id='abc')
    servicio.notificar(SolicitudNotificacion(**base, clave='2026-11-01'))
    servicio.notificar(SolicitudNotificacion(**base, clave='2026-11-01'))
    servicio.notificar(SolicitudNotificacion(**base, clave='2026-11-05'))
    assert len(repo.filas) == 2


def test_con_correo_escribe_el_outbox_y_programa_el_envio_una_sola_vez():
    servicio, repo, outbox, _, plan = montar(correos={'9': 'trab@conatel.gob.ve'})
    s = SolicitudNotificacion(
        tipo='autogestion.solicitud_rechazada', titulo='T', mensaje='M', cedula_destino='9', ref_id='abc',
        correo=CorreoSolicitado('Asunto', adjuntos=(AdjuntoCorreo('c.pdf', contenido=b'%PDF'),), copia_a=('alt@x.com',)),
    )
    servicio.notificar(s)
    servicio.notificar(s)  # reintento del mismo evento
    assert len(outbox.filas) == 1 and len(plan.programados) == 1
    msg = next(iter(outbox.filas.values()))
    assert msg.destinatario == 'trab@conatel.gob.ve' and msg.copia_a == ('alt@x.com',)
    assert msg.adjuntos[0].contenido_b64 and msg.idempotency_key.endswith(':trab@conatel.gob.ve:EMAIL')


def test_sin_correo_la_notificacion_en_el_sistema_si_se_crea():
    servicio, repo, outbox, *_ = montar()
    servicio.notificar(SolicitudNotificacion(
        tipo='t', titulo='T', mensaje='M', cedula_destino='9', ref_id='1', correo=CorreoSolicitado('A'),
    ))
    assert len(repo.filas) == 1 and outbox.filas == {}


def test_notificar_invalida_la_cache_del_contador():
    servicio, _, _, cache, _ = montar()
    cache.guardar('9', 0)
    servicio.notificar(SolicitudNotificacion(tipo='t', titulo='T', mensaje='M', cedula_destino='9'))
    assert cache.obtener('9') is None


@pytest.mark.parametrize('kwargs', [
    dict(),                                                      # ni cédula ni permiso
    dict(cedula_destino='1', permiso_destino='a.b'),             # ambos
    dict(cedula_destino='1', enlace='https://malo.com'),         # enlace externo
    dict(cedula_destino='1', enlace='//malo.com'),
    dict(permiso_destino='a.b', correo=CorreoSolicitado('A')),   # correo a un grupo
])
def test_solicitud_invalida_se_rechaza(kwargs):
    with pytest.raises(ValidationError):
        SolicitudNotificacion(tipo='t', titulo='T', mensaje='M', **kwargs)


def test_adjunto_exige_contenido_o_clave_pero_no_ambos():
    with pytest.raises(ValidationError):
        AdjuntoCorreo('a.pdf')
    with pytest.raises(ValidationError):
        AdjuntoCorreo('a.pdf', contenido=b'x', clave_almacen='k')


def test_bandeja_es_propia_cuenta_y_marca_leidas_con_cache():
    servicio, repo, _, cache, _ = montar()
    for ref in ('1', '2', '3'):
        servicio.notificar(SolicitudNotificacion(tipo='t', titulo='T', mensaje='M', cedula_destino='9', ref_id=ref))
    servicio.notificar(SolicitudNotificacion(tipo='t', titulo='T', mensaje='M', cedula_destino='8', ref_id='1'))
    assert conteo_no_leidas(repo, cache, '9') == 3
    assert conteo_no_leidas(repo, cache, '9') == 3 and repo.consultas == 1  # segunda lectura: caché
    marcar_leida(repo, cache, '9', repo.filas[0].id, AHORA)
    assert conteo_no_leidas(repo, cache, '9') == 2
    _, total, limite, _ = listar_notificaciones(repo, '9', solo_no_leidas=True, limite=500)
    assert total == 2 and limite == 100
    assert marcar_todas_leidas(repo, cache, '9', AHORA) == 2 and conteo_no_leidas(repo, cache, '9') == 0


def test_zero_idor_una_notificacion_ajena_es_inexistente():
    servicio, repo, _, cache, _ = montar()
    servicio.notificar(SolicitudNotificacion(tipo='t', titulo='T', mensaje='M', cedula_destino='8', ref_id='1'))
    with pytest.raises(NotFoundError):
        marcar_leida(repo, cache, '9', repo.filas[0].id, AHORA)
    assert not repo.filas[0].leida
