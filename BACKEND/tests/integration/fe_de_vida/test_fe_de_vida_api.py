"""
Integración (BD de pruebas) de la fe de vida de pasivos: permisos, Zero-IDOR, flujo completo con doble check y
con aprobación directa, paginación y filtros, constancia PDF, evidencia inválida, cierre automático,
cobertura (C16) y el aplicador C19 contra la BD. Almacén, notificador y condición del trabajador simulados.
"""
import io
from datetime import timedelta

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone
from PIL import Image
from rest_framework.test import APIClient

from apps.autogestion.infrastructure.models.actualizacion_models import DatosComplementariosTrabajadorModel
from apps.cargos.infrastructure.models.cargo_models import (
    AsigTrabajoModel,
    DenominacionCargoEspecificoModel,
    DenominacionCargoModel,
)
from apps.catalogos.infrastructure.models.catalogo_models import (
    EstatusModel,
    NacionalidadModel,
    SexoModel,
    TipoNominaModel,
    TipoPersonalModel,
)
from apps.fe_de_vida.domain.entities.cambio_acta import CambioActa
from apps.fe_de_vida.infrastructure.adaptadores_autogestion import AplicadorCambiosActaORM, RepoCambiosActaORM
from apps.fe_de_vida.infrastructure.models.proceso_models import ProcesoFeDeVidaModel
from apps.fe_de_vida.infrastructure.models.solicitud_models import (
    ConstanciaFeDeVidaModel,
    PlantillaConstanciaModel,
    SolicitudFeDeVidaModel,
)
from apps.fe_de_vida.infrastructure.tasks.cierre_procesos_tasks import cerrar_procesos_vencidos_tarea
from apps.identidad.infrastructure.models.cuenta_models import CuentaModel, RolModel
from apps.personal.infrastructure.models.personal_models import EmployeeModel
from core.infrastructure.models.auditoria import AuditoriaLog

BASE = '/api/v1/fe-de-vida'
PASIVO, OTRO_PASIVO, SIN_CORREO, ACTIVO = '5111111', '5222222', '5333333', '5444444'
ANALISTA, ADMINISTRADORA = '20000001', '20000002'
CORREO_ALTERNO = 'alterno@correo.test'

PERMISOS_PASIVO = {'fe_de_vida.solicitar', 'fe_de_vida.ver_propia'}
PERMISOS_ANALISTA = {
    'fe_de_vida.revisar', 'fe_de_vida.check_analista', 'fe_de_vida.ver_evidencia', 'fe_de_vida.ver_panel',
    'fe_de_vida.ver_cobertura', 'fe_de_vida.verificar_constancia',
}
PERMISOS_ADMINISTRADORA = {
    'fe_de_vida.revisar', 'fe_de_vida.check_administradora', 'fe_de_vida.aprobar_directo', 'fe_de_vida.ver_evidencia',
    'fe_de_vida.ver_panel', 'fe_de_vida.gestionar_procesos', 'fe_de_vida.prorrogar',
}


class Usuario:
    is_authenticated = True
    is_active = True

    def __init__(self, cedula, permisos, pk):
        self.cedula_id, self.pk, self.id, self._permisos, self.rol = cedula, pk, pk, set(permisos), None

    def tiene_permiso(self, codigo):
        return codigo in self._permisos


class AlmacenFalso:
    objetos: dict = {}

    def subir(self, clave, contenido, mime_type='application/octet-stream'):
        self.objetos[clave] = contenido
        return clave

    def descargar_flujo(self, clave, tamano_bloque=65536):
        yield self.objetos[clave]


class NotificadorFalso:
    enviadas: list = []

    def notificar(self, solicitud):
        self.enviadas.append(solicitud)
        return 1


class ResolutorCondicion:
    def condicion_de(self, cedula):
        return 'PASIVO' if cedula in (PASIVO, OTRO_PASIVO, SIN_CORREO) else 'ACTIVO'


@pytest.fixture(autouse=True)
def entorno(monkeypatch):
    AlmacenFalso.objetos, NotificadorFalso.enviadas = {}, []
    for ruta in ('pasivo_views', 'revision_views'):
        monkeypatch.setattr(f'apps.fe_de_vida.presentation.views.{ruta}.SeaweedFSStorage', AlmacenFalso)
    monkeypatch.setattr('apps.fe_de_vida.infrastructure.receivers.SeaweedFSStorage', AlmacenFalso)
    monkeypatch.setattr('apps.fe_de_vida.infrastructure.receivers.obtener_notificador', lambda: NotificadorFalso())
    monkeypatch.setattr('core.presentation.permissions.obtener_resolutor_condicion', lambda: ResolutorCondicion())


@pytest.fixture
def datos(db):
    NacionalidadModel.objects.get_or_create(id=1, defaults={'codigo': 'V', 'nombre': 'VENEZOLANO'})
    sexo = SexoModel.objects.create(sexo='F')
    estatus = EstatusModel.objects.create(estatus='ACTIVO')
    pasivo, activo = TipoPersonalModel.objects.create(tipo_personal='PASIVO'), TipoPersonalModel.objects.create(tipo_personal='ACTIVO')
    nomina = TipoNominaModel.objects.create(nomina='JUBILADO', es_activo=False)  # pasivos = es_activo False
    dc, dce = DenominacionCargoModel.objects.create(cargo='ANALISTA'), DenominacionCargoEspecificoModel.objects.create(cargo='ANALISTA I')
    rol = RolModel.objects.create(nombre_rol='PRUEBA')
    filas = ((PASIVO, 'MARIA', 'PEREZ', f'{PASIVO}@correo.test', pasivo), (OTRO_PASIVO, 'JUAN', 'GOMEZ', f'{OTRO_PASIVO}@correo.test', pasivo),
             (SIN_CORREO, 'ROSA', 'DIAZ', None, pasivo), (ACTIVO, 'LUIS', 'RAMOS', None, activo),
             (ANALISTA, 'ANA', 'LOPEZ', None, activo), (ADMINISTRADORA, 'ELENA', 'SOTO', None, activo))
    for cedula, nombre, apellido, correo, tipo in filas:
        e = EmployeeModel.objects.create(
            cedulaidentidad=cedula, nombres=nombre, apellidos=apellido, sexoid=sexo, correo=correo, telefono_movil='04140000000',
        )
        AsigTrabajoModel.objects.create(
            employee=e, codigo=f'C-{cedula}', denominacioncargoid=dc, denominacioncargoespecificoid=dce, tiponominaid=nomina,
            estatusid=estatus, Tipo_personal=tipo,
        )
    CuentaModel.objects.create(cedula=EmployeeModel.objects.get(cedulaidentidad=PASIVO), rol=rol, password='!')
    DatosComplementariosTrabajadorModel.objects.create(cedula=PASIVO, correo_alternativo=CORREO_ALTERNO)
    PlantillaConstanciaModel.objects.create(
        version=1, titulo='CONSTANCIA DE FE DE VIDA', activa=True,
        texto='El {fecha} {nombre_completo}, C.I. {cedula}, {condicion}, compareció.',
    )
    return nomina


def cliente(cedula, permisos, pk):
    c = APIClient()
    c.force_authenticate(user=Usuario(cedula, permisos, pk))
    return c


@pytest.fixture
def pasivo(datos):
    return cliente(PASIVO, PERMISOS_PASIVO, 1)


@pytest.fixture
def otro_pasivo(datos):
    return cliente(OTRO_PASIVO, PERMISOS_PASIVO, 2)


@pytest.fixture
def analista(datos):
    return cliente(ANALISTA, PERMISOS_ANALISTA, 3)


@pytest.fixture
def administradora(datos):
    return cliente(ADMINISTRADORA, PERMISOS_ADMINISTRADORA, 4)


def cuerpo(respuesta):
    return respuesta.json()['data']


def foto(lado=600, con_exif=True, formato='JPEG'):
    buffer = io.BytesIO()
    imagen = Image.new('RGB', (lado, lado), (120, 90, 60))
    if con_exif:
        exif = Image.Exif()
        exif[0x010F] = 'CamaraSecreta'
        imagen.save(buffer, format=formato, exif=exif)
    else:
        imagen.save(buffer, format=formato)
    return SimpleUploadedFile('selfie.jpg', buffer.getvalue(), content_type='image/jpeg')


def proceso_abierto(admin, nombre='Fe de vida 2026-2027'):
    ahora = timezone.now()
    r = admin.post(f'{BASE}/procesos/', {
        'nombre': nombre, 'fecha_apertura': (ahora - timedelta(days=1)).isoformat(),
        'fecha_cierre': (ahora + timedelta(days=30)).isoformat(),
    }, format='json')
    assert r.status_code == 201, r.content
    pid = cuerpo(r)['id']
    assert admin.post(f'{BASE}/procesos/{pid}/abrir/').status_code == 200
    return pid


def solicitud_enviada(pasivo_cli, pid):
    """Camino del pasivo hasta PENDIENTE_REVISION, con un cambio de teléfono en el acta."""
    sid = cuerpo(pasivo_cli.post(f'{BASE}/procesos/vigente/solicitud/'))['id']
    r = pasivo_cli.put(f'{BASE}/mis-solicitudes/{sid}/borrador/', {'cambios': [{
        'seccion': 'contacto', 'entidad': 'employee', 'accion': 'MODIFICAR', 'campo': 'telefono_movil', 'valor': '04149999999',
    }]}, format='json')
    assert r.status_code == 200, r.content
    r = pasivo_cli.post(f'{BASE}/mis-solicitudes/{sid}/evidencia/', {'file': foto(), 'origen': 'CAMARA'}, format='multipart')
    assert r.status_code == 200, r.content
    assert pasivo_cli.post(f'{BASE}/mis-solicitudes/{sid}/enviar/').status_code == 200
    return sid


# ── Permisos ──
@pytest.mark.parametrize('metodo,ruta,quien', [
    ('get', '/procesos/vigente/', 'analista'), ('get', '/mis-solicitudes/', 'analista'),
    ('get', '/solicitudes/', 'pasivo'), ('get', '/procesos/', 'pasivo'), ('post', '/procesos/', 'analista'),
    ('get', '/cobertura/pasivos/', 'administradora'), ('get', '/constancias/verificar/abc/', 'pasivo'),
])
def test_sin_permiso_o_condicion_responde_403(request, datos, metodo, ruta, quien):
    r = getattr(request.getfixturevalue(quien), metodo)(f'{BASE}{ruta}')
    assert r.status_code == 403 and r.json()['status'] == 'error'


def test_sin_sesion_responde_401_o_403(datos):
    assert APIClient().get(f'{BASE}/solicitudes/').status_code in (401, 403)


def test_analista_no_aprueba_directo_ni_gestiona_procesos(analista, administradora, pasivo):
    pid = proceso_abierto(administradora)
    sid = solicitud_enviada(pasivo, pid)
    assert analista.post(f'{BASE}/solicitudes/{sid}/aprobar-directo/', {'justificacion': 'x'}, format='json').status_code == 403
    assert analista.post(f'{BASE}/procesos/{pid}/cerrar/').status_code == 403


# ── Zero-IDOR ──
def test_un_pasivo_no_ve_ni_opera_la_solicitud_de_otro(pasivo, otro_pasivo, administradora):
    pid = proceso_abierto(administradora)
    sid = cuerpo(pasivo.post(f'{BASE}/procesos/vigente/solicitud/'))['id']
    assert otro_pasivo.get(f'{BASE}/mis-solicitudes/{sid}/').status_code == 403
    assert otro_pasivo.post(f'{BASE}/mis-solicitudes/{sid}/enviar/').status_code == 403
    r = otro_pasivo.post(f'{BASE}/mis-solicitudes/{sid}/evidencia/', {'file': foto(), 'origen': 'ARCHIVO'}, format='multipart')
    assert r.status_code == 403
    assert otro_pasivo.get(f'{BASE}/mis-solicitudes/{sid}/constancia/').status_code == 403
    assert cuerpo(otro_pasivo.get(f'{BASE}/mis-solicitudes/'))['count'] == 0
    assert cuerpo(pasivo.get(f'{BASE}/mis-solicitudes/'))['count'] == 1
    assert pid


# ── Flujo completo: doble check ──
def test_flujo_doble_check_aplica_el_acta_emite_constancia_y_avisa(
    pasivo, analista, administradora, django_capture_on_commit_callbacks,
):
    pid = proceso_abierto(administradora)
    vigente = cuerpo(pasivo.get(f'{BASE}/procesos/vigente/'))
    assert vigente['proceso']['id'] == pid and vigente['puede_enviar'] is True
    sid = solicitud_enviada(pasivo, pid)

    avisos = {(a.tipo, a.modulo) for a in NotificadorFalso.enviadas}
    assert ('fe_de_vida.solicitud_recibida', 'autogestion') in avisos and ('fe_de_vida.solicitud_enviada', 'personal') in avisos

    detalle = cuerpo(analista.get(f'{BASE}/solicitudes/{sid}/'))
    assert detalle['solicitud']['nombre'] == 'MARIA PEREZ'
    cambio = detalle['cambios'][0]
    assert cambio['valor_actual'] == '04140000000' and cambio['valor_propuesto'] == '04149999999' and cambio['conflicto'] is False

    r = analista.get(f'{BASE}/solicitudes/{sid}/evidencia/')
    assert r.status_code == 200 and r['Content-Type'] == 'image/jpeg'
    assert b''.join(r.streaming_content).startswith(bytes([0xFF, 0xD8]))
    assert r['Cache-Control'] == 'private, no-store' and r['X-Content-Type-Options'] == 'nosniff'
    assert r['Content-Disposition'] == 'inline'
    assert AuditoriaLog.objects.filter(accion='EVIDENCIA_CONSULTADA', recurso_id=sid).exists()

    assert cuerpo(analista.post(f'{BASE}/solicitudes/{sid}/check/'))['estado'] == 'PENDIENTE_SEGUNDO_CHECK'
    assert any(a.permiso_destino == 'fe_de_vida.check_administradora' for a in NotificadorFalso.enviadas)
    # la misma persona/rol no puede repetir el check
    assert analista.post(f'{BASE}/solicitudes/{sid}/check/').status_code == 409

    with django_capture_on_commit_callbacks(execute=True):
        r = administradora.post(f'{BASE}/solicitudes/{sid}/check/')
    assert r.status_code == 200 and cuerpo(r)['estado'] == 'VALIDADA' and cuerpo(r)['via_aprobacion'] == 'DOBLE_CHECK'

    assert EmployeeModel.objects.get(cedulaidentidad=PASIVO).telefono_movil == '04149999999'  # C19
    constancia = ConstanciaFeDeVidaModel.objects.get(solicitud_id=sid)
    assert constancia.numero.startswith('FV-') and [c['cedula'] for c in constancia.certificada_por] == [ANALISTA, ADMINISTRADORA]
    assert AlmacenFalso.objetos[constancia.clave_pdf].startswith(b'%PDF')
    validada = [a for a in NotificadorFalso.enviadas if a.tipo == 'fe_de_vida.validada'][0]
    assert validada.correo.copia_a == (CORREO_ALTERNO,) and validada.correo.adjuntos[0].clave_almacen == constancia.clave_pdf

    descarga = pasivo.get(f'{BASE}/mis-solicitudes/{sid}/constancia/')
    assert descarga.status_code == 200 and b''.join(descarga.streaming_content).startswith(b'%PDF')
    assert cuerpo(analista.get(f'{BASE}/constancias/verificar/{constancia.codigo_verificacion}/'))['numero'] == constancia.numero
    assert analista.get(f'{BASE}/constancias/verificar/inexistente/').status_code == 404
    acciones = set(AuditoriaLog.objects.filter(modulo='fe_de_vida').values_list('accion', flat=True))
    assert {'SOLICITUD_INICIADA', 'BORRADOR_GUARDADO', 'EVIDENCIA_SUBIDA', 'SOLICITUD_ENVIADA', 'CHECK_DADO',
            'CONSTANCIA_DESCARGADA', 'CONSTANCIA_VERIFICADA'} <= acciones


def test_aprobacion_directa_exige_justificacion_y_certifica_solo_a_la_administradora(
    pasivo, administradora, django_capture_on_commit_callbacks,
):
    pid = proceso_abierto(administradora)
    sid = solicitud_enviada(pasivo, pid)
    assert administradora.post(f'{BASE}/solicitudes/{sid}/aprobar-directo/', {'justificacion': ' '}, format='json').status_code == 400
    with django_capture_on_commit_callbacks(execute=True):
        r = administradora.post(f'{BASE}/solicitudes/{sid}/aprobar-directo/', {'justificacion': 'Pasivo sin movilidad'}, format='json')
    assert r.status_code == 200 and cuerpo(r)['via_aprobacion'] == 'DIRECTA_ADMINISTRADORA'
    assert AuditoriaLog.objects.filter(accion='APROBACION_DIRECTA_ADMINISTRADORA', recurso_id=sid).exists()
    constancia = ConstanciaFeDeVidaModel.objects.get(solicitud_id=sid)
    assert [c['cedula'] for c in constancia.certificada_por] == [ADMINISTRADORA]


def test_repeticion_y_rechazo_notifican_con_motivo(pasivo, analista, administradora):
    pid = proceso_abierto(administradora)
    sid = solicitud_enviada(pasivo, pid)
    assert analista.post(f'{BASE}/solicitudes/{sid}/devolver/', {'motivo': ''}, format='json').status_code == 400
    r = analista.post(f'{BASE}/solicitudes/{sid}/devolver/', {'motivo': 'Foto borrosa'}, format='json')
    assert cuerpo(r)['estado'] == 'DEVUELTA'
    aviso = [a for a in NotificadorFalso.enviadas if a.tipo == 'fe_de_vida.devuelta'][0]
    assert 'Foto borrosa' in aviso.mensaje and aviso.cedula_destino == PASIVO
    # reenvío tras la repetición: nueva foto, aviso de "reenviada" a Bienestar
    assert pasivo.post(f'{BASE}/mis-solicitudes/{sid}/evidencia/', {'file': foto(), 'origen': 'ARCHIVO'}, format='multipart').status_code == 200
    assert pasivo.post(f'{BASE}/mis-solicitudes/{sid}/enviar/').status_code == 200
    assert any('reenviada' in a.titulo for a in NotificadorFalso.enviadas)
    r = administradora.post(f'{BASE}/solicitudes/{sid}/rechazar/', {'motivo': 'Cédula ilegible'}, format='json')
    assert cuerpo(r)['estado'] == 'RECHAZADA'
    assert any(a.tipo == 'fe_de_vida.rechazada' and 'Cédula ilegible' in a.mensaje for a in NotificadorFalso.enviadas)


# ── Evidencia ──
def test_evidencia_se_recodifica_sin_exif_y_registra_el_origen(pasivo, administradora):
    proceso_abierto(administradora)
    sid = cuerpo(pasivo.post(f'{BASE}/procesos/vigente/solicitud/'))['id']
    r = pasivo.post(f'{BASE}/mis-solicitudes/{sid}/evidencia/', {'file': foto(), 'origen': 'CAMARA'}, format='multipart')
    assert cuerpo(r)['origen_evidencia'] == 'CAMARA' and cuerpo(r)['tiene_evidencia'] is True
    assert 'evidencia_clave' not in cuerpo(r)
    guardada = next(iter(AlmacenFalso.objetos.values()))
    assert len(Image.open(io.BytesIO(guardada)).getexif()) == 0


@pytest.mark.parametrize('archivo,origen', [
    (SimpleUploadedFile('selfie.jpg', b'esto no es una imagen'), 'CAMARA'),                      # firma de bytes falsa
    (SimpleUploadedFile('selfie.gif', b'GIF89a'), 'ARCHIVO'),                                      # extensión no permitida
    (SimpleUploadedFile('selfie.jpg', b'\xff\xd8\xff' + b'0' * 50), 'ARCHIVO'),                   # firma válida, imagen corrupta
])
def test_evidencia_invalida_se_rechaza_y_se_audita(pasivo, administradora, archivo, origen):
    proceso_abierto(administradora)
    sid = cuerpo(pasivo.post(f'{BASE}/procesos/vigente/solicitud/'))['id']
    r = pasivo.post(f'{BASE}/mis-solicitudes/{sid}/evidencia/', {'file': archivo, 'origen': origen}, format='multipart')
    assert r.status_code == 400 and r.json()['status'] == 'error'
    assert AlmacenFalso.objetos == {}
    assert AuditoriaLog.objects.filter(accion='EVIDENCIA_RECHAZADA_POR_CALIDAD', recurso_id=sid).exists()


def test_evidencia_muy_pequena_o_origen_invalido_se_rechaza(pasivo, administradora):
    proceso_abierto(administradora)
    sid = cuerpo(pasivo.post(f'{BASE}/procesos/vigente/solicitud/'))['id']
    r = pasivo.post(f'{BASE}/mis-solicitudes/{sid}/evidencia/', {'file': foto(lado=50), 'origen': 'CAMARA'}, format='multipart')
    assert r.status_code == 400 and 'pequeña' in r.json()['message']
    r = pasivo.post(f'{BASE}/mis-solicitudes/{sid}/evidencia/', {'file': foto(), 'origen': 'OTRO'}, format='multipart')
    assert r.status_code == 400 and AlmacenFalso.objetos == {}


def test_no_se_envia_sin_foto(pasivo, administradora):
    proceso_abierto(administradora)
    sid = cuerpo(pasivo.post(f'{BASE}/procesos/vigente/solicitud/'))['id']
    assert pasivo.post(f'{BASE}/mis-solicitudes/{sid}/enviar/').status_code == 400


# ── Paginación y filtros ──
def test_bandeja_pagina_y_filtra(analista, administradora, pasivo):
    pid = proceso_abierto(administradora)
    otro_proceso = ProcesoFeDeVidaModel.objects.create(
        nombre='Otro', fecha_apertura=timezone.now() - timedelta(days=9), fecha_cierre=timezone.now() + timedelta(days=9),
    )
    ahora = timezone.now()
    for i in range(12):
        SolicitudFeDeVidaModel.objects.create(
            proceso_id=pid, cedula=f'60000{i:02d}', estado='PENDIENTE_REVISION', fecha_envio=ahora - timedelta(days=i),
        )
    SolicitudFeDeVidaModel.objects.create(proceso=otro_proceso, cedula=OTRO_PASIVO, estado='VALIDADA', fecha_envio=ahora)
    SolicitudFeDeVidaModel.objects.create(proceso_id=pid, cedula=PASIVO, estado='BORRADOR')

    pag = cuerpo(analista.get(f'{BASE}/solicitudes/'))
    assert pag['count'] == 14 and pag['limit'] == 10 and len(pag['results']) == 10
    assert len(cuerpo(analista.get(f'{BASE}/solicitudes/?limit=500'))['results']) == 14
    assert cuerpo(analista.get(f'{BASE}/solicitudes/?limit=500'))['limit'] == 50
    assert len(cuerpo(analista.get(f'{BASE}/solicitudes/?limit=10&offset=10'))['results']) == 4
    assert cuerpo(analista.get(f'{BASE}/solicitudes/?estado=VALIDADA'))['count'] == 1
    assert cuerpo(analista.get(f'{BASE}/solicitudes/?proceso_id={otro_proceso.id}'))['count'] == 1
    assert cuerpo(analista.get(f'{BASE}/solicitudes/?texto=6000003'))['count'] == 1
    por_nombre = cuerpo(analista.get(f'{BASE}/solicitudes/?texto=gomez juan'))
    assert por_nombre['count'] == 1 and por_nombre['results'][0]['nombre'] == 'JUAN GOMEZ'
    desde = (ahora - timedelta(days=2)).date().isoformat()
    assert cuerpo(analista.get(f'{BASE}/solicitudes/?desde={desde}'))['count'] == 4  # i=0,1,2 y el otro proceso
    hasta = (ahora - timedelta(days=10)).date().isoformat()
    assert cuerpo(analista.get(f'{BASE}/solicitudes/?hasta={hasta}'))['count'] == 2
    assert analista.get(f'{BASE}/solicitudes/?estado=INVENTADO').status_code == 400
    assert analista.get(f'{BASE}/solicitudes/?desde=2026-12-31&hasta=2026-01-01').status_code == 400
    assert analista.get(f'{BASE}/solicitudes/?limit=0').status_code == 400


def test_historial_del_pasivo_pagina_y_filtra(pasivo, administradora):
    for i in range(3):
        p = ProcesoFeDeVidaModel.objects.create(
            nombre=f'P{i}', fecha_apertura=timezone.now() - timedelta(days=30 - i), fecha_cierre=timezone.now() + timedelta(days=5),
        )
        SolicitudFeDeVidaModel.objects.create(proceso=p, cedula=PASIVO, estado='VALIDADA' if i else 'BORRADOR')
    historial = cuerpo(pasivo.get(f'{BASE}/mis-solicitudes/?limit=2'))
    assert historial['count'] == 3 and len(historial['results']) == 2
    assert cuerpo(pasivo.get(f'{BASE}/mis-solicitudes/?estado=VALIDADA'))['count'] == 2


# ── Procesos y prórrogas ──
def test_procesos_crear_listar_prorrogar_y_cerrar(administradora, analista, pasivo):
    pid = proceso_abierto(administradora)
    assert cuerpo(administradora.get(f'{BASE}/procesos/?estado=ABIERTO'))['count'] == 1
    assert cuerpo(analista.get(f'{BASE}/procesos/?limit=1'))['limit'] == 1
    ahora = timezone.now()
    r = administradora.post(f'{BASE}/procesos/', {
        'nombre': 'Invertido', 'fecha_apertura': ahora.isoformat(), 'fecha_cierre': (ahora - timedelta(days=1)).isoformat(),
    }, format='json')
    assert r.status_code == 400
    sid = cuerpo(pasivo.post(f'{BASE}/procesos/vigente/solicitud/'))['id']
    assert administradora.post(f'{BASE}/procesos/{pid}/cerrar/').status_code == 200
    assert cuerpo(pasivo.get(f'{BASE}/procesos/vigente/')) is None
    assert cuerpo(pasivo.get(f'{BASE}/mis-solicitudes/{sid}/'))['solicitud']['estado'] == 'EXPIRADA'
    # prórroga individual: rehabilita la solicitud y devuelve el proceso como vigente solo para esa cédula
    assert analista.post(f'{BASE}/procesos/{pid}/prorrogas/', {}, format='json').status_code == 403
    r = administradora.post(f'{BASE}/procesos/{pid}/prorrogas/', {
        'nueva_fecha_limite': (ahora + timedelta(days=3)).isoformat(), 'motivo': 'Viaje', 'cedula': PASIVO,
    }, format='json')
    assert r.status_code == 201 and cuerpo(r)['general'] is False
    assert cuerpo(pasivo.get(f'{BASE}/procesos/vigente/'))['puede_enviar'] is True
    assert cuerpo(pasivo.get(f'{BASE}/mis-solicitudes/{sid}/'))['solicitud']['estado'] == 'BORRADOR'
    listado = cuerpo(analista.get(f'{BASE}/procesos/{pid}/prorrogas/'))
    assert listado['count'] == 1 and listado['results'][0]['cedula'] == PASIVO
    assert AuditoriaLog.objects.filter(accion='PRORROGA_CONCEDIDA').exists()
    assert administradora.post(f'{BASE}/procesos/{pid}/prorrogas/', {'nueva_fecha_limite': 'ayer', 'motivo': 'x'}, format='json').status_code == 400


def test_beat_cierra_procesos_vencidos_y_expira_solicitudes_sin_enviar(datos):
    ahora = timezone.now()
    vencido = ProcesoFeDeVidaModel.objects.create(
        nombre='Vencido', estado='ABIERTO', fecha_apertura=ahora - timedelta(days=10), fecha_cierre=ahora - timedelta(minutes=1),
    )
    vigente = ProcesoFeDeVidaModel.objects.create(
        nombre='Vigente', estado='ABIERTO', fecha_apertura=ahora - timedelta(days=1), fecha_cierre=ahora + timedelta(days=1),
    )
    borrador = SolicitudFeDeVidaModel.objects.create(proceso=vencido, cedula=PASIVO)
    enviada = SolicitudFeDeVidaModel.objects.create(proceso=vencido, cedula=OTRO_PASIVO, estado='PENDIENTE_REVISION')
    assert cerrar_procesos_vencidos_tarea() == 1
    vencido.refresh_from_db(), vigente.refresh_from_db(), borrador.refresh_from_db(), enviada.refresh_from_db()
    assert (vencido.estado, vigente.estado) == ('CERRADO', 'ABIERTO')
    assert (borrador.estado, enviada.estado) == ('EXPIRADA', 'PENDIENTE_REVISION')
    assert cerrar_procesos_vencidos_tarea() == 0  # idempotente


# ── Cobertura (C16) ──
def test_cobertura_lista_pasivos_sin_correo_o_sin_cuenta(analista, datos):
    todos = cuerpo(analista.get(f'{BASE}/cobertura/pasivos/'))
    cedulas = {f['cedula'] for f in todos['results']}
    assert cedulas == {OTRO_PASIVO, SIN_CORREO}  # PASIVO tiene correo y cuenta; el activo no es pasivo
    sin_correo = cuerpo(analista.get(f'{BASE}/cobertura/pasivos/?sin_correo=true'))
    assert [f['cedula'] for f in sin_correo['results']] == [SIN_CORREO] and sin_correo['results'][0]['sin_correo'] is True
    sin_cuenta = cuerpo(analista.get(f'{BASE}/cobertura/pasivos/?sin_cuenta=true&limit=1'))
    assert sin_cuenta['count'] == 2 and len(sin_cuenta['results']) == 1 and sin_cuenta['results'][0]['tipo_nomina'] == 'JUBILADO'
    assert cuerpo(analista.get(f'{BASE}/cobertura/pasivos/?texto=rosa'))['count'] == 1
    assert cuerpo(analista.get(f'{BASE}/cobertura/pasivos/?tipo_nomina_id={datos.id}'))['count'] == 2
    assert cuerpo(analista.get(f'{BASE}/cobertura/pasivos/?tipo_nomina_id=99999'))['count'] == 0
    assert AuditoriaLog.objects.filter(accion='COBERTURA_CONSULTADA').exists()


# ── Aplicador C19 contra la BD de pruebas ──
def test_aplicador_c19_aprueba_y_escribe_en_la_ficha_real(datos, administradora):
    pid = proceso_abierto(administradora)
    solicitud = SolicitudFeDeVidaModel.objects.create(proceso_id=pid, cedula=PASIVO, estado='VALIDADA')
    RepoCambiosActaORM().reemplazar(str(solicitud.id), [
        CambioActa('contacto', 'MODIFICAR', 'employee', 'telefono_movil', '04125550000', valor_anterior='04140000000'),
    ])
    aplicados = AplicadorCambiosActaORM().aplicar(str(solicitud.id), PASIVO, ADMINISTRADORA, timezone.now())
    assert aplicados == 1
    assert EmployeeModel.objects.get(cedulaidentidad=PASIVO).telefono_movil == '04125550000'
    # los cambios quedaron marcados como aprobados: ya no hay pendientes que decidir
    pendientes = [c for c in RepoCambiosActaORM().listar(str(solicitud.id))]
    assert len(pendientes) == 1


# ── Decisión H: devolver para corrección ──
def test_devolver_exige_motivo_conserva_o_retira_la_foto_y_permite_corregir_y_reenviar(pasivo, analista, administradora):
    pid = proceso_abierto(administradora)
    sid = solicitud_enviada(pasivo, pid)
    assert analista.post(f'{BASE}/solicitudes/{sid}/devolver/', {'motivo': ' '}, format='json').status_code == 400
    assert analista.post(f'{BASE}/solicitudes/{sid}/solicitar-repeticion/', {'motivo': 'x'}, format='json').status_code == 404
    r = analista.post(f'{BASE}/solicitudes/{sid}/devolver/', {'motivo': 'Teléfono ilegible'}, format='json')
    d = cuerpo(r)
    assert r.status_code == 200 and d['estado'] == 'DEVUELTA' and d['requiere_nueva_foto'] is False and d['tiene_evidencia'] is True
    aviso = [a for a in NotificadorFalso.enviadas if a.tipo == 'fe_de_vida.devuelta'][0]
    assert 'devuelta para corrección' in aviso.titulo and 'Teléfono ilegible' in aviso.mensaje
    # corrige los datos del acta (sin foto nueva) y reenvía
    r = pasivo.put(f'{BASE}/mis-solicitudes/{sid}/borrador/', {'cambios': [{
        'seccion': 'contacto', 'entidad': 'employee', 'accion': 'MODIFICAR', 'campo': 'telefono_movil', 'valor': '04148888888',
    }]}, format='json')
    assert r.status_code == 200
    assert pasivo.post(f'{BASE}/mis-solicitudes/{sid}/enviar/').status_code == 200
    # devolución con foto nueva: sin foto no reenvía
    r = administradora.post(f'{BASE}/solicitudes/{sid}/devolver/', {'motivo': 'Foto borrosa', 'requiere_nueva_foto': True}, format='json')
    assert cuerpo(r)['requiere_nueva_foto'] is True and cuerpo(r)['tiene_evidencia'] is False
    assert pasivo.post(f'{BASE}/mis-solicitudes/{sid}/enviar/').status_code == 400
    assert pasivo.post(f'{BASE}/mis-solicitudes/{sid}/evidencia/', {'file': foto(), 'origen': 'ARCHIVO'}, format='multipart').status_code == 200
    assert cuerpo(pasivo.post(f'{BASE}/mis-solicitudes/{sid}/enviar/'))['requiere_nueva_foto'] is False
    assert AuditoriaLog.objects.filter(accion='SOLICITUD_DEVUELTA').count() == 2


def test_rechazar_es_definitivo_y_exige_motivo(pasivo, analista, administradora):
    pid = proceso_abierto(administradora)
    sid = solicitud_enviada(pasivo, pid)
    assert analista.post(f'{BASE}/solicitudes/{sid}/rechazar/', {'motivo': ''}, format='json').status_code == 400
    assert cuerpo(analista.post(f'{BASE}/solicitudes/{sid}/rechazar/', {'motivo': 'Falsa'}, format='json'))['estado'] == 'RECHAZADA'
    assert pasivo.put(f'{BASE}/mis-solicitudes/{sid}/borrador/', {'cambios': []}, format='json').status_code == 400
    assert analista.post(f'{BASE}/solicitudes/{sid}/devolver/', {'motivo': 'x'}, format='json').status_code == 409


def test_permisos_de_procesos_y_prorrogas_son_solo_de_la_administradora(analista, administradora, pasivo):
    pid = proceso_abierto(administradora)
    assert analista.post(f'{BASE}/procesos/', {}, format='json').status_code == 403
    assert analista.patch(f'{BASE}/procesos/{pid}/', {'dias_recordatorio': [1]}, format='json').status_code == 403
    assert analista.post(f'{BASE}/procesos/{pid}/abrir/').status_code == 403
    assert analista.post(f'{BASE}/procesos/{pid}/prorrogas/', {}, format='json').status_code == 403
    assert analista.get(f'{BASE}/procesos/{pid}/prorrogas/').status_code == 200   # el panel sí las consulta
    assert analista.get(f'{BASE}/procesos/tipos-pension/').status_code == 200
    assert pasivo.get(f'{BASE}/procesos/tipos-pension/').status_code == 403


# ── Decisión H: alcance por tipo de pensión ──
@pytest.fixture
def pensionado(datos):
    """Segundo tipo de pensión; OTRO_PASIVO pasa a ser pensionado. Hay además una nómina activa (no de pasivos)."""
    tipo = TipoNominaModel.objects.create(nomina='PENSIONADO', es_activo=False)
    TipoNominaModel.objects.create(nomina='OBREROS', es_activo=True)
    AsigTrabajoModel.objects.filter(employee_id=OTRO_PASIVO).update(tiponominaid=tipo)
    return tipo


def crear_proceso(admin, **extra):
    ahora = timezone.now()
    return admin.post(f'{BASE}/procesos/', {
        'nombre': 'Alcance', 'fecha_apertura': (ahora - timedelta(days=1)).isoformat(),
        'fecha_cierre': (ahora + timedelta(days=30)).isoformat(), **extra,
    }, format='json')


def test_catalogo_tipos_pension_devuelve_solo_nominas_de_pasivos(administradora, pensionado, datos):
    r = administradora.get(f'{BASE}/procesos/tipos-pension/')
    assert r.status_code == 200
    assert cuerpo(r) == [{'id': datos.id, 'nombre': 'JUBILADO'}, {'id': pensionado.id, 'nombre': 'PENSIONADO'}]


def test_alcance_rechaza_nomina_activa_o_inexistente_y_acepta_las_de_pasivos(administradora, pensionado, datos):
    activa = TipoNominaModel.objects.get(nomina='OBREROS')
    assert crear_proceso(administradora, tipos_nomina=[activa.id]).status_code == 400
    assert crear_proceso(administradora, tipos_nomina=[99999]).status_code == 400
    assert crear_proceso(administradora, tipos_nomina=[0]).status_code == 400
    r = crear_proceso(administradora, tipos_nomina=[pensionado.id], dias_recordatorio=[1, 7, 3])
    assert r.status_code == 201
    assert cuerpo(r)['tipos_nomina'] == [{'id': pensionado.id, 'nombre': 'PENSIONADO'}]
    assert cuerpo(r)['dias_recordatorio'] == [7, 3, 1]
    assert crear_proceso(administradora, dias_recordatorio=[3, 3]).status_code == 400
    assert crear_proceso(administradora, dias_recordatorio=[0]).status_code == 400
    assert cuerpo(crear_proceso(administradora))['tipos_nomina'] == []


def test_solo_los_pasivos_del_alcance_ven_inician_y_envian(administradora, pasivo, otro_pasivo, pensionado, datos):
    pid = cuerpo(crear_proceso(administradora, tipos_nomina=[pensionado.id]))['id']
    assert administradora.post(f'{BASE}/procesos/{pid}/abrir/').status_code == 200
    # PASIVO es JUBILADO: fuera del alcance. OTRO_PASIVO es PENSIONADO: dentro.
    assert cuerpo(pasivo.get(f'{BASE}/procesos/vigente/')) is None
    assert pasivo.post(f'{BASE}/procesos/vigente/solicitud/').status_code == 409
    vigente = cuerpo(otro_pasivo.get(f'{BASE}/procesos/vigente/'))
    assert vigente['proceso']['tipos_nomina'] == [{'id': pensionado.id, 'nombre': 'PENSIONADO'}]
    assert otro_pasivo.post(f'{BASE}/procesos/vigente/solicitud/').status_code == 200
    assert pasivo.post(f'{BASE}/procesos/{pid}/abrir/').status_code == 403


def test_proceso_sin_alcance_aplica_a_todos_los_pasivos(administradora, pasivo, otro_pasivo, pensionado):
    pid = proceso_abierto(administradora)
    assert cuerpo(pasivo.get(f'{BASE}/procesos/vigente/')) is not None
    assert cuerpo(otro_pasivo.get(f'{BASE}/procesos/vigente/'))['proceso']['id'] == pid


def test_editar_proceso_alcance_en_borrador_y_solo_recordatorios_si_esta_abierto(administradora, pensionado, datos):
    import uuid
    pid = cuerpo(crear_proceso(administradora, tipos_nomina=[datos.id]))['id']
    r = administradora.patch(f'{BASE}/procesos/{pid}/', {'tipos_nomina': [pensionado.id], 'nombre': ' Nuevo '}, format='json')
    assert r.status_code == 200 and cuerpo(r)['tipos_nomina'][0]['id'] == pensionado.id and cuerpo(r)['nombre'] == 'Nuevo'
    assert cuerpo(administradora.patch(f'{BASE}/procesos/{pid}/', {'tipos_nomina': []}, format='json'))['tipos_nomina'] == []
    assert administradora.patch(f'{BASE}/procesos/{pid}/', {}, format='json').status_code == 400
    activa = TipoNominaModel.objects.get(nomina='OBREROS')
    assert administradora.patch(f'{BASE}/procesos/{pid}/', {'tipos_nomina': [activa.id]}, format='json').status_code == 400
    administradora.post(f'{BASE}/procesos/{pid}/abrir/')
    assert administradora.patch(f'{BASE}/procesos/{pid}/', {'tipos_nomina': [datos.id]}, format='json').status_code == 409
    assert cuerpo(administradora.patch(f'{BASE}/procesos/{pid}/', {'dias_recordatorio': [2]}, format='json'))['dias_recordatorio'] == [2]
    administradora.post(f'{BASE}/procesos/{pid}/cerrar/')
    assert administradora.patch(f'{BASE}/procesos/{pid}/', {'dias_recordatorio': [1]}, format='json').status_code == 409
    assert administradora.patch(f'{BASE}/procesos/{uuid.uuid4()}/', {'nombre': 'x'}, format='json').status_code == 404
    assert AuditoriaLog.objects.filter(accion='PROCESO_EDITADO').exists()


def test_cobertura_respeta_el_filtro_por_tipo_de_pension(analista, pensionado, datos):
    r = analista.get(f'{BASE}/cobertura/pasivos/?tipo_nomina_id={pensionado.id}&sin_cuenta=true')
    assert [f['cedula'] for f in cuerpo(r)['results']] == [OTRO_PASIVO]


# ── C8: recordatorios previos al cierre ──
def test_beat_de_recordatorios_avisa_solo_a_pasivos_del_alcance_sin_solicitud_enviada(administradora, pasivo, otro_pasivo, pensionado):
    from apps.fe_de_vida.infrastructure.tasks.recordatorios_tasks import enviar_recordatorios_tarea
    ahora = timezone.now()
    todos = cuerpo(crear_proceso(administradora, dias_recordatorio=[7, 3]))['id']
    administradora.post(f'{BASE}/procesos/{todos}/abrir/')
    ProcesoFeDeVidaModel.objects.filter(pk=todos).update(fecha_cierre=ahora + timedelta(days=3))
    assert enviar_recordatorios_tarea() == 3   # PASIVO, OTRO_PASIVO y SIN_CORREO (todos pasivos)
    recordatorios = [a for a in NotificadorFalso.enviadas if a.tipo == 'fe_de_vida.recordatorio_cierre']
    assert {a.cedula_destino for a in recordatorios} == {PASIVO, OTRO_PASIVO, SIN_CORREO}
    assert {(a.ref_id, a.clave) for a in recordatorios} == {(todos, '3')} and all(a.correo for a in recordatorios)
    # quien ya envió deja de recibirlos
    solicitud_enviada(pasivo, todos)
    NotificadorFalso.enviadas.clear()
    assert enviar_recordatorios_tarea() == 2
    # fuera de umbral (faltan 5 días) no avisa
    ProcesoFeDeVidaModel.objects.filter(pk=todos).update(fecha_cierre=ahora + timedelta(days=5))
    assert enviar_recordatorios_tarea() == 0


def test_beat_de_recordatorios_respeta_alcance_y_proceso_sin_recordatorios(administradora, pensionado, datos):
    from apps.fe_de_vida.infrastructure.tasks.recordatorios_tasks import enviar_recordatorios_tarea
    ahora = timezone.now()
    acotado = cuerpo(crear_proceso(administradora, tipos_nomina=[pensionado.id], dias_recordatorio=[1]))['id']
    sin = cuerpo(crear_proceso(administradora))['id']
    for pid in (acotado, sin):
        administradora.post(f'{BASE}/procesos/{pid}/abrir/')
        ProcesoFeDeVidaModel.objects.filter(pk=pid).update(fecha_cierre=ahora + timedelta(days=1))
    assert enviar_recordatorios_tarea() == 1
    assert [a.cedula_destino for a in NotificadorFalso.enviadas if a.tipo == 'fe_de_vida.recordatorio_cierre'] == [OTRO_PASIVO]


# ── C7: acceso del pasivo ──
def test_pasivo_con_cuenta_accede_a_las_rutas_del_pasivo_y_no_a_las_del_activo(administradora, pasivo, datos):
    proceso_abierto(administradora)
    assert pasivo.get(f'{BASE}/procesos/vigente/').status_code == 200
    assert pasivo.get(f'{BASE}/mis-solicitudes/').status_code == 200
    # rutas del trabajador activo (autogestión) exigen condición ACTIVO
    assert pasivo.post('/api/v1/autogestion/solicitudes/', {}, format='json').status_code == 403


def test_un_activo_con_los_permisos_del_pasivo_no_accede_a_la_fe_de_vida(datos):
    activo = cliente(ACTIVO, PERMISOS_PASIVO, 9)
    assert activo.get(f'{BASE}/procesos/vigente/').status_code == 403
    assert activo.get(f'{BASE}/mis-solicitudes/').status_code == 403
    assert activo.post(f'{BASE}/procesos/vigente/solicitud/').status_code == 403


# ── Plan 2.9 / decisión C: lista blanca propia del acta (identidad corregible) ──
def test_acta_permite_corregir_nombres_apellidos_y_fecha_de_nacimiento_y_se_aplican_al_validar(
    pasivo, analista, administradora, django_capture_on_commit_callbacks,
):
    pid = proceso_abierto(administradora)
    sid = cuerpo(pasivo.post(f'{BASE}/procesos/vigente/solicitud/'))['id']
    cambios = [{'seccion': 'identidad', 'entidad': 'employee', 'accion': 'MODIFICAR', 'campo': campo, 'valor': valor}
               for campo, valor in (('nombres', 'MARÍA JOSÉ'), ('apellidos', 'PÉREZ DÍAZ'), ('fecha_nacimiento', '1950-03-04'))]
    r = pasivo.put(f'{BASE}/mis-solicitudes/{sid}/borrador/', {'cambios': cambios}, format='json')
    assert r.status_code == 200 and len(cuerpo(r)['cambios']) == 3
    assert pasivo.post(f'{BASE}/mis-solicitudes/{sid}/evidencia/', {'file': foto(), 'origen': 'CAMARA'}, format='multipart').status_code == 200
    assert pasivo.post(f'{BASE}/mis-solicitudes/{sid}/enviar/').status_code == 200
    detalle = cuerpo(analista.get(f'{BASE}/solicitudes/{sid}/'))
    assert {c['campo']: c['valor_actual'] for c in detalle['cambios']}['nombres'] == 'MARIA'
    analista.post(f'{BASE}/solicitudes/{sid}/check/')
    with django_capture_on_commit_callbacks(execute=True):
        assert cuerpo(administradora.post(f'{BASE}/solicitudes/{sid}/check/'))['estado'] == 'VALIDADA'
    e = EmployeeModel.objects.get(cedulaidentidad=PASIVO)
    assert (e.nombres, e.apellidos, str(e.fecha_nacimiento)) == ('MARÍA JOSÉ', 'PÉREZ DÍAZ', '1950-03-04')


@pytest.mark.parametrize('seccion,entidad,campo,valor', [
    ('identidad', 'employee', 'cedulaidentidad', '9999999'),
    ('identidad', 'employee', 'correo', 'x@y.zz'),
    ('contacto', 'employee', 'nombres', 'OTRO'),          # sección equivocada
    ('identidad', 'employee', 'telefono_movil', '04140000000'),
    ('identidad', 'datos_vivienda', 'nombres', 'X'),
    ('identidad', 'employee', 'fecha_nacimiento', '2999-01-01'),
    ('identidad', 'employee', 'nombres', ''),
])
def test_acta_rechaza_campos_fuera_de_la_lista_blanca_de_fe_de_vida(pasivo, administradora, seccion, entidad, campo, valor):
    proceso_abierto(administradora)
    sid = cuerpo(pasivo.post(f'{BASE}/procesos/vigente/solicitud/'))['id']
    r = pasivo.put(f'{BASE}/mis-solicitudes/{sid}/borrador/', {'cambios': [
        {'seccion': seccion, 'entidad': entidad, 'accion': 'MODIFICAR', 'campo': campo, 'valor': valor}]}, format='json')
    assert r.status_code == 400


def test_la_lista_blanca_de_autogestion_no_cambia():
    from apps.autogestion.domain.value_objects.secciones import CAMPOS_POR_SECCION
    from apps.fe_de_vida.infrastructure.adaptadores_autogestion import CAMPOS_ACTA
    assert 'identidad' not in CAMPOS_POR_SECCION and 'nombres' not in CAMPOS_POR_SECCION['contacto']['employee']
    assert CAMPOS_ACTA['identidad']['employee'] == {'nombres', 'apellidos', 'fecha_nacimiento'}
    assert CAMPOS_ACTA['contacto']['employee'] == CAMPOS_POR_SECCION['contacto']['employee']


# ── Verificación de la constancia: pública (QR, sin sesión) e interna ──
CAMPOS_PROHIBIDOS_PUBLICA = {'certificada_por', 'cedula', 'solicitud_id', 'id', 'evidencia', 'foto', 'clave_pdf'}


def _constancia_validada(administradora, pasivo, django_capture_on_commit_callbacks):
    pid = proceso_abierto(administradora)
    sid = solicitud_enviada(pasivo, pid)
    with django_capture_on_commit_callbacks(execute=True):
        assert administradora.post(
            f'{BASE}/solicitudes/{sid}/aprobar-directo/', {'justificacion': 'Pasivo sin movilidad'}, format='json',
        ).status_code == 200
    return sid, ConstanciaFeDeVidaModel.objects.get(solicitud_id=sid)


def test_verificacion_publica_valida_sin_sesion_y_sin_datos_sensibles(
    pasivo, administradora, django_capture_on_commit_callbacks,
):
    sid, constancia = _constancia_validada(administradora, pasivo, django_capture_on_commit_callbacks)
    r = APIClient().get(f'{BASE}/constancias/publica/{constancia.codigo_verificacion}/', REMOTE_ADDR='10.1.1.1')
    assert r.status_code == 200
    datos = cuerpo(r)
    assert datos['numero'] == constancia.numero and datos['estado'] == 'VALIDA' and datos['emitida_en']
    assert datos['proceso_nombre'] and datos['nombre_completo'] == 'MARIA PEREZ'
    assert datos['cedula_enmascarada'] == '51***11'
    assert not CAMPOS_PROHIBIDOS_PUBLICA & set(datos)
    texto = r.content.decode()
    assert PASIVO not in texto and ANALISTA not in texto and ADMINISTRADORA not in texto and sid not in texto
    auditoria = AuditoriaLog.objects.get(accion='CONSTANCIA_VERIFICADA_PUBLICA', resultado='SUCCESS')
    assert auditoria.ip_origen == '10.1.1.1' and auditoria.recurso_id == constancia.numero


def test_verificacion_publica_404_generico_si_no_existe_o_esta_mal_formado(datos):
    cliente = APIClient()
    respuestas = [cliente.get(f'{BASE}/constancias/publica/{c}/') for c in ('inexistente', 'f' * 64)]
    assert [r.status_code for r in respuestas] == [404, 404]
    assert respuestas[0].json() == respuestas[1].json() and respuestas[0].json()['status'] == 'error'
    assert AuditoriaLog.objects.filter(accion='CONSTANCIA_VERIFICADA_PUBLICA', resultado='FAILED').count() == 2


def test_verificacion_publica_404_si_la_solicitud_no_esta_validada(pasivo, administradora):
    pid = proceso_abierto(administradora)
    sid = solicitud_enviada(pasivo, pid)
    codigo = 'b2' * 32
    ConstanciaFeDeVidaModel.objects.create(
        solicitud_id=sid, numero='FV-2026-999999', codigo_verificacion=codigo, certificada_por=[],
        plantilla_version=1, emitida_en=timezone.now(),
    )
    r = APIClient().get(f'{BASE}/constancias/publica/{codigo}/')
    assert r.status_code == 404 and 'FV-2026-999999' not in r.content.decode()


def test_verificacion_publica_tiene_throttle_por_ip(datos, monkeypatch):
    from rest_framework.throttling import ScopedRateThrottle

    tasas = {**ScopedRateThrottle.THROTTLE_RATES, 'fe_de_vida_verificacion_publica': '3/minute'}
    monkeypatch.setattr(ScopedRateThrottle, 'THROTTLE_RATES', tasas)
    cliente = APIClient()
    estados = [cliente.get(f'{BASE}/constancias/publica/x/', REMOTE_ADDR='10.2.2.2').status_code for _ in range(4)]
    assert estados == [404, 404, 404, 429]
    assert cliente.get(f'{BASE}/constancias/publica/x/', REMOTE_ADDR='10.3.3.3').status_code == 404


def test_verificacion_interna_completa_con_permiso_y_403_sin_el(
    pasivo, analista, administradora, django_capture_on_commit_callbacks,
):
    sid, constancia = _constancia_validada(administradora, pasivo, django_capture_on_commit_callbacks)
    ruta = f'{BASE}/constancias/verificar/{constancia.codigo_verificacion}/'
    d = cuerpo(analista.get(ruta))
    assert d['solicitud_id'] == sid and d['cedula'] == PASIVO and d['nombre_completo'] == 'MARIA PEREZ'
    assert d['proceso_nombre'] and d['estado'] == 'VALIDADA'
    assert [c['cedula'] for c in d['certificada_por']] == [ADMINISTRADORA] and d['certificada_por'][0]['nombre']
    assert pasivo.get(ruta).status_code == 403
    assert APIClient().get(ruta).status_code in (401, 403)


def test_evidencia_de_revision_exige_permiso_y_foto_y_el_pasivo_no_la_lee_por_esa_ruta(pasivo, otro_pasivo, analista, administradora):
    pid = proceso_abierto(administradora)
    sid = cuerpo(pasivo.post(f'{BASE}/procesos/vigente/solicitud/'))['id']
    assert analista.get(f'{BASE}/solicitudes/{sid}/evidencia/').status_code == 404  # aún sin foto
    assert pasivo.post(f'{BASE}/mis-solicitudes/{sid}/evidencia/', {'file': foto(), 'origen': 'ARCHIVO'}, format='multipart').status_code == 200
    # el pasivo (dueño o ajeno) no tiene fe_de_vida.ver_evidencia: no hay forma de leer la foto por la ruta de Bienestar
    assert pasivo.get(f'{BASE}/solicitudes/{sid}/evidencia/').status_code == 403
    assert otro_pasivo.get(f'{BASE}/solicitudes/{sid}/evidencia/').status_code == 403
    assert analista.get(f'{BASE}/solicitudes/{sid}/evidencia/').status_code == 200
    assert pid


# ── C21: acciones por revisor, ficha completa y retiro del check ──
MOTIVO_RETIRO = 'Di el check por error al revisar otra solicitud'


def acciones(cli, sid):
    return cuerpo(cli.get(f'{BASE}/solicitudes/{sid}/'))['acciones_disponibles']


def test_detalle_de_revision_trae_la_ficha_las_acciones_y_el_nombre_de_quien_decidio(pasivo, analista, administradora):
    sid = solicitud_enviada(pasivo, proceso_abierto(administradora))
    d = cuerpo(analista.get(f'{BASE}/solicitudes/{sid}/'))
    ficha = d['ficha']
    assert ficha['empleado']['cedula'] == PASIVO and ficha['empleado']['nombre_completo'] == 'MARIA PEREZ'
    assert ficha['empleado']['asignaciones'][0]['tipo_nomina'] == 'JUBILADO'
    assert ficha['datos_complementarios']['correo_alternativo'] == CORREO_ALTERNO and isinstance(ficha['familiares'], list)
    assert 'perfil_salud' not in ficha['empleado'] and 'foto_url' not in ficha['empleado']
    assert d['acciones_disponibles'] == ['dar_check', 'devolver', 'rechazar']
    assert analista.post(f'{BASE}/solicitudes/{sid}/check/').status_code == 200
    d = cuerpo(analista.get(f'{BASE}/solicitudes/{sid}/'))
    assert d['solicitud']['decisiones'][0]['actor_nombre'] == 'ANA LOPEZ'
    assert d['acciones_disponibles'] == ['retirar_check']
    assert acciones(administradora, sid) == ['dar_check', 'aprobar_directo', 'devolver', 'rechazar']


def test_la_ficha_solo_se_entrega_a_quien_puede_revisar(pasivo, administradora, datos):
    sid = solicitud_enviada(pasivo, proceso_abierto(administradora))
    solo_panel = cliente('20000009', {'fe_de_vida.ver_panel'}, 9)
    d = cuerpo(solo_panel.get(f'{BASE}/solicitudes/{sid}/'))
    assert d['ficha'] is None and d['acciones_disponibles'] == []
    assert pasivo.get(f'{BASE}/solicitudes/{sid}/').status_code == 403


def test_quien_dio_su_check_recibe_409_al_devolver_rechazar_o_repetir_y_el_otro_revisor_puede(pasivo, analista, administradora):
    sid = solicitud_enviada(pasivo, proceso_abierto(administradora))
    assert analista.post(f'{BASE}/solicitudes/{sid}/check/').status_code == 200
    for ruta, cuerpo_req in (('check', None), ('devolver', {'motivo': 'Foto borrosa'}), ('rechazar', {'motivo': 'Cédula ilegible'})):
        r = analista.post(f'{BASE}/solicitudes/{sid}/{ruta}/', cuerpo_req, format='json')
        assert r.status_code == 409 and 'ya aprobó' in r.json()['message']
    assert administradora.post(f'{BASE}/solicitudes/{sid}/devolver/', {'motivo': 'Foto borrosa'}, format='json').status_code == 200


def test_la_administradora_que_dio_su_check_aprueba_directo(pasivo, administradora, django_capture_on_commit_callbacks):
    sid = solicitud_enviada(pasivo, proceso_abierto(administradora))
    assert administradora.post(f'{BASE}/solicitudes/{sid}/check/').status_code == 200
    assert acciones(administradora, sid) == ['aprobar_directo', 'retirar_check']
    assert administradora.post(f'{BASE}/solicitudes/{sid}/rechazar/', {'motivo': 'x'}, format='json').status_code == 409
    with django_capture_on_commit_callbacks(execute=True):
        r = administradora.post(f'{BASE}/solicitudes/{sid}/aprobar-directo/', {'justificacion': 'Pasivo sin movilidad'}, format='json')
    assert r.status_code == 200 and cuerpo(r)['estado'] == 'VALIDADA'


def test_retirar_check_ok_audita_notifica_y_devuelve_las_acciones(pasivo, analista, administradora):
    sid = solicitud_enviada(pasivo, proceso_abierto(administradora))
    assert analista.post(f'{BASE}/solicitudes/{sid}/check/').status_code == 200
    r = analista.post(f'{BASE}/solicitudes/{sid}/retirar-check/', {'motivo': MOTIVO_RETIRO}, format='json')
    assert r.status_code == 200 and cuerpo(r)['estado'] == 'PENDIENTE_REVISION'
    assert [d['tipo'] for d in cuerpo(r)['decisiones']] == ['CHECK', 'CHECK_RETIRADO']
    log = AuditoriaLog.objects.get(accion='CHECK_RETIRADO', recurso_id=sid)
    assert log.actor_cedula == ANALISTA and log.estado_nuevo['motivo'] == MOTIVO_RETIRO
    aviso = [a for a in NotificadorFalso.enviadas if a.tipo == 'fe_de_vida.check_retirado'][0]
    assert aviso.permiso_destino == 'fe_de_vida.revisar' and aviso.modulo == 'personal' and aviso.correo is None
    assert ANALISTA in aviso.excluir_cedulas and MOTIVO_RETIRO in aviso.mensaje
    assert acciones(analista, sid) == ['dar_check', 'devolver', 'rechazar']
    assert analista.post(f'{BASE}/solicitudes/{sid}/check/').status_code == 200


def test_retirar_check_rechaza_a_quien_no_lo_dio_sin_motivo_y_tras_validada(pasivo, analista, administradora):
    sid = solicitud_enviada(pasivo, proceso_abierto(administradora))
    url = f'{BASE}/solicitudes/{sid}/retirar-check/'
    assert analista.post(url, {'motivo': MOTIVO_RETIRO}, format='json').status_code == 409  # aún no dio check
    assert analista.post(f'{BASE}/solicitudes/{sid}/check/').status_code == 200
    assert administradora.post(url, {'motivo': MOTIVO_RETIRO}, format='json').status_code == 409  # el check es de otra persona
    assert pasivo.post(url, {'motivo': MOTIVO_RETIRO}, format='json').status_code == 403
    assert analista.post(url, {'motivo': 'corto'}, format='json').status_code == 400
    assert analista.post(url, {'motivo': '<b>retiro este check por equivocación</b>'}, format='json').status_code == 400
    assert analista.post(url, {}, format='json').status_code == 400
    assert administradora.post(f'{BASE}/solicitudes/{sid}/check/').status_code == 200  # VALIDADA
    assert analista.post(url, {'motivo': MOTIVO_RETIRO}, format='json').status_code == 409
    assert not AuditoriaLog.objects.filter(accion='CHECK_RETIRADO').exists()
