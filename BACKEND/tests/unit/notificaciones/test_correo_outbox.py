"""Outbox de correo: envío, reintentos con backoff, FALLIDO, idempotencia, adjuntos y reproceso (A3)."""
import base64
from datetime import datetime, timedelta, timezone

from apps.notificaciones.application.use_cases.correo_outbox import (
    encolar_correo,
    enviar_correo,
    reprocesar_pendientes,
)
from apps.notificaciones.domain.entities.mensaje_outbox import AdjuntoOutbox
from apps.notificaciones.domain.services.plantilla_correo import render_correo
from apps.notificaciones.domain.services.politica_reintento import segundos_hasta_reintento
from apps.notificaciones.domain.value_objects.estado_outbox import EstadoOutbox
from tests.unit.notificaciones.memoria import AlmacenMem, EnviadorMem, PlanificadorMem, RepoOutboxMem

T0 = datetime(2026, 10, 29, 12, 0, tzinfo=timezone.utc)


def encolado(repo, adjuntos=()):
    plan = PlanificadorMem()
    encolar_correo(
        repo, plan, tipo='t', destinatario='a@b.com', destinatario_cedula='1', asunto='Asunto', titulo='Titulo',
        mensaje='Hola\nSegunda línea', enlace='/autogestion/solicitudes/1', ref_id='r1', adjuntos=adjuntos,
    )
    return (plan.programados[0] if plan.programados else None), plan


def test_envia_una_vez_y_el_reenvio_del_mismo_id_se_omite():
    repo, enviador = RepoOutboxMem(), EnviadorMem()
    oid, _ = encolado(repo)
    r1 = enviar_correo(repo, enviador, AlmacenMem(), oid, T0, url_base='https://gath.conatel.gob.ve')
    r2 = enviar_correo(repo, enviador, AlmacenMem(), oid, T0)
    assert (r1.estado, r2.estado) == ('ENVIADO', 'OMITIDO') and len(enviador.enviados) == 1
    assert 'https://gath.conatel.gob.ve/autogestion/solicitudes/1' in enviador.enviados[0]['texto']
    assert repo.filas[oid].estado is EstadoOutbox.ENVIADO


def test_encolar_dos_veces_el_mismo_hecho_no_duplica():
    repo = RepoOutboxMem()
    encolado(repo)
    _, plan = encolado(repo)
    assert len(repo.filas) == 1 and plan.programados == []


def test_fallo_reintenta_con_backoff_exponencial_y_luego_envia():
    repo, enviador = RepoOutboxMem(), EnviadorMem(fallos=2)
    oid, _ = encolado(repo)
    r1 = enviar_correo(repo, enviador, AlmacenMem(), oid, T0, backoff_base=60)
    assert (r1.estado, r1.reintentar_en) == ('REINTENTAR', 60) and repo.filas[oid].intentos == 1
    assert enviar_correo(repo, enviador, AlmacenMem(), oid, T0 + timedelta(seconds=10)).estado == 'OMITIDO'  # aún no vence
    r2 = enviar_correo(repo, enviador, AlmacenMem(), oid, T0 + timedelta(seconds=61), backoff_base=60)
    assert (r2.estado, r2.reintentar_en) == ('REINTENTAR', 120)
    r3 = enviar_correo(repo, enviador, AlmacenMem(), oid, T0 + timedelta(seconds=200))
    assert r3.estado == 'ENVIADO' and repo.filas[oid].estado is EstadoOutbox.ENVIADO


def test_agotados_los_intentos_queda_fallido_con_el_ultimo_error():
    repo, enviador = RepoOutboxMem(), EnviadorMem(fallos=99)
    oid, _ = encolado(repo)
    ahora = T0
    for _ in range(3):
        r = enviar_correo(repo, enviador, AlmacenMem(), oid, ahora, max_intentos=3, backoff_base=1)
        ahora += timedelta(hours=1)
    assert r.estado == 'FALLIDO'
    assert repo.filas[oid].estado is EstadoOutbox.FALLIDO and 'relay no disponible' in repo.filas[oid].ultimo_error
    assert enviar_correo(repo, enviador, AlmacenMem(), oid, ahora).estado == 'OMITIDO'  # un FALLIDO no se reenvía solo


def test_adjuntos_en_bytes_y_por_clave_de_almacen_llegan_al_enviador():
    repo, enviador = RepoOutboxMem(), EnviadorMem()
    adjuntos = (
        AdjuntoOutbox('en_linea.pdf', 'application/pdf', contenido_b64=base64.b64encode(b'AAA').decode()),
        AdjuntoOutbox('constancia.pdf', 'application/pdf', clave_almacen='fe-de-vida/c1.pdf'),
    )
    oid, _ = encolado(repo, adjuntos)
    enviar_correo(repo, enviador, AlmacenMem({'fe-de-vida/c1.pdf': b'BBB'}), oid, T0)
    assert enviador.enviados[0]['adjuntos'] == [
        ('en_linea.pdf', b'AAA', 'application/pdf'), ('constancia.pdf', b'BBB', 'application/pdf'),
    ]


def test_adjunto_inaccesible_cuenta_como_intento_fallido():
    repo, enviador = RepoOutboxMem(), EnviadorMem()
    oid, _ = encolado(repo, (AdjuntoOutbox('x.pdf', 'application/pdf', clave_almacen='no/existe'),))
    assert enviar_correo(repo, enviador, AlmacenMem(), oid, T0).estado == 'REINTENTAR'
    assert enviador.enviados == []


def test_reproceso_solo_toma_pendientes_vencidos_con_gracia():
    repo = RepoOutboxMem()
    oid, _ = encolado(repo)
    plan = PlanificadorMem()
    assert reprocesar_pendientes(repo, plan, T0 + timedelta(minutes=10)) == 1 and plan.programados == [oid]
    enviar_correo(repo, EnviadorMem(), AlmacenMem(), oid, T0)
    assert reprocesar_pendientes(repo, PlanificadorMem(), T0 + timedelta(minutes=10)) == 0


def test_backoff_exponencial_con_tope():
    assert [segundos_hasta_reintento(n) for n in (1, 2, 3, 4)] == [60, 120, 240, 480]
    assert segundos_hasta_reintento(20) == 3600


def test_plantilla_en_espanol_con_aviso_automatico_y_escapa_html():
    texto, html = render_correo('Título <b>', 'Línea 1\nLínea 2 & más', 'https://x.test/a?b=1&c=2')
    assert 'correo automático' in texto and 'correo automático' in html
    assert '<b>' not in html.split('<h2')[1].split('</h2>')[0] and '&amp;' in html
    assert 'https://x.test/a?b=1&amp;c=2' in html
