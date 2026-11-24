"""Dirección General (E-6) por la API, contra la BD: bandeja, detalle, aprobar, rechazar, avisos y descargas."""
import pytest
from rest_framework.test import APIClient

from apps.postulacion.infrastructure.models.expediente_models import ExpedientePostulacionModel, TransicionExpedienteModel
from apps.postulacion.infrastructure.models.presupuesto_models import PuntoCuentaIngresoModel, ReservaPuestoModel
from core.infrastructure.models.auditoria import AuditoriaLog
from tests.integration.postulacion._presupuesto_mundo import (
    BASE,
    DIRECCION,
    PRESUPUESTO,
    Almacen,
    Notificador,
    cliente,
    codigo,
    crear_expediente,
    datos,
    instalar_dobles,
    listo_para_dg,
    transicion_direccion,
)

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def dobles(monkeypatch):
    instalar_dobles(monkeypatch)


@pytest.fixture
def direccion():
    return cliente(*DIRECCION, cedula='30000001', nombre='Director General')


@pytest.fixture
def en_dg(mundo):
    """Un expediente EN_DIRECCION_GENERAL con su Punto de Cuenta emitido por Presupuesto."""
    exp = crear_expediente(mundo)
    listo_para_dg(mundo, exp)
    Notificador.emitidas.clear(), Notificador.resueltas.clear()
    return exp


def ids(r):
    return [f['id'] for f in datos(r)['resultados']]


# ------------------------------------------------------------------------------------------------ bandeja
def test_bandeja_muestra_pendientes_primero_y_el_historico_decidido_aunque_el_expediente_haya_avanzado(mundo, direccion):
    pendiente = crear_expediente(mundo, '10000001')
    listo_para_dg(mundo, pendiente, 'p1')
    aprobado = crear_expediente(mundo, '10000002')
    listo_para_dg(mundo, aprobado, 'p2')
    transicion_direccion(direccion, aprobado, 'APROBADO')
    rechazado = crear_expediente(mundo, '10000003')
    listo_para_dg(mundo, rechazado, 'p3')
    transicion_direccion(direccion, rechazado, 'RECHAZADO_DIRECCION', 'No hay plaza')
    # el aprobado sigue su camino (Captación reabrió la Ventana 2): el histórico lo conserva por su Punto de Cuenta
    ExpedientePostulacionModel.objects.filter(pk=aprobado).update(estado='CONSOLIDANDO')
    # uno que nunca llegó a Dirección General, y uno de Presupuesto sin Punto de Cuenta
    crear_expediente(mundo, '10000004', estado='ENVIADO_CAPTACION')
    crear_expediente(mundo, '10000005')

    r = direccion.get(f'{BASE}/ingresos/')
    assert r.status_code == 200, r.content
    assert ids(r)[0] == pendiente and set(ids(r)) == {pendiente, aprobado, rechazado} and datos(r)['total'] == 3
    assert datos(r)['resultados'][0]['pendiente'] is True and datos(r)['resultados'][0]['punto_cuenta']['estado'] == 'EMITIDO'
    assert ids(direccion.get(f'{BASE}/ingresos/', {'vista': 'pendientes'})) == [pendiente]
    historico = direccion.get(f'{BASE}/ingresos/', {'vista': 'historico'})
    assert set(ids(historico)) == {aprobado, rechazado}
    assert {f['punto_cuenta']['estado'] for f in datos(historico)['resultados']} == {'FIRMADO', 'RECHAZADO'}
    assert ids(direccion.get(f'{BASE}/ingresos/', {'estado': 'RECHAZADO_DIRECCION'})) == [rechazado]
    assert ids(direccion.get(f'{BASE}/ingresos/', {'q': '10000001'})) == [pendiente]


def test_bandeja_valida_vista_estado_permiso_y_pagina(mundo, direccion):
    for n, p in (('10000001', 'p1'), ('10000002', 'p2')):
        listo_para_dg(mundo, crear_expediente(mundo, n), p)
    assert direccion.get(f'{BASE}/ingresos/', {'vista': 'otra'}).status_code == 400
    assert direccion.get(f'{BASE}/ingresos/', {'estado': 'EN_PRESUPUESTO'}).status_code == 400
    r = direccion.get(f'{BASE}/ingresos/', {'page_size': 1, 'pagina': 2})
    assert datos(r)['total'] == 2 and datos(r)['total_paginas'] == 2 and len(datos(r)['resultados']) == 1
    assert cliente('postulacion.ver_solicitudes').get(f'{BASE}/ingresos/').status_code == 403
    assert cliente('postulacion.aprobar_ingreso').get(f'{BASE}/ingresos/').status_code == 403
    assert APIClient().get(f'{BASE}/ingresos/').status_code in (401, 403)


# ------------------------------------------------------------------------------------------------ detalle
def test_detalle_trae_postulante_cargo_constancia_punto_de_cuenta_historial_y_acciones(mundo, en_dg, direccion):
    d = datos(direccion.get(f'{BASE}/ingresos/{en_dg}/'))
    assert d['postulante']['cedula'] == '12345678' and 'correo' not in d['postulante'] and 'datos_ventana1' not in d
    assert d['puesto']['codigo'] == 'A-001' and d['puesto']['cargo']['nombre'] == 'ANALISTA'
    assert d['puesto']['direccion_general']['nombre'] == 'GESTION HUMANA'
    assert d['constancia']['referencia'] == 'PART-2026-045' and d['constancia']['declarado_por_nombre'] == 'María Gómez'
    assert d['punto_cuenta']['estado'] == 'EMITIDO' and d['punto_cuenta']['numero']
    assert d['documentos']['punto_cuenta'] == f'{BASE}/ingresos/{en_dg}/punto-cuenta/'
    assert d['historial'][-1]['estado_destino'] == 'EN_DIRECCION_GENERAL'
    acciones = {a['destino']: a for a in d['acciones']}
    assert set(acciones) == {'APROBADO', 'RECHAZADO_DIRECCION'}
    assert acciones['RECHAZADO_DIRECCION']['requiere_motivo'] and not acciones['APROBADO']['requiere_motivo']
    assert not acciones['APROBADO']['bloqueada']
    solo_ver = datos(cliente('postulacion.ver_ingresos').get(f'{BASE}/ingresos/{en_dg}/'))
    assert solo_ver['acciones'] == []


def test_detalle_solo_de_lo_que_llego_a_direccion_general(mundo, direccion):
    en_presupuesto = crear_expediente(mundo)
    assert direccion.get(f'{BASE}/ingresos/{en_presupuesto}/').status_code == 404
    assert direccion.get(f'{BASE}/ingresos/00000000-0000-4000-8000-000000000000/').status_code == 404
    assert cliente('postulacion.ver_solicitudes').get(f'{BASE}/ingresos/{en_presupuesto}/').status_code == 403


# ------------------------------------------------------------------------------------------------ aprobar
def test_aprobar_marca_el_punto_de_cuenta_firmado_conserva_la_reserva_y_avisa_a_captacion(
    mundo, en_dg, direccion, django_capture_on_commit_callbacks,
):
    antes = ExpedientePostulacionModel.objects.get(pk=en_dg).reserva_vence_el
    with django_capture_on_commit_callbacks(execute=True):
        r = transicion_direccion(direccion, en_dg, 'APROBADO')
    assert r.status_code == 200, r.content
    assert datos(r)['expediente']['estado'] == 'APROBADO' and datos(r)['punto_cuenta']['estado'] == 'FIRMADO'
    pc = PuntoCuentaIngresoModel.objects.get()
    assert (pc.estado, pc.decidido_por) == ('FIRMADO', '30000001') and pc.decidido_el
    reserva = ReservaPuestoModel.objects.get()
    assert reserva.estado == 'ACTIVA' and ExpedientePostulacionModel.objects.get(pk=en_dg).reserva_vence_el == antes
    asiento = TransicionExpedienteModel.objects.filter(expediente_id=en_dg).latest('fecha')
    assert (asiento.estado_destino, asiento.actor_cedula) == ('APROBADO', '30000001')
    assert Notificador.resueltas == [('expediente_postulacion', en_dg, '30000001', 'EXPEDIENTE_EN_DIRECCION')]
    (aviso,) = Notificador.emitidas
    assert aviso.tipo == 'INGRESO_APROBADO' and aviso.permiso_destino == 'postulacion.ver_bandeja'
    assert aviso.enlace == f'/captacion/expedientes/{en_dg}' and 'Ana María Pérez' in aviso.mensaje
    assert AuditoriaLog.objects.get(accion='INGRESO_TRANSICION').estado_nuevo['destino'] == 'APROBADO'
    # ya no hay acciones y no se puede decidir dos veces
    assert datos(direccion.get(f'{BASE}/ingresos/{en_dg}/'))['acciones'] == []
    r = transicion_direccion(direccion, en_dg, 'RECHAZADO_DIRECCION', 'x')
    assert r.status_code == 409 and codigo(r) == 'TRANSICION_NO_PERMITIDA'


def test_el_aviso_de_ingreso_aprobado_se_resuelve_cuando_captacion_reabre_la_ventana_2(
    mundo, en_dg, direccion, django_capture_on_commit_callbacks,
):
    transicion_direccion(direccion, en_dg, 'APROBADO')
    Notificador.emitidas.clear(), Notificador.resueltas.clear()
    captacion = cliente('postulacion.ver_bandeja', 'postulacion.revision_final', cedula='20000009')
    with django_capture_on_commit_callbacks(execute=True):
        r = captacion.post(f'{BASE}/expedientes/{en_dg}/transicion/', {'destino': 'CONSOLIDANDO'}, format='json')
    assert r.status_code == 200, r.content
    assert ('expediente_postulacion', en_dg, '20000009', 'INGRESO_APROBADO') in Notificador.resueltas


# ------------------------------------------------------------------------------------------------ rechazar
def test_rechazar_exige_motivo_libera_la_reserva_y_marca_el_punto_de_cuenta_rechazado(mundo, en_dg, direccion):
    r = transicion_direccion(direccion, en_dg, 'RECHAZADO_DIRECCION')
    assert r.status_code == 400 and codigo(r) == 'MOTIVO_OBLIGATORIO'
    assert ReservaPuestoModel.objects.get().estado == 'ACTIVA' and PuntoCuentaIngresoModel.objects.get().estado == 'EMITIDO'
    r = transicion_direccion(direccion, en_dg, 'RECHAZADO_DIRECCION', 'No hay plaza aprobada')
    assert r.status_code == 200, r.content
    e = ExpedientePostulacionModel.objects.get(pk=en_dg)
    assert e.estado == 'RECHAZADO_DIRECCION' and e.reserva_vence_el is None and e.fecha_cierre is not None
    reserva = ReservaPuestoModel.objects.get()
    assert (reserva.estado, reserva.motivo_liberacion) == ('LIBERADA', 'rechazo de Dirección General')
    pc = PuntoCuentaIngresoModel.objects.get()
    assert (pc.estado, pc.decidido_por) == ('RECHAZADO', '30000001')
    assert datos(r)['punto_cuenta']['estado'] == 'RECHAZADO' and datos(r)['acciones'] == []
    # el puesto queda libre para otro expediente
    otro = crear_expediente(mundo, '87654321')
    r = cliente(*PRESUPUESTO).post(f'{BASE}/solicitudes/{otro}/reserva/', {'puesto_id': mundo['p1'].pk}, format='json')
    assert r.status_code == 200


# ------------------------------------------------------------------------------------------------ ilegales y permisos
def test_transiciones_ilegales_sin_permiso_y_expediente_final(mundo, en_dg, direccion):
    for destino in ('EN_PRESUPUESTO', 'CONSOLIDANDO', 'CONTRATADO', 'DIFERIDO_PRESUPUESTO'):
        r = transicion_direccion(direccion, en_dg, destino)
        assert r.status_code == 409 and codigo(r) == 'TRANSICION_NO_PERMITIDA', destino
    assert codigo(transicion_direccion(direccion, en_dg, 'NO_EXISTE')) == 'DESTINO_INVALIDO'
    solo_ver = cliente('postulacion.ver_ingresos')
    assert transicion_direccion(solo_ver, en_dg, 'APROBADO').status_code == 403
    assert transicion_direccion(cliente(*PRESUPUESTO), en_dg, 'APROBADO').status_code == 403
    assert APIClient().post(f'{BASE}/ingresos/{en_dg}/transicion/', {'destino': 'APROBADO'}, format='json').status_code in (401, 403)
    assert transicion_direccion(direccion, '00000000-0000-4000-8000-000000000000', 'APROBADO').status_code == 404
    final = crear_expediente(mundo, '87654321', estado='RECHAZADO_DIRECCION')
    r = transicion_direccion(direccion, final, 'APROBADO')
    assert r.status_code == 409 and codigo(r) == 'EXPEDIENTE_FINAL'
    assert ExpedientePostulacionModel.objects.get(pk=en_dg).estado == 'EN_DIRECCION_GENERAL'


def test_sin_punto_de_cuenta_no_se_puede_decidir_y_nada_cambia(mundo, direccion):
    huerfano = crear_expediente(mundo, estado='EN_DIRECCION_GENERAL')
    r = transicion_direccion(direccion, huerfano, 'APROBADO')
    assert r.status_code == 404
    assert ExpedientePostulacionModel.objects.get(pk=huerfano).estado == 'EN_DIRECCION_GENERAL'


# ------------------------------------------------------------------------------------------------ descargas
def test_descarga_del_punto_de_cuenta_y_de_la_constancia_desde_direccion_general(mundo, en_dg, direccion):
    url = f'{BASE}/ingresos/{en_dg}/punto-cuenta/'
    r = direccion.get(url)
    assert r.status_code == 200 and r['Content-Disposition'].startswith('attachment; filename="punto-cuenta-')
    assert b''.join(r.streaming_content).startswith(b'%PDF')
    # esta constancia se declaró sin adjunto: no hay nada que descargar
    c = PuntoCuentaIngresoModel.objects.get()
    assert c.pdf_clave in Almacen.objetos
    constancia_url = f'{BASE}/ingresos/{en_dg}/constancia/adjunto/'
    assert direccion.get(constancia_url).status_code == 404
    assert cliente('postulacion.ver_solicitudes').get(url).status_code == 200  # también con ver_solicitudes
    assert cliente('postulacion.aprobar_ingreso').get(url).status_code == 403
    assert APIClient().get(url).status_code in (401, 403)
    presupuesto_sin_pc = crear_expediente(mundo, '87654321')
    assert direccion.get(f'{BASE}/ingresos/{presupuesto_sin_pc}/punto-cuenta/').status_code == 404


def test_descarga_del_adjunto_de_la_constancia_por_la_ruta_de_direccion(mundo, direccion):
    from django.core.files.uploadedfile import SimpleUploadedFile
    from tests.integration.postulacion._presupuesto_mundo import PDF, declarar, reservar, transicion_presupuesto
    exp = crear_expediente(mundo)
    presupuesto = cliente(*PRESUPUESTO)
    reservar(presupuesto, exp, mundo['p1'])
    declarar(presupuesto, exp, adjunto=SimpleUploadedFile('a.pdf', PDF, content_type='application/pdf'))
    transicion_presupuesto(presupuesto, exp, 'EN_DIRECCION_GENERAL')
    r = direccion.get(f'{BASE}/ingresos/{exp}/constancia/adjunto/')
    assert r.status_code == 200 and b''.join(r.streaming_content) == PDF
    assert r['Content-Disposition'].startswith('attachment; filename="constancia-presupuestaria-')
