"""M-1: proceso de ingreso configurable (Presupuesto y/o Dirección General fuera del sistema) por la API, contra la BD.

Las cuatro combinaciones de punta a punta hasta APROBADO y la contratación, el snapshot de los flags, las acciones de Captación
según la combinación, permisos, reserva concurrente, aprobación con y sin PDF, historial explícito, avisos y los tres arreglos de
la auditoría UX (cargo y oficina del histórico de Dirección General, nombre del actor en el historial y catálogo en Presupuesto).
"""
import threading
from datetime import date, timedelta

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import connection
from django.utils import timezone

from apps.postulacion.infrastructure.models.expediente_models import ExpedientePostulacionModel, TransicionExpedienteModel
from apps.postulacion.infrastructure.models.presupuesto_models import PuntoCuentaIngresoModel, ReservaPuestoModel
from apps.postulacion.infrastructure.repositories.repo_postulacion_orm import RepoPostulacionORM
from apps.postulacion.application.use_cases.vencimientos import procesar_vencimientos
from core.infrastructure.models.auditoria import AuditoriaLog
from tests.integration.postulacion._presupuesto_mundo import (
    BASE,
    DIRECCION,
    PDF,
    PRESUPUESTO,
    Almacen,
    Config,
    Notificador,
    cliente,
    codigo,
    crear_expediente,
    crear_mundo,
    datos,
    instalar_dobles,
    listo_para_dg,
    transicion_direccion,
)
from tests.integration.postulacion._ventana2_mundo import (
    Mundo2,
    completar_ventana2,
    instalar_dobles_g,
)

pytestmark = pytest.mark.django_db

COMBINACIONES = [(True, True), (True, False), (False, True), (False, False)]
CAPTACION_ING = (
    'postulacion.ver_bandeja', 'postulacion.verificar', 'postulacion.rechazar', 'postulacion.abrir_expediente', 'postulacion.crear_postulante',
    'postulacion.revision_final',
)


@pytest.fixture(autouse=True)
def dobles(monkeypatch, settings):
    instalar_dobles_g(monkeypatch)
    settings.DOMINIO_CORREO_INSTITUCIONAL = '@conatel.gob.ve'


@pytest.fixture
def m2(mundo):
    return Mundo2(mundo)


@pytest.fixture
def cap(m2):
    return m2.captacion(*CAPTACION_ING)


def expediente(m2, rp, rdg, cedula='12345678', estado='ENVIADO_CAPTACION'):
    return crear_expediente(
        m2.mundo, cedula, estado=estado, requiere_presupuesto=rp, requiere_direccion_general=rdg,
    )


def detalle(c, exp):
    r = c.get(f'{BASE}/expedientes/{exp}/')
    assert r.status_code == 200, r.content
    return datos(r)


def acciones(c, exp):
    return {a['codigo'] or a['destino']: a for a in detalle(c, exp)['acciones']}


def reservar_cap(c, exp, puesto):
    return c.post(f'{BASE}/expedientes/{exp}/reserva/', {'puesto_id': puesto.pk}, format='json')


def generar_pc(c, exp):
    return c.post(f'{BASE}/expedientes/{exp}/punto-cuenta/')


def aprobar_cap(c, exp, fecha=None, pdf=None):
    cuerpo = {'fecha_firma': (fecha or date.today()).isoformat()}
    if pdf is not None:
        cuerpo['pdf_firmado'] = SimpleUploadedFile('firmado.pdf', pdf, content_type='application/pdf')
    return c.post(f'{BASE}/expedientes/{exp}/aprobacion/', cuerpo, format='multipart')


def estado(exp):
    return ExpedientePostulacionModel.objects.get(pk=exp).estado


# ------------------------------------------------------------------------------------------------ parámetros y snapshot
def test_los_parametros_existen_con_defecto_activo_y_en_la_seccion_proceso_de_ingreso():
    from apps.configuracion.domain.parametros import DEFINICIONES, SECCION_PROCESO_INGRESO

    por_clave = {d.clave: d for d in DEFINICIONES}
    for clave in ('captacion.requiere_presupuesto', 'captacion.requiere_direccion_general'):
        d = por_clave[clave]
        assert (d.tipo, d.defecto, d.grupo, d.seccion) == ('booleano', 'true', 'captacion', SECCION_PROCESO_INGRESO)
    assert por_clave['captacion.psicofisico_obligatorio'].seccion == SECCION_PROCESO_INGRESO


def test_el_expediente_guarda_los_flags_vigentes_al_crearse_y_cambiarlos_despues_no_lo_altera(m2, cap, monkeypatch):
    monkeypatch.setattr(
        'apps.postulacion.presentation.views.captacion_views.configuracion',
        lambda: Config(requiere_presupuesto=False, requiere_direccion_general=True),
    )
    r = cap.post(f'{BASE}/postulantes/', {
        'cedula': '12345678', 'nombres': 'Ana', 'apellidos': 'Pérez', 'correo': 'ana@ejemplo.invalid',
        'telefono_movil': '04141234567'}, format='json')
    assert r.status_code == 201, r.content
    exp = datos(r)['expediente']['id']
    m = ExpedientePostulacionModel.objects.get(pk=exp)
    assert (m.requiere_presupuesto, m.requiere_direccion_general) == (False, True)
    # el parámetro cambia después: el expediente en curso conserva su copia
    monkeypatch.setattr(
        'apps.postulacion.presentation.views.captacion_views.configuracion',
        lambda: Config(requiere_presupuesto=True, requiere_direccion_general=False),
    )
    assert detalle(cap, exp)['flujo'] == {'requiere_presupuesto': False, 'requiere_direccion_general': True}
    # un expediente nuevo toma lo vigente
    exp2 = expediente(m2, True, False, '87654321')
    assert detalle(cap, exp2)['flujo'] == {'requiere_presupuesto': True, 'requiere_direccion_general': False}


# ------------------------------------------------------------------------------------------------ acciones por combinación
def test_acciones_con_ambos_activos_son_las_de_siempre(m2, cap):
    exp = expediente(m2, True, True)
    a = acciones(cap, exp)
    assert 'EN_PRESUPUESTO' in a and 'RECHAZADO_CAPTACION' in a
    assert not {'reservar_puesto', 'generar_punto_cuenta', 'registrar_aprobacion'} & set(a)
    assert detalle(cap, exp)['flujo'] == {'requiere_presupuesto': True, 'requiere_direccion_general': True}


def test_acciones_solo_direccion_general_sin_presupuesto(m2, cap):
    exp = expediente(m2, False, True)
    a = acciones(cap, exp)
    assert 'EN_PRESUPUESTO' not in a and 'RECHAZADO_CAPTACION' in a
    assert a['reservar_puesto']['etiqueta'] == 'Reservar puesto' and a['reservar_puesto']['bloqueada'] is False
    assert a['generar_punto_cuenta']['bloqueada'] is True and 'Reserve primero' in a['generar_punto_cuenta']['motivo_bloqueo']
    assert 'registrar_aprobacion' not in a
    assert reservar_cap(cap, exp, m2.mundo['p1']).status_code == 200
    a = acciones(cap, exp)
    assert a['reservar_puesto']['etiqueta'] == 'Cambiar el puesto reservado' and 'liberar_reserva' in a
    assert a['generar_punto_cuenta']['bloqueada'] is False and a['generar_punto_cuenta']['destino'] == 'EN_DIRECCION_GENERAL'


def test_acciones_sin_presupuesto_ni_direccion_general(m2, cap):
    exp = expediente(m2, False, False)
    a = acciones(cap, exp)
    assert a['generar_punto_cuenta']['bloqueada'] is True
    assert a['registrar_aprobacion']['bloqueada'] is True and a['registrar_aprobacion']['requiere_fecha'] is True
    reservar_cap(cap, exp, m2.mundo['p1'])
    a = acciones(cap, exp)
    assert a['generar_punto_cuenta']['bloqueada'] is False
    assert a['registrar_aprobacion']['bloqueada'] is True and 'Genere primero' in a['registrar_aprobacion']['motivo_bloqueo']
    generar_pc(cap, exp)
    a = acciones(cap, exp)
    assert 'generar_punto_cuenta' not in a and a['registrar_aprobacion']['bloqueada'] is False
    # con el Punto de Cuenta generado no se cambia ni se libera el puesto
    assert a['reservar_puesto']['bloqueada'] is True and a['liberar_reserva']['bloqueada'] is True


def test_acciones_con_presupuesto_y_sin_direccion_general(m2, cap):
    exp = expediente(m2, True, False)
    assert 'EN_PRESUPUESTO' in acciones(cap, exp) and 'reservar_puesto' not in acciones(cap, exp)
    ExpedientePostulacionModel.objects.filter(pk=exp).update(estado='EN_DIRECCION_GENERAL')
    assert acciones(cap, exp)['registrar_aprobacion']['requiere_fecha'] is True


# ------------------------------------------------------------------------------------------------ punta a punta
def a_listo_para_contratar(m2, exp):
    """Con el expediente APROBADO y su reserva activa: la Ventana 2 completa y listo para asignar (igual que G-4)."""
    Almacen.objetos['postulacion/foto/semilla.jpg'] = b'\xff\xd8\xff-foto'
    reserva = ReservaPuestoModel.objects.get(expediente_id=exp, estado='ACTIVA')
    assert reserva.vence_el > timezone.now() + timedelta(days=25)
    completar_ventana2(exp, m2.cat, estado='LISTO_PARA_ASIGNAR', reserva_vence_el=reserva.vence_el)


def contratar(m2, c, exp, django_capture_on_commit_callbacks):
    a_listo_para_contratar(m2, exp)
    with django_capture_on_commit_callbacks(execute=True):
        r = c.post(f'{BASE}/expedientes/{exp}/asignar/', {}, format='json')
    assert r.status_code == 200, r.content
    assert datos(r)['expediente']['estado'] == 'CONTRATADO' and datos(r)['reserva']['estado'] == 'CONSUMIDA'


def test_combinacion_ambos_activos_hasta_contratado(m2, cap, django_capture_on_commit_callbacks):
    exp = expediente(m2, True, True, estado='EN_PRESUPUESTO')
    listo_para_dg(m2.mundo, exp)
    assert estado(exp) == 'EN_DIRECCION_GENERAL'
    assert transicion_direccion(cliente(*DIRECCION), exp, 'APROBADO').status_code == 200
    assert estado(exp) == 'APROBADO'
    contratar(m2, cap, exp, django_capture_on_commit_callbacks)


def test_combinacion_solo_presupuesto_captacion_registra_la_aprobacion(m2, cap, django_capture_on_commit_callbacks):
    exp = expediente(m2, True, False, estado='EN_PRESUPUESTO')
    listo_para_dg(m2.mundo, exp)
    assert estado(exp) == 'EN_DIRECCION_GENERAL'
    # Dirección General no tiene bandeja ni decide para este expediente
    assert transicion_direccion(cliente(*DIRECCION), exp, 'APROBADO').status_code in (403, 404, 409)
    with django_capture_on_commit_callbacks(execute=True):
        r = aprobar_cap(cap, exp)
    assert r.status_code == 200, r.content
    assert estado(exp) == 'APROBADO'
    contratar(m2, cap, exp, django_capture_on_commit_callbacks)


def test_combinacion_solo_direccion_general_captacion_reserva_y_genera_el_punto_de_cuenta(
    m2, cap, django_capture_on_commit_callbacks,
):
    exp = expediente(m2, False, True)
    # sin reserva no se puede generar; el camino de Presupuesto está cerrado
    assert codigo(generar_pc(cap, exp)) == 'PUESTO_RESERVADO_REQUERIDO'
    assert cap.post(f'{BASE}/expedientes/{exp}/transicion/', {'destino': 'EN_PRESUPUESTO'}, format='json').status_code == 409
    assert reservar_cap(cap, exp, m2.mundo['p1']).status_code == 200
    with django_capture_on_commit_callbacks(execute=True):
        r = generar_pc(cap, exp)
    assert r.status_code == 200, r.content
    assert estado(exp) == 'EN_DIRECCION_GENERAL'
    pc = PuntoCuentaIngresoModel.objects.get(expediente_id=exp)
    assert pc.estado == 'EMITIDO' and pc.referencia_constancia == '' and pc.puesto_id == m2.mundo['p1'].pk
    assert datos(r)['punto_cuenta']['estado'] == 'EMITIDO'
    # la Dirección General sí recibe su aviso y decide dentro del sistema
    assert [n.tipo for n in Notificador.emitidas] == ['EXPEDIENTE_EN_DIRECCION']
    assert 'Captación generó' in Notificador.emitidas[0].mensaje
    assert transicion_direccion(cliente(*DIRECCION), exp, 'APROBADO').status_code == 200
    contratar(m2, cap, exp, django_capture_on_commit_callbacks)


def test_combinacion_ninguno_hasta_contratado_con_punto_de_cuenta_y_aprobacion_de_captacion(
    m2, cap, django_capture_on_commit_callbacks,
):
    exp = expediente(m2, False, False)
    assert reservar_cap(cap, exp, m2.mundo['p1']).status_code == 200
    # aún sin Punto de Cuenta no se registra la aprobación
    assert codigo(aprobar_cap(cap, exp)) == 'PUNTO_CUENTA_NO_GENERADO'
    with django_capture_on_commit_callbacks(execute=True):
        r = generar_pc(cap, exp)
    assert r.status_code == 200, r.content
    assert estado(exp) == 'ENVIADO_CAPTACION'
    # el PDF para imprimir y firmar se descarga (con bitácora)
    pdf = cap.get(f'{BASE}/expedientes/{exp}/punto-cuenta/')
    assert pdf.status_code == 200 and pdf['Content-Type'] == 'application/pdf'
    assert AuditoriaLog.objects.filter(accion='PUNTO_CUENTA_INGRESO_CONSULTADO', recurso_id=exp).exists()
    # no se puede generar de nuevo ni cambiar/liberar la reserva
    assert codigo(generar_pc(cap, exp)) == 'PUNTO_CUENTA_YA_GENERADO'
    assert codigo(reservar_cap(cap, exp, m2.mundo['p2'])) == 'PUNTO_CUENTA_YA_GENERADO'
    assert cap.delete(f'{BASE}/expedientes/{exp}/reserva/').status_code == 409
    with django_capture_on_commit_callbacks(execute=True):
        r = aprobar_cap(cap, exp)
    assert r.status_code == 200, r.content
    assert estado(exp) == 'APROBADO'
    reserva = ReservaPuestoModel.objects.get(expediente_id=exp)
    exp_m = ExpedientePostulacionModel.objects.get(pk=exp)
    assert reserva.vence_el == exp_m.reserva_vence_el and reserva.vence_el > timezone.now() + timedelta(days=29)
    # nadie recibe avisos de Presupuesto ni de Dirección General
    assert Notificador.emitidas == []
    contratar(m2, cap, exp, django_capture_on_commit_callbacks)


def test_cambiar_la_reserva_antes_del_punto_de_cuenta_libera_la_anterior(m2, cap):
    exp = expediente(m2, False, False)
    reservar_cap(cap, exp, m2.mundo['p1'])
    assert reservar_cap(cap, exp, m2.mundo['p2']).status_code == 200
    assert ReservaPuestoModel.objects.get(puesto_id=m2.mundo['p1'].pk).estado == 'LIBERADA'
    assert cap.delete(f'{BASE}/expedientes/{exp}/reserva/').status_code == 200
    assert not ReservaPuestoModel.objects.filter(expediente_id=exp, estado='ACTIVA').exists()
    r = cap.get(f'{BASE}/expedientes/{exp}/vacantes/')
    assert r.status_code == 200 and datos(r)['total'] == 3 and datos(r)['filtros']['de_propuesta'] is True


# ------------------------------------------------------------------------------------------------ permisos y límites
def test_los_endpoints_de_captacion_exigen_el_permiso_y_el_flujo_correcto(m2, cap):
    exp = expediente(m2, False, False)
    solo_ver = m2.captacion('postulacion.ver_bandeja')
    for metodo, ruta, cuerpo in (
        ('post', 'reserva/', {'puesto_id': m2.mundo['p1'].pk}), ('delete', 'reserva/', None), ('get', 'vacantes/', None),
        ('post', 'punto-cuenta/', None), ('post', 'aprobacion/', {'fecha_firma': date.today().isoformat()}),
        ('post', 'punto-cuenta-firmado/', None),
    ):
        r = getattr(solo_ver, metodo)(f'{BASE}/expedientes/{exp}/{ruta}', *([cuerpo] if cuerpo else []))
        assert r.status_code == 403, (metodo, ruta, r.status_code)
    # Presupuesto y Dirección General no hacen lo de Captación
    assert cliente(*PRESUPUESTO).post(f'{BASE}/expedientes/{exp}/reserva/', {'puesto_id': 1}, format='json').status_code == 403
    assert cliente(*DIRECCION).post(f'{BASE}/expedientes/{exp}/aprobacion/', {}, format='multipart').status_code == 403
    # con quien sí tiene permiso, un expediente CON Presupuesto en el sistema no se gestiona desde Captación
    con_pre = expediente(m2, True, True, '87654321')
    assert codigo(reservar_cap(cap, con_pre, m2.mundo['p1'])) == 'EXPEDIENTE_CON_PRESUPUESTO'
    assert codigo(generar_pc(cap, con_pre)) == 'EXPEDIENTE_CON_PRESUPUESTO'
    assert codigo(aprobar_cap(cap, con_pre)) == 'EXPEDIENTE_CON_DIRECCION_GENERAL'
    assert cap.get(f'{BASE}/expedientes/{con_pre}/vacantes/').status_code == 409
    # la lectura de los PDF sí está abierta a quien ve la bandeja (404 mientras no existan)
    assert solo_ver.get(f'{BASE}/expedientes/{exp}/punto-cuenta/').status_code == 404
    assert solo_ver.get(f'{BASE}/expedientes/{exp}/punto-cuenta-firmado/').status_code == 404


def test_reservar_desde_captacion_revalida_el_puesto_y_no_toca_puestos_ocupados(m2, cap):
    exp = expediente(m2, False, True)
    assert codigo(reservar_cap(cap, exp, m2.mundo['ocupado'])) == 'PUESTO_NO_VACANTE'
    otro = expediente(m2, False, True, '87654321')
    assert reservar_cap(cap, otro, m2.mundo['p1']).status_code == 200
    assert codigo(reservar_cap(cap, exp, m2.mundo['p1'])) == 'PUESTO_RESERVADO'
    assert reservar_cap(cap, exp, type('P', (), {'pk': 999999})()).status_code == 404


@pytest.mark.django_db(transaction=True)
def test_reservar_en_concurrencia_desde_captacion_solo_uno_gana(monkeypatch, settings):
    instalar_dobles(monkeypatch)
    mundo = crear_mundo()
    a = crear_expediente(mundo, '12345678', estado='ENVIADO_CAPTACION', requiere_presupuesto=False)
    b = crear_expediente(mundo, '87654321', estado='ENVIADO_CAPTACION', requiere_presupuesto=False)
    barrera, resultados = threading.Barrier(2), {}

    def hilo(nombre, exp):
        try:
            barrera.wait(timeout=10)
            resultados[nombre] = reservar_cap(cliente(*CAPTACION_ING), exp, mundo['p1'])
        finally:
            connection.close()

    hilos = [threading.Thread(target=hilo, args=(n, e)) for n, e in (('a', a), ('b', b))]
    for h in hilos:
        h.start()
    for h in hilos:
        h.join(timeout=30)
    assert sorted(r.status_code for r in resultados.values()) == [200, 409]
    assert codigo(next(r for r in resultados.values() if r.status_code == 409)) == 'PUESTO_RESERVADO'
    assert ReservaPuestoModel.objects.filter(puesto_id=mundo['p1'].pk, estado='ACTIVA').count() == 1


# ------------------------------------------------------------------------------------------------ aprobación fuera del sistema
def listo_para_firmar(m2, cap):
    exp = expediente(m2, False, False)
    reservar_cap(cap, exp, m2.mundo['p1'])
    assert generar_pc(cap, exp).status_code == 200
    return exp


def test_aprobar_sin_pdf_registra_fecha_historial_explicito_y_deja_adjuntar_despues(m2, cap, django_capture_on_commit_callbacks):
    exp = listo_para_firmar(m2, cap)
    firma = date.today() - timedelta(days=3)
    with django_capture_on_commit_callbacks(execute=True):
        r = aprobar_cap(cap, exp, fecha=firma)
    assert r.status_code == 200, r.content
    d = datos(r)
    assert d['punto_cuenta']['estado'] == 'FIRMADO' and d['punto_cuenta']['aprobado_fuera_sistema'] is True
    assert d['punto_cuenta']['fecha_firma'] == firma.isoformat() and d['punto_cuenta']['tiene_pdf_firmado'] is False
    assert d['punto_cuenta']['registrado_por_nombre'] == 'Carla Captación'
    asiento = d['historial'][-1]
    hoy = timezone.localdate().strftime('%d/%m/%Y')
    assert asiento['estado_destino'] == 'APROBADO' and asiento['tipo'] == 'APROBACION_FUERA_SISTEMA'
    assert asiento['motivo'] == (
        f'Aprobado fuera del sistema; registrado por Carla Captación el {hoy}; firma del {firma.strftime("%d/%m/%Y")}.')
    assert asiento['actor_cedula'] == '20000001' and asiento['actor_nombre'] == 'Carla Captación'
    assert 'adjuntar_punto_cuenta_firmado' in {a['codigo'] for a in d['acciones']}
    assert d['documentos']['punto_cuenta_firmado'] is None
    assert cap.get(f'{BASE}/expedientes/{exp}/punto-cuenta-firmado/').status_code == 404
    # no se aprueba dos veces
    assert aprobar_cap(cap, exp).status_code == 409
    # adjuntar después
    r = cap.post(f'{BASE}/expedientes/{exp}/punto-cuenta-firmado/', {
        'pdf_firmado': SimpleUploadedFile('f.pdf', PDF, content_type='application/pdf')}, format='multipart')
    assert r.status_code == 200, r.content
    pc = PuntoCuentaIngresoModel.objects.get(expediente_id=exp)
    assert pc.pdf_firmado_clave.startswith('postulacion/punto_cuenta_firmado/') and pc.pdf_firmado_tamano == len(PDF)
    assert '12345678' not in pc.pdf_firmado_clave and Almacen.objetos[pc.pdf_firmado_clave] == PDF
    assert datos(r)['documentos']['punto_cuenta_firmado'].endswith(f'/expedientes/{exp}/punto-cuenta-firmado/')
    descarga = cap.get(f'{BASE}/expedientes/{exp}/punto-cuenta-firmado/')
    assert descarga.status_code == 200 and descarga['Content-Type'] == 'application/pdf'
    assert AuditoriaLog.objects.filter(accion='PDF_FIRMADO_CONSULTADO', recurso_id=exp).exists()
    # y solo una vez
    r = cap.post(f'{BASE}/expedientes/{exp}/punto-cuenta-firmado/', {
        'pdf_firmado': SimpleUploadedFile('f.pdf', PDF, content_type='application/pdf')}, format='multipart')
    assert codigo(r) == 'PDF_FIRMADO_YA_ADJUNTO'


def test_aprobar_con_pdf_valido_lo_guarda_con_clave_opaca(m2, cap):
    exp = listo_para_firmar(m2, cap)
    r = aprobar_cap(cap, exp, pdf=PDF)
    assert r.status_code == 200, r.content
    pc = PuntoCuentaIngresoModel.objects.get(expediente_id=exp)
    assert pc.estado == 'FIRMADO' and pc.pdf_firmado_clave and len(pc.pdf_firmado_sha256) == 64
    assert datos(r)['punto_cuenta']['tiene_pdf_firmado'] is True
    assert 'adjuntar_punto_cuenta_firmado' not in {a['codigo'] for a in datos(r)['acciones']}


@pytest.mark.parametrize('nombre,contenido,mime', [
    ('falso.pdf', b'esto no es un pdf', 'application/pdf'),
    ('imagen.png', b'\x89PNG\r\n\x1a\n', 'image/png'),
    ('vacio.pdf', b'', 'application/pdf'),
])
def test_aprobar_con_pdf_invalido_se_rechaza_y_no_cambia_nada(m2, cap, nombre, contenido, mime):
    exp = listo_para_firmar(m2, cap)
    r = cap.post(f'{BASE}/expedientes/{exp}/aprobacion/', {
        'fecha_firma': date.today().isoformat(), 'pdf_firmado': SimpleUploadedFile(nombre, contenido, content_type=mime)},
        format='multipart')
    assert r.status_code == 400, r.content
    assert estado(exp) == 'ENVIADO_CAPTACION' and PuntoCuentaIngresoModel.objects.get(expediente_id=exp).estado == 'EMITIDO'


def test_aprobar_exige_fecha_no_futura(m2, cap):
    exp = listo_para_firmar(m2, cap)
    assert aprobar_cap(cap, exp, fecha=date.today() + timedelta(days=1)).status_code == 400
    assert cap.post(f'{BASE}/expedientes/{exp}/aprobacion/', {}, format='multipart').status_code == 400
    assert estado(exp) == 'ENVIADO_CAPTACION'
    assert aprobar_cap(cap, exp, fecha=date.today()).status_code == 200


def test_adjuntar_exige_aprobacion_fuera_del_sistema_y_pdf_valido(m2, cap):
    exp = listo_para_firmar(m2, cap)
    subir = lambda: cap.post(f'{BASE}/expedientes/{exp}/punto-cuenta-firmado/', {   # noqa: E731
        'pdf_firmado': SimpleUploadedFile('f.pdf', PDF, content_type='application/pdf')}, format='multipart')
    assert codigo(subir()) == 'ADJUNTO_NO_PERMITIDO'   # aún no se registró la aprobación
    aprobar_cap(cap, exp)
    malo = cap.post(f'{BASE}/expedientes/{exp}/punto-cuenta-firmado/', {
        'pdf_firmado': SimpleUploadedFile('f.pdf', b'basura', content_type='application/pdf')}, format='multipart')
    assert malo.status_code == 400
    assert subir().status_code == 200


# ------------------------------------------------------------------------------------------------ avisos
def test_con_presupuesto_y_sin_direccion_general_no_se_avisa_a_direccion_ni_de_ingreso_aprobado(
    m2, cap, django_capture_on_commit_callbacks,
):
    exp = expediente(m2, True, False, estado='EN_PRESUPUESTO')
    with django_capture_on_commit_callbacks(execute=True):
        listo_para_dg(m2.mundo, exp)
        aprobar_cap(cap, exp)
    tipos = {n.tipo for n in Notificador.emitidas}
    assert 'EXPEDIENTE_EN_DIRECCION' not in tipos and 'INGRESO_APROBADO' not in tipos


def test_sin_presupuesto_captacion_no_emite_el_aviso_de_presupuesto(m2, cap, django_capture_on_commit_callbacks):
    exp = expediente(m2, False, True)
    reservar_cap(cap, exp, m2.mundo['p1'])
    with django_capture_on_commit_callbacks(execute=True):
        generar_pc(cap, exp)
    assert 'EXPEDIENTE_EN_PRESUPUESTO' not in {n.tipo for n in Notificador.emitidas}


# ------------------------------------------------------------------------------------------------ vencimiento y bandejas
def test_sin_presupuesto_el_puesto_perdido_devuelve_el_expediente_a_captacion(m2, django_capture_on_commit_callbacks):
    exp = expediente(m2, False, False, estado='LISTO_PARA_ASIGNAR')
    ExpedientePostulacionModel.objects.filter(pk=exp).update(reserva_vence_el=timezone.now() - timedelta(days=1))
    ReservaPuestoModel.objects.create(
        expediente_id=exp, puesto_id=m2.mundo['p1'].pk, reservado_por='20000001', vence_el=timezone.now() - timedelta(days=1))
    with django_capture_on_commit_callbacks(execute=True):
        r = procesar_vencimientos(RepoPostulacionORM(), Config(), Notificador(), ahora=timezone.now())
    assert r.reservas_vencidas == 1 and r.errores == 0
    assert estado(exp) == 'ENVIADO_CAPTACION'
    asiento = TransicionExpedienteModel.objects.filter(expediente_id=exp).latest('fecha')
    assert (asiento.estado_destino, asiento.actor_tipo) == ('ENVIADO_CAPTACION', 'SISTEMA')
    assert 'Captación' in asiento.motivo
    assert 'EXPEDIENTE_EN_PRESUPUESTO' not in {n.tipo for n in Notificador.emitidas}


def test_las_bandejas_de_presupuesto_y_direccion_no_muestran_los_expedientes_que_no_pasan_por_ellas(m2, mundo):
    sin_pre = expediente(m2, False, True, estado='EN_DIRECCION_GENERAL')
    con = expediente(m2, True, True, '87654321', estado='EN_PRESUPUESTO')
    sin_dg = expediente(m2, True, False, '11111111', estado='EN_DIRECCION_GENERAL')
    presupuesto = [f['id'] for f in datos(cliente(*PRESUPUESTO).get(f'{BASE}/solicitudes/?vista=todos'))['resultados']]
    assert con in presupuesto and sin_pre not in presupuesto
    direccion = [f['id'] for f in datos(cliente(*DIRECCION).get(f'{BASE}/ingresos/'))['resultados']]
    assert sin_pre in direccion and sin_dg not in direccion
    assert cliente(*DIRECCION).get(f'{BASE}/ingresos/{sin_dg}/').status_code == 404


# ------------------------------------------------------------------------------------------------ arreglos de la auditoría UX
def test_a_el_historico_de_direccion_general_trae_cargo_y_oficina(m2, django_capture_on_commit_callbacks):
    exp = expediente(m2, True, True, estado='EN_PRESUPUESTO')
    listo_para_dg(m2.mundo, exp)
    dg = cliente(*DIRECCION, cedula='30000001', nombre='Director General')
    assert transicion_direccion(dg, exp, 'APROBADO').status_code == 200
    ExpedientePostulacionModel.objects.filter(pk=exp).update(estado='CONSOLIDANDO')   # ya avanzó: sigue en el histórico
    r = dg.get(f'{BASE}/ingresos/?vista=historico')
    fila = next(f for f in datos(r)['resultados'] if f['id'] == exp)
    assert fila['propuesta']['cargo_texto'] == 'ANALISTA'
    assert 'GESTION HUMANA' in fila['propuesta']['oficina_texto']


def test_a_sin_ids_de_propuesta_el_cargo_y_la_oficina_salen_del_puesto_reservado(m2):
    exp = crear_expediente(m2.mundo, '12345678', estado='EN_DIRECCION_GENERAL', con_propuesta=False)
    ReservaPuestoModel.objects.create(
        expediente_id=exp, puesto_id=m2.mundo['p1'].pk, reservado_por='20000001', vence_el=timezone.now() + timedelta(days=5))
    fila = next(f for f in datos(cliente(*DIRECCION).get(f'{BASE}/ingresos/'))['resultados'] if f['id'] == exp)
    assert fila['propuesta']['cargo_texto'] and 'GESTION HUMANA' in fila['propuesta']['oficina_texto']


def test_b_el_historial_trae_el_nombre_del_actor_ademas_de_la_cedula(m2, cap):
    exp = expediente(m2, True, True)
    cap.post(f'{BASE}/expedientes/{exp}/transicion/', {'destino': 'EN_PRESUPUESTO'}, format='json')
    TransicionExpedienteModel.objects.filter(expediente_id=exp).update(actor_cedula='20000001')
    historial = detalle(cap, exp)['historial']
    con_actor = [h for h in historial if h['actor_cedula'] == '20000001']
    assert con_actor and all(h['actor_nombre'] == 'Carla Captación' for h in con_actor)
    assert all('actor_cedula' in h and 'actor_tipo' in h for h in historial)   # los campos actuales siguen
    sistema = [h for h in historial if not h['actor_cedula']]
    assert all(h['actor_nombre'] == '' for h in sistema)


def test_c_la_bandeja_de_presupuesto_usa_los_nombres_del_catalogo_cuando_falta_el_texto(m2):
    exp = crear_expediente(m2.mundo, '12345678', estado='EN_PRESUPUESTO')   # solo ids, sin texto
    assert ExpedientePostulacionModel.objects.get(pk=exp).cargo_propuesto_texto in ('', None)
    fila = next(f for f in datos(cliente(*PRESUPUESTO).get(f'{BASE}/solicitudes/'))['resultados'] if f['id'] == exp)
    assert fila['propuesta']['cargo_texto'] == 'ANALISTA'
    assert 'GESTION HUMANA' in fila['propuesta']['oficina_texto']
    # el texto de Captación, si existe, manda
    ExpedientePostulacionModel.objects.filter(pk=exp).update(cargo_propuesto_texto='Analista de nómina')
    fila = next(f for f in datos(cliente(*PRESUPUESTO).get(f'{BASE}/solicitudes/'))['resultados'] if f['id'] == exp)
    assert fila['propuesta']['cargo_texto'] == 'Analista de nómina'
