"""Bandeja de Captación (D-7), psicofísico (D-8) y avisos del flujo (D-9) por la API, contra la BD."""
from datetime import timedelta

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone
from rest_framework.test import APIClient

from apps.cargos.infrastructure.models.cargo_models import DenominacionCargoModel
from apps.organizacion.infrastructure.models.organizacion_models import DependenciaModel, DireccionGeneralModel
from apps.postulacion.application.use_cases.postulantes import crear_postulante_con_expediente
from apps.postulacion.infrastructure.models.expediente_models import (
    ExpedientePostulacionModel,
    PostulanteModel,
    TransicionExpedienteModel,
)
from apps.postulacion.infrastructure.models.psicofisico_models import ResultadoPsicofisicoModel
from apps.postulacion.infrastructure.repositories.repo_postulacion_orm import BuscadorEmpleadosORM, RepoPostulacionORM
from core.infrastructure.models.auditoria import AuditoriaLog

pytestmark = pytest.mark.django_db

BASE = '/api/v1/postulacion/expedientes'
VISTAS = 'apps.postulacion.presentation.views'
PDF = b'%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF'


class Personal:
    is_authenticated = True
    is_active = True
    rol_id = None
    id = None

    def __init__(self, permisos, cedula='20000001'):
        self.pk = 1
        self.cedula_id = cedula
        self._permisos = set(permisos)

    def tiene_permiso(self, codigo):
        return codigo in self._permisos


CAPTACION = (
    'postulacion.ver_bandeja', 'postulacion.verificar', 'postulacion.rechazar', 'postulacion.abrir_expediente',
    'postulacion.revision_final', 'postulacion.registrar_psicofisico',
)


def cliente(*permisos, cedula='20000001'):
    c = APIClient()
    c.force_authenticate(user=Personal(permisos, cedula))
    return c


@pytest.fixture
def captacion():
    return cliente(*CAPTACION)


class Config:
    def __init__(self, psicofisico=True):
        self.valores = {
            'captacion.vigencia_ventana1_dias': 15, 'captacion.vigencia_ventana2_dias': 10,
            'captacion.vigencia_reserva_puesto_dias': 30, 'captacion.espera_diferido_dias': 90,
            'captacion.psicofisico_obligatorio': psicofisico,
        }

    def obtener_texto(self, clave):
        return str(self.valores[clave])

    def obtener_booleano(self, clave):
        return bool(self.valores[clave])

    def obtener_entero(self, clave):
        return int(self.valores[clave])


class Almacen:
    objetos: dict = {}

    def subir(self, clave, contenido, mime_type='application/octet-stream'):
        self.objetos[clave] = contenido
        return clave

    def eliminar(self, clave):
        self.objetos.pop(clave, None)

    def descargar_flujo(self, clave, tamano_bloque=65536):
        yield self.objetos[clave]


class Notificador:
    """Registra lo emitido y lo resuelto, y si había una transacción abierta de más (on_commit ya corrió)."""

    emitidas: list = []
    resueltas: list = []
    correos: list = []

    def enviar_correo_directo(self, solicitud):
        self.correos.append(solicitud)
        return True

    def notificar(self, solicitud):
        self.emitidas.append(solicitud)
        return 1

    def resolver_avisos(self, ref_tipo, ref_id, por_cedula, tipo=None):
        self.resueltas.append((ref_tipo, ref_id, por_cedula, tipo))
        return 1


@pytest.fixture(autouse=True)
def entorno(monkeypatch):
    Almacen.objetos, Notificador.emitidas, Notificador.resueltas = {}, [], []
    Notificador.correos = []
    config = {'valor': Config(psicofisico=True)}
    monkeypatch.setattr(f'{VISTAS}.captacion_views.configuracion', lambda: config['valor'])
    monkeypatch.setattr(f'{VISTAS}.postulante_views.configuracion', lambda: config['valor'])
    monkeypatch.setattr(f'{VISTAS}.captacion_views.SeaweedFSStorage', Almacen)
    monkeypatch.setattr(f'{VISTAS}.captacion_views.obtener_notificador', lambda: Notificador())
    monkeypatch.setattr(f'{VISTAS}.postulante_views.obtener_notificador', lambda: Notificador())
    return config


def crear(cedula='12345678', nombres='Ana María', apellidos='Pérez', estado='ENVIADO_CAPTACION', cambio=None):
    postulante, exp, _ = crear_postulante_con_expediente(
        RepoPostulacionORM(), BuscadorEmpleadosORM(), Config(), cedula=cedula, nombres=nombres,
        apellidos=apellidos, creado_por='20000001',
    )
    ExpedientePostulacionModel.objects.filter(pk=exp.id).update(estado=estado)
    if cambio:
        TransicionExpedienteModel.objects.filter(expediente_id=exp.id).update(fecha=cambio)
    return exp.id


def datos(r):
    return r.json()['data']


# ------------------------------------------------------------------------------------------------ D-7 bandeja
def test_bandeja_exige_permiso_y_sesion():
    assert APIClient().get(f'{BASE}/').status_code in (401, 403)
    assert cliente('postulacion.verificar').get(f'{BASE}/').status_code == 403
    assert cliente('postulacion.ver_bandeja').get(f'{BASE}/').status_code == 200


def test_bandeja_ordena_pendientes_primero_y_luego_por_antiguedad(captacion):
    ahora = timezone.now()
    viejo_en_presupuesto = crear('1000001', estado='EN_PRESUPUESTO', cambio=ahora - timedelta(days=30))
    nuevo_enviado = crear('1000002', estado='ENVIADO_CAPTACION', cambio=ahora - timedelta(days=1))
    viejo_enviado = crear('1000003', estado='ENVIADO_CAPTACION', cambio=ahora - timedelta(days=9))
    revision = crear('1000004', estado='EN_REVISION_FINAL', cambio=ahora - timedelta(days=5))
    en_captura = crear('1000005', estado='EN_CAPTURA', cambio=ahora - timedelta(days=20))
    r = captacion.get(f'{BASE}/')
    assert r.status_code == 200
    ids = [f['id'] for f in datos(r)['resultados']]
    assert ids == [viejo_enviado, revision, nuevo_enviado, viejo_en_presupuesto, en_captura]
    fila = datos(r)['resultados'][0]
    assert set(fila) >= {'numero', 'postulante', 'estado', 'ventana', 'vence_el', 'ultimo_cambio', 'es_reingreso'}
    assert fila['postulante']['cedula'] == '1000003' and fila['pendiente_de_captacion'] is True
    assert datos(r)['total'] == 5 and r['Cache-Control'] == 'no-store'


def test_bandeja_filtra_por_estado_uno_o_varios_busqueda_y_fechas(captacion):
    ahora = timezone.now()
    crear('1000001', 'Luis', 'Gómez', 'EN_PRESUPUESTO', ahora - timedelta(days=40))
    crear('1000002', 'Ana María', 'Pérez', 'ENVIADO_CAPTACION', ahora - timedelta(days=3))
    b = crear('2000003', 'Beatriz', 'Pérez Rojas', 'EN_REVISION_FINAL', ahora - timedelta(days=10))
    numero_b = ExpedientePostulacionModel.objects.get(pk=b).numero

    def cedulas(**params):
        return sorted(f['postulante']['cedula'] for f in datos(captacion.get(f'{BASE}/', params))['resultados'])

    assert cedulas(estado='ENVIADO_CAPTACION') == ['1000002']
    assert cedulas(estado='ENVIADO_CAPTACION,EN_REVISION_FINAL') == ['1000002', '2000003']
    assert captacion.get(f'{BASE}/?estado=EN_PRESUPUESTO&estado=EN_REVISION_FINAL').json()['data']['total'] == 2
    assert cedulas(q='perez') == ['1000002', '2000003']
    assert cedulas(q='pérez rojas') == ['2000003']
    assert cedulas(q='2000003') == ['2000003']
    assert cedulas(q=numero_b) == ['2000003']
    assert cedulas(q='nadie') == []
    desde = (ahora - timedelta(days=15)).date().isoformat()
    hasta = (ahora - timedelta(days=5)).date().isoformat()
    assert cedulas(desde=desde, hasta=hasta) == ['2000003']
    assert captacion.get(f'{BASE}/', {'estado': 'INVENTADO'}).status_code == 400
    assert captacion.get(f'{BASE}/', {'desde': '2026-02-01', 'hasta': '2026-01-01'}).status_code == 400


def test_bandeja_pagina_y_marca_reingreso(captacion):
    ids = [crear(f'30000{i:02d}') for i in range(5)]
    PostulanteModel.objects.filter(cedula='3000000').update(employee_cedula='3000000')
    r = captacion.get(f'{BASE}/', {'page_size': 2, 'pagina': 2})
    d = datos(r)
    assert (d['total'], d['pagina'], d['tamano'], d['total_paginas'], len(d['resultados'])) == (5, 2, 2, 3, 2)
    todos = datos(captacion.get(f'{BASE}/', {'page_size': 50}))['resultados']
    assert {f['postulante']['cedula']: f['es_reingreso'] for f in todos}['3000000'] is True
    assert sum(f['es_reingreso'] for f in todos) == 1 and len(ids) == 5
    assert captacion.get(f'{BASE}/', {'pagina': '0'}).status_code == 400


# ------------------------------------------------------------------------------------------------ D-7 detalle
def test_detalle_trae_postulante_ventana_historial_y_acciones_segun_permiso(captacion):
    exp = crear()
    d = datos(captacion.get(f'{BASE}/{exp}/'))
    assert d['postulante']['cedula'] == '12345678' and d['expediente']['estado'] == 'ENVIADO_CAPTACION'
    assert d['historial'][0]['estado_destino'] == 'PRE_REGISTRADO' and 'datos_ventana1' in d
    acciones = {a['destino']: a for a in d['acciones']}
    assert set(acciones) == {'EN_CORRECCION_DATOS', 'RECHAZADO_CAPTACION', 'EN_PRESUPUESTO'}
    assert acciones['EN_CORRECCION_DATOS']['requiere_motivo'] is True
    abrir = acciones['EN_PRESUPUESTO']
    assert abrir['requiere_propuesta'] is True and abrir['bloqueada'] is True
    assert 'psicofísico' in abrir['motivo_bloqueo']

    solo_verificar = cliente('postulacion.ver_bandeja', 'postulacion.verificar')
    assert [a['destino'] for a in datos(solo_verificar.get(f'{BASE}/{exp}/'))['acciones']] == ['EN_CORRECCION_DATOS']
    solo_ver = cliente('postulacion.ver_bandeja')
    assert datos(solo_ver.get(f'{BASE}/{exp}/'))['acciones'] == []
    assert cliente('postulacion.verificar').get(f'{BASE}/{exp}/').status_code == 403
    assert captacion.get(f'{BASE}/00000000-0000-4000-8000-000000000000/').status_code == 404


def test_detalle_de_un_expediente_final_no_ofrece_acciones(captacion):
    exp = crear(estado='RECHAZADO_CAPTACION')
    assert datos(captacion.get(f'{BASE}/{exp}/'))['acciones'] == []


# ------------------------------------------------------------------------------------------------ D-7 transiciones
def transicion(c, exp, destino, **extra):
    return c.post(f'{BASE}/{exp}/transicion/', {'destino': destino, **extra}, format='json')


def codigo(r):
    return (r.json().get('data') or {}).get('codigo')


def test_devolver_con_observaciones_exige_motivo_y_reabre_la_ventana(captacion):
    exp = crear()
    r = transicion(captacion, exp, 'EN_CORRECCION_DATOS')
    assert r.status_code == 400 and codigo(r) == 'MOTIVO_OBLIGATORIO'
    r = transicion(captacion, exp, 'EN_CORRECCION_DATOS', motivo='Falta el segundo apellido')
    assert r.status_code == 200, r.content
    assert datos(r)['expediente']['estado'] == 'EN_CORRECCION_DATOS' and datos(r)['expediente']['ventana'] == 1
    ultimo = TransicionExpedienteModel.objects.filter(expediente_id=exp).order_by('fecha', 'created_at').last()
    assert (ultimo.estado_origen, ultimo.estado_destino, ultimo.motivo) == (
        'ENVIADO_CAPTACION', 'EN_CORRECCION_DATOS', 'Falta el segundo apellido')
    assert ultimo.actor_tipo == 'USUARIO' and ultimo.actor_cedula == '20000001'
    aud = AuditoriaLog.objects.get(accion='EXPEDIENTE_TRANSICION')
    assert aud.estado_nuevo['destino'] == 'EN_CORRECCION_DATOS' and aud.estado_nuevo['origen'] == 'ENVIADO_CAPTACION'


def test_rechazar_pide_motivo_y_deja_el_expediente_final(captacion):
    exp = crear()
    assert codigo(transicion(captacion, exp, 'RECHAZADO_CAPTACION')) == 'MOTIVO_OBLIGATORIO'
    assert transicion(captacion, exp, 'RECHAZADO_CAPTACION', motivo='No cumple el perfil').status_code == 200
    r = transicion(captacion, exp, 'EN_CORRECCION_DATOS', motivo='x')
    assert r.status_code == 409 and codigo(r) == 'EXPEDIENTE_FINAL'


def test_transiciones_ilegales_destino_inexistente_y_ajenas_al_flujo(captacion):
    exp = crear(estado='EN_CAPTURA')
    r = transicion(captacion, exp, 'LISTO_PARA_ASIGNAR')
    assert r.status_code == 409 and codigo(r) == 'TRANSICION_NO_PERMITIDA'
    assert codigo(transicion(captacion, exp, 'NO_EXISTE')) == 'DESTINO_INVALIDO'
    presupuesto = crear('1000009', estado='EN_PRESUPUESTO')
    r = transicion(captacion, presupuesto, 'EN_DIRECCION_GENERAL')  # es de Presupuesto, no de Captación
    assert r.status_code == 409 and codigo(r) == 'TRANSICION_NO_PERMITIDA'
    assert transicion(captacion, '00000000-0000-4000-8000-000000000000', 'EN_PRESUPUESTO').status_code == 404


def test_transicion_sin_permiso_se_rechaza(captacion):
    exp = crear()
    assert transicion(cliente('postulacion.ver_bandeja'), exp, 'EN_CORRECCION_DATOS', motivo='x').status_code == 403
    r = transicion(cliente('postulacion.ver_bandeja', 'postulacion.verificar'), exp, 'RECHAZADO_CAPTACION', motivo='x')
    assert r.status_code == 403 and codigo(r) == 'SIN_PERMISO'
    assert APIClient().post(f'{BASE}/{exp}/transicion/', {'destino': 'RECHAZADO_CAPTACION'}, format='json').status_code in (401, 403)
    assert ExpedientePostulacionModel.objects.get(pk=exp).estado == 'ENVIADO_CAPTACION'


@pytest.fixture
def catalogos():
    cargo = DenominacionCargoModel.objects.create(cargo='ANALISTA')
    dep = DependenciaModel.objects.create(Codigo='D1', dependencia='SEDE')
    dg = DireccionGeneralModel.objects.create(Codigo='G1', direccion_general='RECURSOS HUMANOS', dependenciaId=dep)
    otra = DireccionGeneralModel.objects.create(Codigo='G2', direccion_general='LEGAL', dependenciaId=dep)
    return {'cargo': cargo.pk, 'dg': dg.pk, 'otra_dg': otra.pk, 'dep': dep.pk}


def test_abrir_hacia_presupuesto_valida_cargo_y_oficina_contra_los_catalogos(captacion, entorno, catalogos):
    entorno['valor'] = Config(psicofisico=False)
    exp = crear()
    r = transicion(captacion, exp, 'EN_PRESUPUESTO')
    assert r.status_code == 400 and codigo(r) == 'CARGO_Y_OFICINA_REQUERIDOS'
    r = transicion(captacion, exp, 'EN_PRESUPUESTO', datos={'cargo_id': 999999, 'dependencia_id': catalogos['dep']})
    assert r.status_code == 400 and codigo(r) == 'PROPUESTA_INVALIDA' and 'cargo' in r.json()['message'].lower()
    r = transicion(captacion, exp, 'EN_PRESUPUESTO', datos={'cargo_id': 'abc'})
    assert codigo(r) == 'PROPUESTA_INVALIDA'
    r = transicion(captacion, exp, 'EN_PRESUPUESTO', datos={'cargo_id': catalogos['cargo'], 'sueldo': 5})
    assert codigo(r) == 'PROPUESTA_INVALIDA'
    r = transicion(captacion, exp, 'EN_PRESUPUESTO', datos={'cargo_id': catalogos['cargo'], 'dependencia_id': 999999})
    assert codigo(r) == 'PROPUESTA_INVALIDA'
    otra_dep = DependenciaModel.objects.create(Codigo='D2', dependencia='REGIONAL').pk
    r = transicion(captacion, exp, 'EN_PRESUPUESTO', datos={
        'cargo_id': catalogos['cargo'], 'dependencia_id': otra_dep, 'direccion_general_id': catalogos['dg']})
    assert codigo(r) == 'PROPUESTA_INVALIDA' and 'no pertenece' in r.json()['message']
    assert ExpedientePostulacionModel.objects.get(pk=exp).estado == 'ENVIADO_CAPTACION'

    r = transicion(captacion, exp, 'EN_PRESUPUESTO', datos={
        'cargo_id': catalogos['cargo'], 'dependencia_id': catalogos['dep'], 'direccion_general_id': catalogos['dg'],
        'cargo_texto': 'Analista de personal', 'oficina_texto': 'RRHH'})
    assert r.status_code == 200, r.content
    p = datos(r)['expediente']['propuesta']
    assert (p['cargo_id'], p['dependencia_id'], p['direccion_general_id'], p['cargo_texto']) == (
        catalogos['cargo'], catalogos['dep'], catalogos['dg'], 'Analista de personal')
    assert datos(r)['expediente']['estado'] == 'EN_PRESUPUESTO'


def test_abrir_sin_texto_completa_cargo_y_oficina_con_los_nombres_del_catalogo(captacion, entorno, catalogos):
    """Si Captación elige del catálogo sin escribir texto, los listados deben mostrar los nombres (antes «sin texto»)."""
    from apps.cargos.infrastructure.models.cargo_models import DenominacionCargoModel
    from apps.organizacion.infrastructure.models.organizacion_models import DireccionGeneralModel

    entorno['valor'] = Config(psicofisico=False)
    exp = crear()
    r = transicion(captacion, exp, 'EN_PRESUPUESTO', datos={
        'cargo_id': catalogos['cargo'], 'dependencia_id': catalogos['dep'], 'direccion_general_id': catalogos['dg']})
    assert r.status_code == 200, r.content
    p = datos(r)['expediente']['propuesta']
    assert p['cargo_texto'] == DenominacionCargoModel.objects.get(pk=catalogos['cargo']).cargo
    assert DireccionGeneralModel.objects.get(pk=catalogos['dg']).direccion_general in p['oficina_texto']


def test_abrir_acepta_cargo_y_oficina_solo_en_texto(captacion, entorno):
    entorno['valor'] = Config(psicofisico=False)
    exp = crear()
    r = transicion(captacion, exp, 'EN_PRESUPUESTO', datos={'cargo_texto': 'Chofer', 'oficina_texto': 'Transporte'})
    assert r.status_code == 200, r.content


def test_datos_solo_se_aceptan_al_abrir_hacia_presupuesto(captacion):
    exp = crear()
    r = transicion(captacion, exp, 'RECHAZADO_CAPTACION', motivo='x', datos={'cargo_id': 1})
    assert r.status_code == 400 and codigo(r) == 'PROPUESTA_INVALIDA'


def test_flujo_de_la_ventana_2_reabrir_observar_y_conforme(captacion):
    aprobado = crear('1000001', estado='APROBADO')
    r = transicion(captacion, aprobado, 'CONSOLIDANDO')
    assert r.status_code == 200 and datos(r)['expediente']['ventana'] == 2
    revision = crear('1000002', estado='EN_REVISION_FINAL')
    assert codigo(transicion(captacion, revision, 'CONSOLIDANDO')) == 'MOTIVO_OBLIGATORIO'
    r = transicion(captacion, revision, 'CONSOLIDANDO', motivo='Falta el acta de nacimiento')
    assert r.status_code == 200 and datos(r)['expediente']['estado'] == 'CONSOLIDANDO'
    revision2 = crear('1000003', estado='EN_REVISION_FINAL')
    r = transicion(captacion, revision2, 'LISTO_PARA_ASIGNAR')
    assert r.status_code == 200 and datos(r)['expediente']['estado'] == 'LISTO_PARA_ASIGNAR'


# ------------------------------------------------------------------------------------------------ D-8 psicofísico
def subir(c, exp, resultado='APTO', informe=None, **extra):
    cuerpo = {'resultado': resultado, 'fecha_aplicacion': timezone.now().date().isoformat(), **extra}
    if informe is not None:
        cuerpo['informe'] = informe
    return c.post(f'{BASE}/{exp}/psicofisico/', cuerpo, format='multipart')


def pdf(nombre='informe.pdf', contenido=PDF):
    return SimpleUploadedFile(nombre, contenido, content_type='application/pdf')


def test_registrar_psicofisico_con_informe_guarda_clave_opaca_y_audita(captacion):
    exp = crear('12345678')
    r = subir(captacion, exp, 'APTO', pdf(), observaciones='Sin hallazgos')
    assert r.status_code == 200, r.content
    d = datos(r)
    assert d['resultado'] == 'APTO' and d['tiene_informe'] is True and d['informe_tamano'] == len(PDF)
    assert d['sugiere_rechazo'] is False and d['registrado_por'] == '20000001'
    fila = ResultadoPsicofisicoModel.objects.get(expediente_id=exp)
    assert fila.informe_clave.startswith('postulacion/psicofisico/') and fila.informe_clave.endswith('.pdf')
    assert '12345678' not in fila.informe_clave and len(fila.informe_sha256) == 64
    assert Almacen.objetos[fila.informe_clave] == PDF
    assert AuditoriaLog.objects.filter(accion='PSICOFISICO_REGISTRADO', recurso_id=exp).count() == 1


def test_psicofisico_sin_informe_y_sin_permiso(captacion):
    exp = crear()
    assert subir(captacion, exp, 'NO_APTO').status_code == 200
    assert datos(captacion.get(f'{BASE}/{exp}/psicofisico/'))['sugiere_rechazo'] is True
    assert cliente('postulacion.ver_bandeja').post(f'{BASE}/{exp}/psicofisico/', {}, format='multipart').status_code == 403
    assert cliente('postulacion.registrar_psicofisico').get(f'{BASE}/{exp}/psicofisico/').status_code == 403
    assert captacion.get(f'{BASE}/{exp}/psicofisico/informe/').status_code == 404  # sin informe


@pytest.mark.parametrize('archivo,fragmento', [
    (lambda: SimpleUploadedFile('x.txt', b'hola', content_type='text/plain'), 'no permitido'),
    (lambda: SimpleUploadedFile('x.pdf', b'<html>no soy pdf</html>', content_type='application/pdf'), 'no corresponde'),
    (lambda: SimpleUploadedFile('x.pdf', b'%PDF-' + b'0' * (10 * 1024 * 1024), content_type='application/pdf'), 'tamaño'),
])
def test_informe_invalido_se_rechaza_sin_guardar_nada(captacion, archivo, fragmento):
    exp = crear()
    r = subir(captacion, exp, 'APTO', archivo())
    assert r.status_code == 400 and fragmento in r.json()['message']
    assert not ResultadoPsicofisicoModel.objects.exists() and Almacen.objetos == {}


def test_resultado_y_fecha_invalidos(captacion):
    exp = crear()
    assert captacion.post(f'{BASE}/{exp}/psicofisico/', {'resultado': 'TAL', 'fecha_aplicacion': '2026-01-01'},
                          format='multipart').status_code == 400
    futura = (timezone.now() + timedelta(days=3)).date().isoformat()
    r = subir(captacion, exp, 'APTO', fecha_aplicacion=futura)
    assert r.status_code == 400 and codigo(r) == 'FECHA_INVALIDA'


def test_corregir_el_resultado_reemplaza_el_informe_y_borra_el_anterior(captacion, django_capture_on_commit_callbacks):
    exp = crear()
    subir(captacion, exp, 'NO_APTO', pdf())
    vieja = ResultadoPsicofisicoModel.objects.get().informe_clave
    r = subir(captacion, exp, 'APTO')  # sin informe nuevo: conserva el anterior
    assert datos(r)['resultado'] == 'APTO' and datos(r)['tiene_informe'] is True
    assert ResultadoPsicofisicoModel.objects.count() == 1 and vieja in Almacen.objetos
    nuevo = PDF + b'\n% corregido'
    with django_capture_on_commit_callbacks(execute=True):
        r = subir(captacion, exp, 'APTO', pdf(contenido=nuevo))
    assert r.status_code == 200
    clave = ResultadoPsicofisicoModel.objects.get().informe_clave
    assert clave != vieja and Almacen.objetos[clave] == nuevo and vieja not in Almacen.objetos
    assert ResultadoPsicofisicoModel.objects.count() == 1


def test_no_se_registra_psicofisico_en_un_expediente_que_ya_paso_a_presupuesto(captacion):
    exp = crear(estado='EN_PRESUPUESTO')
    r = subir(captacion, exp, 'APTO')
    assert r.status_code == 409 and codigo(r) == 'PSICOFISICO_NO_EDITABLE'


def test_descarga_del_informe_como_adjunto_con_permiso(captacion):
    exp = crear()
    numero = ExpedientePostulacionModel.objects.get(pk=exp).numero
    subir(captacion, exp, 'APTO', pdf())
    r = captacion.get(f'{BASE}/{exp}/psicofisico/informe/')
    assert r.status_code == 200 and r['Content-Type'] == 'application/pdf'
    assert r['Content-Disposition'] == f'attachment; filename="informe-psicofisico-{numero}.pdf"'
    assert r['X-Content-Type-Options'] == 'nosniff' and b''.join(r.streaming_content) == PDF
    assert AuditoriaLog.objects.filter(accion='INFORME_PSICOFISICO_CONSULTADO', recurso_id=exp).exists()
    assert cliente('postulacion.verificar').get(f'{BASE}/{exp}/psicofisico/informe/').status_code == 403
    assert APIClient().get(f'{BASE}/{exp}/psicofisico/informe/').status_code in (401, 403)


def test_guarda_psicofisico_obligatorio_exige_resultado_registrado(captacion, catalogos):
    exp = crear()
    propuesta = {'cargo_id': catalogos['cargo'], 'dependencia_id': catalogos['dep']}
    r = transicion(captacion, exp, 'EN_PRESUPUESTO', datos=propuesta)
    assert r.status_code == 409 and codigo(r) == 'PSICOFISICO_OBLIGATORIO'
    subir(captacion, exp, 'APTO')
    detalle = datos(captacion.get(f'{BASE}/{exp}/'))
    assert detalle['psicofisico']['resultado'] == 'APTO' and detalle['psicofisico']['obligatorio'] is True
    abrir = next(a for a in detalle['acciones'] if a['destino'] == 'EN_PRESUPUESTO')
    assert abrir['bloqueada'] is False
    assert transicion(captacion, exp, 'EN_PRESUPUESTO', datos=propuesta).status_code == 200


def test_parametro_no_obligatorio_permite_abrir_sin_psicofisico(captacion, entorno, catalogos):
    entorno['valor'] = Config(psicofisico=False)
    exp = crear()
    d = datos(captacion.get(f'{BASE}/{exp}/'))
    assert d['psicofisico'] == {'obligatorio': False, 'resultado': None}
    assert next(a for a in d['acciones'] if a['destino'] == 'EN_PRESUPUESTO')['bloqueada'] is False
    r = transicion(captacion, exp, 'EN_PRESUPUESTO', datos={'cargo_id': catalogos['cargo'], 'dependencia_id': catalogos['dep']})
    assert r.status_code == 200


def test_no_apto_no_bloquea_solo_sugiere_el_rechazo(captacion, catalogos):
    exp = crear()
    subir(captacion, exp, 'NO_APTO')
    acciones = {a['destino']: a for a in datos(captacion.get(f'{BASE}/{exp}/'))['acciones']}
    assert acciones['RECHAZADO_CAPTACION']['sugerida'] is True and acciones['RECHAZADO_CAPTACION']['bloqueada'] is False
    assert acciones['EN_PRESUPUESTO']['bloqueada'] is False and acciones['EN_CORRECCION_DATOS']['sugerida'] is False
    # Captación puede decidir abrir pese al NO_APTO: la guarda solo pide que haya resultado.
    r = transicion(captacion, exp, 'EN_PRESUPUESTO', datos={'cargo_id': catalogos['cargo'], 'dependencia_id': catalogos['dep']})
    assert r.status_code == 200


# ------------------------------------------------------------------------------------------------ D-9 avisos
def test_avisos_se_emiten_despues_del_commit_y_no_si_se_revierte(captacion, django_capture_on_commit_callbacks):
    exp = crear()
    with django_capture_on_commit_callbacks(execute=False) as callbacks:
        assert transicion(captacion, exp, 'EN_CORRECCION_DATOS', motivo='Corrija el domicilio').status_code == 200
    assert Notificador.resueltas == [] and Notificador.emitidas == []  # aún no hubo commit
    assert len(callbacks) == 1
    for cb in callbacks:
        cb()
    assert Notificador.resueltas == [('expediente_postulacion', exp, '20000001', 'EXPEDIENTE_RECIBIDO')]
    assert Notificador.emitidas == []  # al postulante no se le envía campana


def test_transicion_fallida_no_emite_ni_resuelve_nada(captacion, django_capture_on_commit_callbacks):
    exp = crear()
    with django_capture_on_commit_callbacks(execute=True):
        assert transicion(captacion, exp, 'EN_CORRECCION_DATOS').status_code == 400
    assert Notificador.resueltas == [] and Notificador.emitidas == []


def test_abrir_hacia_presupuesto_avisa_a_presupuesto_y_resuelve_el_aviso_recibido(
    captacion, entorno, catalogos, django_capture_on_commit_callbacks,
):
    entorno['valor'] = Config(psicofisico=False)
    exp = crear('12345678', 'Ana María', 'Pérez')
    with django_capture_on_commit_callbacks(execute=True):
        r = transicion(captacion, exp, 'EN_PRESUPUESTO', datos={'cargo_id': catalogos['cargo'], 'dependencia_id': catalogos['dep']})
    assert r.status_code == 200
    assert Notificador.resueltas == [('expediente_postulacion', exp, '20000001', 'EXPEDIENTE_RECIBIDO')]
    (aviso,) = Notificador.emitidas
    assert aviso.tipo == 'EXPEDIENTE_EN_PRESUPUESTO' and aviso.permiso_destino == 'postulacion.ver_solicitudes'
    assert aviso.cedula_destino == '' and aviso.modulo == 'postulacion'
    assert (aviso.ref_tipo, aviso.ref_id) == ('expediente_postulacion', exp) and aviso.enlace.startswith('/')
    assert 'Ana María Pérez' in aviso.mensaje and '12345678' not in aviso.mensaje


def test_rechazar_resuelve_el_aviso_pero_no_emite_otro(captacion, django_capture_on_commit_callbacks):
    exp = crear()
    with django_capture_on_commit_callbacks(execute=True):
        transicion(captacion, exp, 'RECHAZADO_CAPTACION', motivo='No cumple')
    assert len(Notificador.resueltas) == 1 and Notificador.emitidas == []


def postulante_envia(cedula='12345678', ventana2=False):
    """Alta + acceso + cambio de clave + borrador + envío, todo por la API; devuelve el id del expediente."""
    alta = cliente('postulacion.crear_postulante').post(
        '/api/v1/postulacion/postulantes/',
        {'cedula': cedula, 'nombres': 'Ana María', 'apellidos': 'Pérez'}, format='json').json()['data']
    anonimo = APIClient()
    r = anonimo.post('/api/v1/postulacion/acceso/', {'cedula': cedula, 'password': alta['credencial']['clave_temporal']}, format='json')
    token = r.json()['data']['token']
    r = anonimo.post('/api/v1/postulacion/cambiar-clave/', {
        'clave_actual': alta['credencial']['clave_temporal'], 'clave_nueva': 'Clave-nueva-2026'},
        format='json', HTTP_AUTHORIZATION=f'Bearer {token}')
    c = APIClient()
    c.credentials(HTTP_AUTHORIZATION=f"Bearer {r.json()['data']['token']}")
    if ventana2:
        ahora = timezone.now()
        ExpedientePostulacionModel.objects.update(estado='CONSOLIDANDO', ventana=2, ventana_vence_el=ahora + timedelta(days=5))
    else:
        c.put('/api/v1/postulacion/borrador/', {
            'nombres': 'Ana María', 'apellidos': 'Pérez',
            'datos_ventana1': {'fecha_nacimiento': '1990-05-17', 'sexo': 'F'}}, format='json')
    return alta['expediente']['id'], c


def test_el_envio_de_la_ventana_1_avisa_a_la_bandeja_de_captacion(django_capture_on_commit_callbacks):
    exp, c = postulante_envia()
    with django_capture_on_commit_callbacks(execute=True) as cbs:
        r = c.post('/api/v1/postulacion/enviar/')
    assert r.status_code == 200, r.content
    assert len(cbs) == 1 and Notificador.resueltas == []  # el postulante no resuelve avisos
    (aviso,) = Notificador.emitidas
    assert aviso.tipo == 'EXPEDIENTE_RECIBIDO' and aviso.permiso_destino == 'postulacion.ver_bandeja'
    assert (aviso.ref_tipo, aviso.ref_id, aviso.modulo) == ('expediente_postulacion', exp, 'postulacion')
    assert aviso.cedula_destino == '' and 'Ana María Pérez' in aviso.mensaje


def test_el_envio_de_la_ventana_2_avisa_revision_final(django_capture_on_commit_callbacks):
    exp, c = postulante_envia(ventana2=True)
    with django_capture_on_commit_callbacks(execute=True):
        r = c.post('/api/v1/postulacion/enviar/')
    assert r.status_code == 200, r.content
    (aviso,) = Notificador.emitidas
    assert aviso.tipo == 'EXPEDIENTE_REVISION_FINAL' and aviso.permiso_destino == 'postulacion.ver_bandeja'
    assert aviso.ref_id == exp


def test_conforme_resuelve_el_aviso_de_revision_final(captacion, django_capture_on_commit_callbacks):
    exp = crear(estado='EN_REVISION_FINAL')
    with django_capture_on_commit_callbacks(execute=True):
        transicion(captacion, exp, 'LISTO_PARA_ASIGNAR')
    assert Notificador.resueltas == [('expediente_postulacion', exp, '20000001', 'EXPEDIENTE_REVISION_FINAL')]


def test_la_clave_del_aviso_es_el_asiento_de_la_transicion_para_no_deduplicar_reenvios(django_capture_on_commit_callbacks):
    exp, c = postulante_envia()
    with django_capture_on_commit_callbacks(execute=True):
        c.post('/api/v1/postulacion/enviar/')
    primera = Notificador.emitidas[0].clave
    assert primera and TransicionExpedienteModel.objects.filter(pk=primera).exists()


# ------------------------------------------------------------------------------------------------ correo al postulante
def test_devolver_encola_correo_al_postulante_solo_tras_el_commit(captacion, django_capture_on_commit_callbacks):
    exp = crear()
    PostulanteModel.objects.update(correo='ana@correo.com')
    with django_capture_on_commit_callbacks(execute=False) as callbacks:
        assert transicion(captacion, exp, 'EN_CORRECCION_DATOS', motivo='Corrija el domicilio').status_code == 200
    assert Notificador.correos == []  # aún no hubo commit
    for cb in callbacks:
        cb()
    (c,) = Notificador.correos
    assert c.destinatario_correo == 'ana@correo.com' and c.asunto == 'Tu postulación necesita correcciones'
    assert 'Corrija el domicilio' in c.mensaje and '12345678' not in c.mensaje and c.enlace == '/postulacion/acceso'
    assert c.ref_id == exp and c.clave


def test_no_hay_correo_si_el_postulante_no_tiene_o_si_la_transicion_falla(captacion, django_capture_on_commit_callbacks):
    exp = crear()
    with django_capture_on_commit_callbacks(execute=True):
        assert transicion(captacion, exp, 'EN_CORRECCION_DATOS').status_code == 400  # sin motivo
    assert Notificador.correos == []
    with django_capture_on_commit_callbacks(execute=True):
        assert transicion(captacion, exp, 'EN_CORRECCION_DATOS', motivo='Corrija el domicilio').status_code == 200
    assert Notificador.correos == []  # el postulante no tiene correo

