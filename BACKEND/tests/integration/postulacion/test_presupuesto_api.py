"""Presupuesto (E-1 a E-5) por la API, contra la BD: vacantes, reserva, constancia, bandeja, transiciones y Punto de Cuenta."""
import threading
from datetime import timedelta

import pytest
from django.db import IntegrityError, connection, transaction
from django.utils import timezone
from rest_framework.test import APIClient

from apps.postulacion.infrastructure.models.expediente_models import ExpedientePostulacionModel, TransicionExpedienteModel
from apps.postulacion.infrastructure.models.presupuesto_models import (
    ConstanciaPresupuestariaModel,
    PuntoCuentaIngresoModel,
    ReservaPuestoModel,
)
from apps.puntocuenta.infrastructure.models.punto_cuenta_model import PuntoCuentaModel
from core.infrastructure.models.auditoria import AuditoriaLog
from tests.integration.postulacion._presupuesto_mundo import (
    BASE,
    PDF,
    PRESUPUESTO,
    Almacen,
    Notificador,
    ahora_mas,
    cliente,
    codigo,
    crear_expediente,
    crear_mundo,
    datos,
    declarar,
    instalar_dobles,
    listo_para_dg,
    reservar,
    transicion_presupuesto,
)

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def dobles(monkeypatch):
    instalar_dobles(monkeypatch)


@pytest.fixture
def presupuesto():
    return cliente(*PRESUPUESTO)


def codigos_de(r):
    return [p['codigo'] for p in datos(r)['resultados']]


# ------------------------------------------------------------------------------------------------ E-1 vacantes
def test_vacantes_usa_cargo_y_oficina_de_la_propuesta_y_excluye_ocupados_y_reservados_por_otro(mundo, presupuesto):
    mio, otro = crear_expediente(mundo), crear_expediente(mundo, '87654321')
    assert reservar(presupuesto, otro, mundo['p2']).status_code == 200
    r = presupuesto.get(f'{BASE}/solicitudes/{mio}/vacantes/')
    assert r.status_code == 200, r.content
    # ni el ocupado (A-OCU), ni el de otro cargo (C-001), ni el de otra oficina (A-LEG), ni el reservado por el otro (A-002)
    assert codigos_de(r) == ['A-001', 'A-003']
    assert datos(r)['total'] == 2 and datos(r)['filtros']['de_propuesta'] is True
    assert datos(r)['filtros']['cargo'] == mundo['analista'].pk and datos(r)['filtros']['oficina'] == mundo['dg'].pk
    primero = datos(r)['resultados'][0]
    assert primero['cargo']['nombre'] == 'ANALISTA' and primero['direccion_general']['nombre'] == 'GESTION HUMANA'
    assert primero['vacante'] is True and primero['reserva_propia'] is False and datos(r)['reserva'] is None


def test_vacantes_muestra_la_reserva_propia_y_deja_de_excluirla(mundo, presupuesto):
    exp = crear_expediente(mundo)
    reservar(presupuesto, exp, mundo['p2'])
    r = presupuesto.get(f'{BASE}/solicitudes/{exp}/vacantes/')
    assert codigos_de(r) == ['A-001', 'A-002', 'A-003']
    propias = [p['codigo'] for p in datos(r)['resultados'] if p['reserva_propia']]
    assert propias == ['A-002'] and datos(r)['reserva']['puesto_id'] == mundo['p2'].pk


def test_vacantes_con_filtros_explicitos_pagina_y_busqueda(mundo, presupuesto):
    exp = crear_expediente(mundo)
    r = presupuesto.get(f'{BASE}/solicitudes/{exp}/vacantes/', {'cargo': mundo['chofer'].pk})
    assert codigos_de(r) == ['C-001'] and datos(r)['filtros']['de_propuesta'] is False
    # `oficina` reemplaza TODA la oficina de la propuesta (y la jerarquía propuesta ya no filtra)
    r = presupuesto.get(f'{BASE}/solicitudes/{exp}/vacantes/', {'oficina': mundo['otra_dg'].pk})
    assert codigos_de(r) == ['A-LEG']
    r = presupuesto.get(f'{BASE}/solicitudes/{exp}/vacantes/', {'page_size': 2, 'pagina': 2})
    assert codigos_de(r) == ['A-003'] and datos(r)['total'] == 3 and datos(r)['total_paginas'] == 2
    r = presupuesto.get(f'{BASE}/solicitudes/{exp}/vacantes/', {'q': 'a-002'})
    assert codigos_de(r) == ['A-002']
    assert presupuesto.get(f'{BASE}/solicitudes/{exp}/vacantes/', {'cargo': 'abc'}).status_code == 400


def test_vacantes_sin_propuesta_en_ids_no_filtra_y_exige_permiso(mundo, presupuesto):
    exp = crear_expediente(mundo, con_propuesta=False)
    assert 'C-001' in codigos_de(presupuesto.get(f'{BASE}/solicitudes/{exp}/vacantes/'))
    assert cliente('postulacion.ver_solicitudes').get(f'{BASE}/solicitudes/{exp}/vacantes/').status_code == 403
    assert APIClient().get(f'{BASE}/solicitudes/{exp}/vacantes/').status_code in (401, 403)
    assert presupuesto.get(f'{BASE}/solicitudes/00000000-0000-4000-8000-000000000000/vacantes/').status_code == 404


# ------------------------------------------------------------------------------------------------ E-2 reserva
def test_reservar_crea_la_reserva_con_el_vencimiento_del_parametro_y_la_refleja_en_el_detalle(mundo, presupuesto):
    exp = crear_expediente(mundo)
    antes = timezone.now()
    r = reservar(presupuesto, exp, mundo['p1'])
    assert r.status_code == 200, r.content
    reserva = ReservaPuestoModel.objects.get()
    assert (reserva.estado, reserva.puesto_id, str(reserva.expediente_id), reserva.reservado_por) == (
        'ACTIVA', mundo['p1'].pk, exp, '20000001')
    assert antes + timedelta(days=30) - timedelta(minutes=1) < reserva.vence_el < timezone.now() + timedelta(days=30)
    d = datos(r)
    assert d['reserva']['puesto_id'] == mundo['p1'].pk and d['reserva']['vigente'] is True
    assert d['reserva']['puesto']['codigo'] == 'A-001' and d['puesto']['cargo']['nombre'] == 'ANALISTA'
    audit = AuditoriaLog.objects.get(accion='RESERVA_PUESTO')
    assert audit.recurso_id == exp and audit.estado_nuevo['puesto_id'] == mundo['p1'].pk


def test_cambiar_la_reserva_libera_la_anterior_y_reservar_el_mismo_puesto_no_cambia_nada(mundo, presupuesto):
    exp = crear_expediente(mundo)
    reservar(presupuesto, exp, mundo['p1'])
    primera = ReservaPuestoModel.objects.get()
    assert reservar(presupuesto, exp, mundo['p1']).status_code == 200
    assert ReservaPuestoModel.objects.count() == 1 and ReservaPuestoModel.objects.get().vence_el == primera.vence_el
    assert reservar(presupuesto, exp, mundo['p2']).status_code == 200
    anterior = ReservaPuestoModel.objects.get(pk=primera.pk)
    assert (anterior.estado, anterior.motivo_liberacion) == ('LIBERADA', 'cambio de puesto') and anterior.cerrada_el
    assert list(ReservaPuestoModel.objects.filter(estado='ACTIVA').values_list('puesto_id', flat=True)) == [mundo['p2'].pk]
    # el puesto liberado vuelve a estar disponible para otro expediente
    otro = crear_expediente(mundo, '87654321')
    assert reservar(presupuesto, otro, mundo['p1']).status_code == 200


def test_reservar_revalida_vacante_existencia_estado_y_otra_reserva(mundo, presupuesto):
    exp, otro = crear_expediente(mundo), crear_expediente(mundo, '87654321')
    r = reservar(presupuesto, exp, mundo['ocupado'])
    assert r.status_code == 409 and codigo(r) == 'PUESTO_NO_VACANTE'
    r = presupuesto.post(f'{BASE}/solicitudes/{exp}/reserva/', {'puesto_id': 999999}, format='json')
    assert r.status_code == 404 and codigo(r) == 'PUESTO_NO_ENCONTRADO'
    assert presupuesto.post(f'{BASE}/solicitudes/{exp}/reserva/', {}, format='json').status_code == 400
    assert reservar(presupuesto, otro, mundo['p1']).status_code == 200
    r = reservar(presupuesto, exp, mundo['p1'])
    assert r.status_code == 409 and codigo(r) == 'PUESTO_RESERVADO'
    assert not ReservaPuestoModel.objects.filter(expediente_id=exp).exists()
    diferido = crear_expediente(mundo, '11111111', estado='DIFERIDO_PRESUPUESTO')
    r = reservar(presupuesto, diferido, mundo['p3'])
    assert r.status_code == 409 and codigo(r) == 'EXPEDIENTE_NO_EN_PRESUPUESTO'


def test_liberar_la_reserva_a_mano(mundo, presupuesto):
    exp = crear_expediente(mundo)
    r = presupuesto.delete(f'{BASE}/solicitudes/{exp}/reserva/')
    assert r.status_code == 404 and codigo(r) == 'RESERVA_NO_ENCONTRADA'
    reservar(presupuesto, exp, mundo['p1'])
    r = presupuesto.delete(f'{BASE}/solicitudes/{exp}/reserva/', {'motivo': 'Se eligió otro puesto'}, format='json')
    assert r.status_code == 200 and datos(r)['reserva'] is None
    reserva = ReservaPuestoModel.objects.get()
    assert (reserva.estado, reserva.motivo_liberacion) == ('LIBERADA', 'Se eligió otro puesto')
    assert AuditoriaLog.objects.filter(accion='RESERVA_PUESTO_LIBERADA').exists()


def test_reservar_y_liberar_exigen_el_permiso(mundo):
    exp = crear_expediente(mundo)
    sin = cliente('postulacion.ver_solicitudes', 'postulacion.declarar_disponibilidad')
    assert reservar(sin, exp, mundo['p1']).status_code == 403
    assert sin.delete(f'{BASE}/solicitudes/{exp}/reserva/').status_code == 403
    assert not ReservaPuestoModel.objects.exists()


def test_el_constraint_impide_dos_reservas_activas_del_mismo_puesto_o_del_mismo_expediente(mundo):
    a, b = crear_expediente(mundo), crear_expediente(mundo, '87654321')
    vence = ahora_mas(days=30)
    base = dict(reservado_por='1', vence_el=vence)
    ReservaPuestoModel.objects.create(expediente_id=a, puesto_id=mundo['p1'].pk, **base)
    with pytest.raises(IntegrityError), transaction.atomic():
        ReservaPuestoModel.objects.create(expediente_id=b, puesto_id=mundo['p1'].pk, **base)
    with pytest.raises(IntegrityError), transaction.atomic():
        ReservaPuestoModel.objects.create(expediente_id=a, puesto_id=mundo['p2'].pk, **base)
    # una cerrada no estorba: el puesto y el expediente pueden volver a reservar
    ReservaPuestoModel.objects.filter(expediente_id=a).update(estado='LIBERADA')
    ReservaPuestoModel.objects.create(expediente_id=b, puesto_id=mundo['p1'].pk, **base)


@pytest.mark.django_db(transaction=True)
def test_reservar_en_concurrencia_dos_expedientes_al_mismo_puesto_solo_uno_gana(monkeypatch):
    mundo = crear_mundo()
    a, b = crear_expediente(mundo, '12345678'), crear_expediente(mundo, '87654321')
    barrera = threading.Barrier(2)
    resultados = {}

    def reservar_desde_hilo(nombre, exp):
        try:
            barrera.wait(timeout=10)
            resultados[nombre] = reservar(cliente(*PRESUPUESTO), exp, mundo['p1'])
        finally:
            connection.close()

    hilos = [threading.Thread(target=reservar_desde_hilo, args=(n, e)) for n, e in (('a', a), ('b', b))]
    for h in hilos:
        h.start()
    for h in hilos:
        h.join(timeout=30)
    estados = sorted(r.status_code for r in resultados.values())
    assert estados == [200, 409], estados
    perdedor = next(r for r in resultados.values() if r.status_code == 409)
    assert codigo(perdedor) == 'PUESTO_RESERVADO'
    assert ReservaPuestoModel.objects.filter(puesto_id=mundo['p1'].pk, estado='ACTIVA').count() == 1


# ------------------------------------------------------------------------------------------------ E-3 constancia
def test_declarar_disponibilidad_registra_quien_la_declara_y_guarda_el_adjunto_con_clave_opaca(mundo, presupuesto):
    from django.core.files.uploadedfile import SimpleUploadedFile
    exp = crear_expediente(mundo)
    r = declarar(
        presupuesto, exp, 'PART-4.01.01', observaciones='Con cargo al ejercicio 2026',
        adjunto=SimpleUploadedFile('oficio.pdf', PDF, content_type='application/pdf'),
    )
    assert r.status_code == 200, r.content
    c = ConstanciaPresupuestariaModel.objects.get()
    assert (c.declarado_por_cedula, c.declarado_por_nombre, c.referencia) == ('20000001', 'María Gómez', 'PART-4.01.01')
    assert c.adjunto_clave.startswith('postulacion/constancia/') and c.adjunto_clave.endswith('.pdf')
    assert '12345678' not in c.adjunto_clave and '20000001' not in c.adjunto_clave
    assert Almacen.objetos[c.adjunto_clave] == PDF and c.adjunto_tamano == len(PDF) and len(c.adjunto_sha256) == 64
    d = datos(r)
    assert d['constancia']['declarado_por_nombre'] == 'María Gómez' and d['constancia']['tiene_adjunto'] is True
    assert d['documentos']['constancia_adjunto'].endswith(f'/solicitudes/{exp}/constancia/adjunto/')
    assert AuditoriaLog.objects.get(accion='CONSTANCIA_PRESUPUESTARIA_DECLARADA').estado_nuevo['referencia'] == 'PART-4.01.01'


def test_corregir_la_constancia_reemplaza_el_adjunto_y_borra_el_anterior(mundo, presupuesto, django_capture_on_commit_callbacks):
    from django.core.files.uploadedfile import SimpleUploadedFile
    exp = crear_expediente(mundo)
    pdf = lambda: SimpleUploadedFile('a.pdf', PDF, content_type='application/pdf')  # noqa: E731
    declarar(presupuesto, exp, 'PART-1', adjunto=pdf())
    primera = ConstanciaPresupuestariaModel.objects.get().adjunto_clave
    with django_capture_on_commit_callbacks(execute=True):
        assert declarar(presupuesto, exp, 'PART-2', adjunto=pdf()).status_code == 200
    c = ConstanciaPresupuestariaModel.objects.get()
    assert c.referencia == 'PART-2' and c.adjunto_clave != primera and primera not in Almacen.objetos
    # sin adjunto nuevo se conserva el que había
    assert declarar(presupuesto, exp, 'PART-3').status_code == 200
    assert ConstanciaPresupuestariaModel.objects.get().adjunto_clave == c.adjunto_clave
    assert ConstanciaPresupuestariaModel.objects.count() == 1


def test_constancia_valida_referencia_adjunto_estado_y_permiso(mundo, presupuesto):
    from django.core.files.uploadedfile import SimpleUploadedFile
    exp = crear_expediente(mundo)
    assert presupuesto.post(f'{BASE}/solicitudes/{exp}/constancia/', {'observaciones': 'x'}, format='multipart').status_code == 400
    r = declarar(presupuesto, exp, adjunto=SimpleUploadedFile('a.pdf', b'no soy pdf', content_type='application/pdf'))
    assert r.status_code == 400 and not Almacen.objetos and not ConstanciaPresupuestariaModel.objects.exists()
    diferido = crear_expediente(mundo, '87654321', estado='DIFERIDO_PRESUPUESTO')
    r = declarar(presupuesto, diferido)
    assert r.status_code == 409 and codigo(r) == 'CONSTANCIA_NO_EDITABLE'
    assert declarar(cliente('postulacion.ver_solicitudes', 'postulacion.reservar_puesto'), exp).status_code == 403


def test_descarga_del_adjunto_de_la_constancia_como_adjunto_con_permiso(mundo, presupuesto):
    from django.core.files.uploadedfile import SimpleUploadedFile
    exp = crear_expediente(mundo)
    url = f'{BASE}/solicitudes/{exp}/constancia/adjunto/'
    assert presupuesto.get(url).status_code == 404  # aún no hay constancia
    declarar(presupuesto, exp, adjunto=SimpleUploadedFile('a.pdf', PDF, content_type='application/pdf'))
    r = presupuesto.get(url)
    assert r.status_code == 200 and r['Content-Type'] == 'application/pdf'
    assert r['Content-Disposition'].startswith('attachment;') and 'constancia-presupuestaria-EXP-' in r['Content-Disposition']
    assert b''.join(r.streaming_content) == PDF
    assert cliente('postulacion.ver_ingresos').get(url).status_code == 200  # Dirección General también la ve
    assert cliente('postulacion.registrar_psicofisico').get(url).status_code == 403
    assert APIClient().get(url).status_code in (401, 403)


# ------------------------------------------------------------------------------------------------ E-4 bandeja y detalle
def test_bandeja_de_presupuesto_muestra_pendientes_primero_en_presupuesto_y_no_los_de_captacion(mundo, presupuesto):
    diferido = crear_expediente(mundo, '10000001', estado='DIFERIDO_PRESUPUESTO')
    correccion = crear_expediente(mundo, '10000002', estado='EN_CORRECCION_CARGO')
    en_pres = crear_expediente(mundo, '10000003')
    crear_expediente(mundo, '10000004', estado='ENVIADO_CAPTACION')
    crear_expediente(mundo, '10000005', estado='EN_DIRECCION_GENERAL')
    r = presupuesto.get(f'{BASE}/solicitudes/')
    assert r.status_code == 200, r.content
    ids = [f['id'] for f in datos(r)['resultados']]
    assert ids[0] == en_pres and set(ids) == {diferido, correccion, en_pres}
    assert datos(r)['resultados'][0]['pendiente'] is True and datos(r)['total'] == 3
    todos = presupuesto.get(f'{BASE}/solicitudes/', {'vista': 'todos'})
    estados = {f['estado'] for f in datos(todos)['resultados']}
    assert 'EN_DIRECCION_GENERAL' in estados and 'ENVIADO_CAPTACION' not in estados and datos(todos)['total'] == 4


def test_bandeja_de_presupuesto_filtra_busca_pagina_y_valida(mundo, presupuesto):
    crear_expediente(mundo, '10000001', nombres='Zoila', apellidos='Quintero', estado='DIFERIDO_PRESUPUESTO')
    crear_expediente(mundo, '10000003', nombres='Ana', apellidos='Pérez')
    r = presupuesto.get(f'{BASE}/solicitudes/', {'estado': 'DIFERIDO_PRESUPUESTO'})
    assert [f['postulante']['nombres'] for f in datos(r)['resultados']] == ['Zoila']
    assert datos(presupuesto.get(f'{BASE}/solicitudes/', {'q': 'quintero'}))['total'] == 1
    assert datos(presupuesto.get(f'{BASE}/solicitudes/', {'q': '10000003'}))['total'] == 1
    r = presupuesto.get(f'{BASE}/solicitudes/', {'page_size': 1, 'pagina': 2})
    assert datos(r)['total'] == 2 and datos(r)['total_paginas'] == 2 and len(datos(r)['resultados']) == 1
    assert presupuesto.get(f'{BASE}/solicitudes/', {'estado': 'ENVIADO_CAPTACION'}).status_code == 400
    assert presupuesto.get(f'{BASE}/solicitudes/', {'vista': 'otra'}).status_code == 400
    assert cliente('postulacion.ver_bandeja').get(f'{BASE}/solicitudes/').status_code == 403
    assert APIClient().get(f'{BASE}/solicitudes/').status_code in (401, 403)


def test_bandeja_resume_reserva_constancia_y_punto_de_cuenta(mundo, presupuesto):
    exp = crear_expediente(mundo)
    reservar(presupuesto, exp, mundo['p1'])
    fila = datos(presupuesto.get(f'{BASE}/solicitudes/'))['resultados'][0]
    assert fila['reserva']['puesto_id'] == mundo['p1'].pk and fila['tiene_constancia'] is False and fila['punto_cuenta'] is None
    declarar(presupuesto, exp)
    transicion_presupuesto(presupuesto, exp, 'EN_DIRECCION_GENERAL')
    fila = datos(presupuesto.get(f'{BASE}/solicitudes/', {'vista': 'todos'}))['resultados'][0]
    assert fila['tiene_constancia'] is True and fila['punto_cuenta']['estado'] == 'EMITIDO' and fila['punto_cuenta']['numero']


def test_detalle_trae_propuesta_reserva_constancia_historial_y_acciones_segun_permiso_sin_datos_personales(mundo, presupuesto):
    exp = crear_expediente(mundo)
    ExpedientePostulacionModel.objects.filter(pk=exp).update(datos_ventana1={'domicilio': 'secreto'})
    d = datos(presupuesto.get(f'{BASE}/solicitudes/{exp}/'))
    assert d['expediente']['propuesta']['nombres'] == {
        'cargo': 'ANALISTA', 'dependencia': 'NIVEL CENTRAL', 'direccion_general': 'GESTION HUMANA'}
    assert d['postulante']['cedula'] == '12345678' and 'correo' not in d['postulante'] and 'datos_ventana1' not in d
    assert d['reserva'] is None and d['constancia'] is None and d['punto_cuenta'] is None
    assert d['capacidades'] == {'puede_reservar': True, 'puede_declarar_disponibilidad': True}
    acciones = {a['destino']: a for a in d['acciones']}
    assert set(acciones) == {'EN_CORRECCION_CARGO', 'DIFERIDO_PRESUPUESTO', 'EN_DIRECCION_GENERAL'}
    assert acciones['EN_CORRECCION_CARGO']['requiere_motivo'] and not acciones['EN_CORRECCION_CARGO']['bloqueada']
    emitir = acciones['EN_DIRECCION_GENERAL']
    assert emitir['bloqueada'] and 'puesto reservado' in emitir['motivo_bloqueo'] and 'disponibilidad' in emitir['motivo_bloqueo']
    reservar(presupuesto, exp, mundo['p1'])
    emitir = {a['destino']: a for a in datos(presupuesto.get(f'{BASE}/solicitudes/{exp}/'))['acciones']}['EN_DIRECCION_GENERAL']
    assert emitir['bloqueada'] and 'disponibilidad' in emitir['motivo_bloqueo'] and 'puesto reservado' not in emitir['motivo_bloqueo']
    declarar(presupuesto, exp)
    d = datos(presupuesto.get(f'{BASE}/solicitudes/{exp}/'))
    assert {a['destino']: a for a in d['acciones']}['EN_DIRECCION_GENERAL']['bloqueada'] is False
    assert d['constancia']['referencia'] == 'PART-2026-045'
    assert d['historial'] and d['historial'][0]['estado_destino'] == 'PRE_REGISTRADO'


def test_detalle_ofrece_solo_las_acciones_del_permiso_y_se_oculta_a_quien_no_es_de_presupuesto(mundo):
    exp = crear_expediente(mundo)
    solo_ver = cliente('postulacion.ver_solicitudes')
    d = datos(solo_ver.get(f'{BASE}/solicitudes/{exp}/'))
    assert d['acciones'] == [] and d['capacidades'] == {'puede_reservar': False, 'puede_declarar_disponibilidad': False}
    devolver = cliente('postulacion.ver_solicitudes', 'postulacion.devolver_solicitud')
    assert {a['destino'] for a in datos(devolver.get(f'{BASE}/solicitudes/{exp}/'))['acciones']} == {
        'EN_CORRECCION_CARGO', 'DIFERIDO_PRESUPUESTO'}
    captacion = crear_expediente(mundo, '87654321', estado='ENVIADO_CAPTACION')
    assert solo_ver.get(f'{BASE}/solicitudes/{captacion}/').status_code == 404  # no es de Presupuesto
    assert cliente('postulacion.ver_bandeja').get(f'{BASE}/solicitudes/{exp}/').status_code == 403


def test_detalle_de_un_expediente_final_no_ofrece_acciones(mundo, presupuesto):
    exp = crear_expediente(mundo, estado='DESISTIDO')
    assert datos(presupuesto.get(f'{BASE}/solicitudes/{exp}/'))['acciones'] == []


# ------------------------------------------------------------------------------------------------ E-4/E-5 transiciones
def test_emitir_exige_reserva_vigente_y_constancia_reales(mundo, presupuesto):
    exp = crear_expediente(mundo)
    r = transicion_presupuesto(presupuesto, exp, 'EN_DIRECCION_GENERAL')
    assert r.status_code == 409 and codigo(r) == 'PUESTO_Y_DISPONIBILIDAD_REQUERIDOS'
    reservar(presupuesto, exp, mundo['p1'])
    r = transicion_presupuesto(presupuesto, exp, 'EN_DIRECCION_GENERAL')
    assert r.status_code == 409 and 'disponibilidad' in r.json()['message'] and 'puesto reservado' not in r.json()['message']
    ReservaPuestoModel.objects.update(estado='LIBERADA')
    declarar(presupuesto, exp)
    r = transicion_presupuesto(presupuesto, exp, 'EN_DIRECCION_GENERAL')
    assert r.status_code == 409 and 'puesto reservado' in r.json()['message']
    # una reserva ACTIVA pero ya vencida tampoco cuenta
    ReservaPuestoModel.objects.create(expediente_id=exp, puesto_id=mundo['p1'].pk, reservado_por='1', vence_el=ahora_mas(days=-1))
    assert transicion_presupuesto(presupuesto, exp, 'EN_DIRECCION_GENERAL').status_code == 409
    assert ExpedientePostulacionModel.objects.get(pk=exp).estado == 'EN_PRESUPUESTO'
    assert not PuntoCuentaModel.objects.exists() and not PuntoCuentaIngresoModel.objects.exists()


def test_emitir_genera_el_punto_de_cuenta_lo_liga_al_expediente_y_fija_el_vencimiento_de_la_reserva(mundo, presupuesto):
    exp = crear_expediente(mundo)
    listo_para_dg(mundo, exp, presupuesto=presupuesto)
    e = ExpedientePostulacionModel.objects.get(pk=exp)
    assert e.estado == 'EN_DIRECCION_GENERAL' and e.reserva_vence_el > ahora_mas(days=29)
    pc = PuntoCuentaModel.objects.get()
    assert pc.empleado_cedula == '12345678' and pc.cargo_id == mundo['p1'].pk and pc.numero and pc.documento_pdf_clave
    assert pc.dependencia_destino_id == mundo['dep'].pk and pc.oficina_destino_id == mundo['dg'].pk
    assert pc.division_destino_id == mundo['linea'].pk and pc.numero.endswith(f'-{timezone.now().year}')
    assert Almacen.objetos[pc.documento_pdf_clave].startswith(b'%PDF')
    link = PuntoCuentaIngresoModel.objects.get()
    assert (str(link.expediente_id), str(link.punto_cuenta_id), link.numero, link.estado) == (exp, str(pc.pk), pc.numero, 'EMITIDO')
    assert (link.puesto_id, link.referencia_constancia, link.emitido_por) == (mundo['p1'].pk, 'PART-2026-045', '20000001')
    assert link.pdf_clave == pc.documento_pdf_clave
    reserva = ReservaPuestoModel.objects.get(estado='ACTIVA')
    assert reserva.vence_el == e.reserva_vence_el  # la reserva vence igual que el expediente
    asiento = TransicionExpedienteModel.objects.filter(expediente_id=exp).latest('fecha')
    assert (asiento.estado_destino, asiento.actor_tipo, asiento.actor_cedula) == ('EN_DIRECCION_GENERAL', 'USUARIO', '20000001')
    assert asiento.datos_extra['punto_cuenta']['numero'] == pc.numero and asiento.datos_extra['referencia_constancia'] == 'PART-2026-045'
    assert AuditoriaLog.objects.filter(accion='PUNTO_CUENTA_INGRESO_EMITIDO', recurso_id=exp).exists()
    d = datos(presupuesto.get(f'{BASE}/solicitudes/{exp}/'))
    assert d['punto_cuenta']['estado'] == 'EMITIDO' and d['documentos']['punto_cuenta'].endswith(f'/solicitudes/{exp}/punto-cuenta/')


def test_si_no_se_puede_generar_el_punto_de_cuenta_el_expediente_no_cambia_y_no_queda_nada(mundo, presupuesto):
    exp = crear_expediente(mundo)
    reservar(presupuesto, exp, mundo['p1'])
    declarar(presupuesto, exp)
    Almacen.falla_con_prefijo = 'documentos/generados/'
    assert transicion_presupuesto(presupuesto, exp, 'EN_DIRECCION_GENERAL').status_code == 500
    assert ExpedientePostulacionModel.objects.get(pk=exp).estado == 'EN_PRESUPUESTO'
    assert not PuntoCuentaModel.objects.exists() and not PuntoCuentaIngresoModel.objects.exists()
    assert not [k for k in Almacen.objetos if k.startswith('documentos/generados/')]
    Almacen.falla_con_prefijo = ''
    assert transicion_presupuesto(presupuesto, exp, 'EN_DIRECCION_GENERAL').status_code == 200


def test_devolver_por_cargo_exige_motivo_libera_la_reserva_y_avisa_a_captacion(mundo, presupuesto, django_capture_on_commit_callbacks):
    exp = crear_expediente(mundo)
    reservar(presupuesto, exp, mundo['p1'])
    r = transicion_presupuesto(presupuesto, exp, 'EN_CORRECCION_CARGO')
    assert r.status_code == 400 and codigo(r) == 'MOTIVO_OBLIGATORIO'
    assert ReservaPuestoModel.objects.get().estado == 'ACTIVA'
    with django_capture_on_commit_callbacks(execute=True):
        r = transicion_presupuesto(presupuesto, exp, 'EN_CORRECCION_CARGO', 'La oficina no existe en la estructura')
    assert r.status_code == 200, r.content
    assert datos(r)['expediente']['estado'] == 'EN_CORRECCION_CARGO' and datos(r)['reserva'] is None
    reserva = ReservaPuestoModel.objects.get()
    assert (reserva.estado, reserva.motivo_liberacion) == ('LIBERADA', 'devolución')
    assert Notificador.resueltas == [('expediente_postulacion', exp, '20000001', 'EXPEDIENTE_EN_PRESUPUESTO')]
    (aviso,) = Notificador.emitidas
    assert aviso.tipo == 'EXPEDIENTE_CORRECCION_CARGO' and aviso.permiso_destino == 'postulacion.ver_bandeja'
    assert aviso.enlace == f'/captacion/expedientes/{exp}' and 'La oficina no existe' in aviso.mensaje
    assert AuditoriaLog.objects.get(accion='SOLICITUD_TRANSICION').estado_nuevo['reserva_liberada'] == mundo['p1'].pk


def test_diferir_libera_la_reserva_fija_la_espera_y_se_retoma_con_declarar_disponibilidad(mundo, presupuesto, django_capture_on_commit_callbacks):
    exp = crear_expediente(mundo)
    reservar(presupuesto, exp, mundo['p1'])
    assert transicion_presupuesto(presupuesto, exp, 'DIFERIDO_PRESUPUESTO').status_code == 400
    with django_capture_on_commit_callbacks(execute=True):
        r = transicion_presupuesto(presupuesto, exp, 'DIFERIDO_PRESUPUESTO', 'Sin partida este trimestre')
    assert r.status_code == 200
    e = ExpedientePostulacionModel.objects.get(pk=exp)
    assert e.estado == 'DIFERIDO_PRESUPUESTO' and e.diferido_vence_el > ahora_mas(days=89)
    assert ReservaPuestoModel.objects.get().motivo_liberacion == 'diferido'
    assert Notificador.emitidas == []  # diferir no avisa a nadie (no está en el catálogo pedido)
    # retomar: requiere declarar_disponibilidad (no devolver_solicitud) y no avisa a Presupuesto de su propio acto
    sin_permiso = cliente('postulacion.ver_solicitudes', 'postulacion.devolver_solicitud')
    r = transicion_presupuesto(sin_permiso, exp, 'EN_PRESUPUESTO')
    assert r.status_code == 403 and codigo(r) == 'SIN_PERMISO'
    with django_capture_on_commit_callbacks(execute=True):
        r = transicion_presupuesto(presupuesto, exp, 'EN_PRESUPUESTO', 'Se liberó la partida')
    assert r.status_code == 200 and datos(r)['expediente']['estado'] == 'EN_PRESUPUESTO'
    assert ExpedientePostulacionModel.objects.get(pk=exp).diferido_vence_el is None
    assert Notificador.emitidas == []


def test_transiciones_ilegales_destino_inexistente_expediente_final_y_sin_permiso(mundo, presupuesto):
    exp = crear_expediente(mundo)
    for destino in ('APROBADO', 'EN_CAPTURA', 'ENVIADO_CAPTACION', 'EN_PRESUPUESTO', 'CONTRATADO'):
        r = transicion_presupuesto(presupuesto, exp, destino)
        assert r.status_code == 409 and codigo(r) == 'TRANSICION_NO_PERMITIDA', destino
    assert codigo(transicion_presupuesto(presupuesto, exp, 'NO_EXISTE')) == 'DESTINO_INVALIDO'
    assert transicion_presupuesto(presupuesto, '00000000-0000-4000-8000-000000000000', 'DIFERIDO_PRESUPUESTO', 'x').status_code == 404
    final = crear_expediente(mundo, '87654321', estado='DESISTIDO')
    r = transicion_presupuesto(presupuesto, final, 'EN_PRESUPUESTO')
    assert r.status_code == 409 and codigo(r) == 'EXPEDIENTE_FINAL'
    solo_ver = cliente('postulacion.ver_solicitudes', 'postulacion.reservar_puesto')
    assert transicion_presupuesto(solo_ver, exp, 'DIFERIDO_PRESUPUESTO', 'x').status_code == 403
    emite_solo = cliente('postulacion.emitir_punto_cuenta')
    r = transicion_presupuesto(emite_solo, exp, 'DIFERIDO_PRESUPUESTO', 'x')
    assert r.status_code == 403 and codigo(r) == 'SIN_PERMISO'
    assert APIClient().post(f'{BASE}/solicitudes/{exp}/transicion/', {'destino': 'DIFERIDO_PRESUPUESTO'}, format='json').status_code in (401, 403)
    assert ExpedientePostulacionModel.objects.get(pk=exp).estado == 'EN_PRESUPUESTO'


def test_captacion_reabre_el_expediente_devuelto_y_resuelve_el_aviso_de_correccion(mundo, presupuesto, django_capture_on_commit_callbacks):
    exp = crear_expediente(mundo)
    transicion_presupuesto(presupuesto, exp, 'EN_CORRECCION_CARGO', 'Corregir')
    captacion = cliente('postulacion.ver_bandeja', 'postulacion.abrir_expediente')
    Notificador.emitidas.clear(), Notificador.resueltas.clear()
    with django_capture_on_commit_callbacks(execute=True):
        r = captacion.post(f'{BASE}/expedientes/{exp}/transicion/', {'destino': 'EN_PRESUPUESTO'}, format='json')
    assert r.status_code == 200, r.content
    assert ('expediente_postulacion', exp, '20000001', 'EXPEDIENTE_CORRECCION_CARGO') in Notificador.resueltas
    (aviso,) = Notificador.emitidas
    assert aviso.tipo == 'EXPEDIENTE_EN_PRESUPUESTO' and aviso.enlace == f'/presupuesto/solicitudes/{exp}'


def test_emitir_avisa_a_direccion_general_y_resuelve_el_aviso_de_presupuesto(mundo, presupuesto, django_capture_on_commit_callbacks):
    exp = crear_expediente(mundo)
    reservar(presupuesto, exp, mundo['p1'])
    declarar(presupuesto, exp)
    with django_capture_on_commit_callbacks(execute=False) as callbacks:
        assert transicion_presupuesto(presupuesto, exp, 'EN_DIRECCION_GENERAL').status_code == 200
    assert Notificador.emitidas == [] and Notificador.resueltas == []  # aún no hubo commit
    for cb in callbacks:
        cb()
    assert Notificador.resueltas == [('expediente_postulacion', exp, '20000001', 'EXPEDIENTE_EN_PRESUPUESTO')]
    (aviso,) = Notificador.emitidas
    assert aviso.tipo == 'EXPEDIENTE_EN_DIRECCION' and aviso.permiso_destino == 'postulacion.ver_ingresos'
    assert aviso.enlace == f'/direccion/ingresos/{exp}' and 'Ana María Pérez' in aviso.mensaje and '12345678' not in aviso.mensaje


def test_una_transicion_fallida_no_emite_ni_resuelve_avisos(mundo, presupuesto, django_capture_on_commit_callbacks):
    exp = crear_expediente(mundo)
    with django_capture_on_commit_callbacks(execute=True):
        assert transicion_presupuesto(presupuesto, exp, 'EN_DIRECCION_GENERAL').status_code == 409
    assert Notificador.emitidas == [] and Notificador.resueltas == []


# ------------------------------------------------------------------------------------------------ E-5 descarga
def test_descarga_del_punto_de_cuenta_como_adjunto_con_ver_solicitudes_o_ver_ingresos(mundo, presupuesto):
    exp = crear_expediente(mundo)
    url = f'{BASE}/solicitudes/{exp}/punto-cuenta/'
    assert presupuesto.get(url).status_code == 404  # aún no se emitió
    listo_para_dg(mundo, exp, presupuesto=presupuesto)
    numero = PuntoCuentaIngresoModel.objects.get().numero
    r = presupuesto.get(url)
    assert r.status_code == 200 and r['Content-Type'] == 'application/pdf'
    assert r['Content-Disposition'] == f'attachment; filename="punto-cuenta-{numero}.pdf"'
    assert b''.join(r.streaming_content).startswith(b'%PDF')
    assert cliente('postulacion.ver_ingresos').get(url).status_code == 200
    assert cliente('postulacion.ver_bandeja').get(url).status_code == 403
    assert cliente('postulacion.reservar_puesto').get(url).status_code == 403
    assert APIClient().get(url).status_code in (401, 403)
    assert AuditoriaLog.objects.filter(accion='PUNTO_CUENTA_INGRESO_CONSULTADO', recurso_id=exp).exists()
