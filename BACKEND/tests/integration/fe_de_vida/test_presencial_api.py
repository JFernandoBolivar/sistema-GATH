"""
Pruebas de integración para los endpoints de Fe de Vida Presencial (A9).
"""
import io
import pytest
from PIL import Image
from rest_framework.test import APIClient

from apps.catalogos.infrastructure.models.catalogo_models import (
    EstatusModel,
    NacionalidadModel,
    SexoModel,
    TipoNominaModel,
    TipoPersonalModel,
)
from apps.cargos.infrastructure.models.cargo_models import (
    AsigTrabajoModel,
    DenominacionCargoEspecificoModel,
    DenominacionCargoModel,
)
from apps.fe_de_vida.infrastructure.models.proceso_models import ProcesoFeDeVidaModel
from apps.fe_de_vida.infrastructure.models.solicitud_models import (
    ConstanciaFeDeVidaModel,
    PlantillaConstanciaModel,
    SolicitudFeDeVidaModel,
)
from apps.personal.infrastructure.models.personal_models import EmployeeModel

BASE = '/api/v1/fe-de-vida'
PASIVO = '5111111'
ANALISTA = '20000001'
ADMINISTRADORA = '20000002'


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
        return 'PASIVO' if cedula == PASIVO else 'ACTIVO'


@pytest.fixture(autouse=True)
def entorno(monkeypatch):
    AlmacenFalso.objetos, NotificadorFalso.enviadas = {}, []
    for ruta in ('pasivo_views', 'revision_views', 'presencial_views'):
        monkeypatch.setattr(f'apps.fe_de_vida.presentation.views.{ruta}.SeaweedFSStorage', AlmacenFalso)
    monkeypatch.setattr('apps.fe_de_vida.infrastructure.receivers.SeaweedFSStorage', AlmacenFalso)
    monkeypatch.setattr('apps.fe_de_vida.infrastructure.receivers.obtener_notificador', lambda: NotificadorFalso())
    monkeypatch.setattr('core.presentation.permissions.obtener_resolutor_condicion', lambda: ResolutorCondicion())


@pytest.fixture
def datos(db):
    NacionalidadModel.objects.get_or_create(id=1, defaults={'codigo': 'V', 'nombre': 'VENEZOLANO'})
    sexo, _ = SexoModel.objects.get_or_create(id=1, defaults={'sexo': 'F'})
    estatus, _ = EstatusModel.objects.get_or_create(id=1, defaults={'estatus': 'ACTIVO'})
    tipo_pasivo, _ = TipoPersonalModel.objects.get_or_create(id=1, defaults={'tipo_personal': 'PASIVO'})
    tipo_activo, _ = TipoPersonalModel.objects.get_or_create(id=2, defaults={'tipo_personal': 'ACTIVO'})
    nomina, _ = TipoNominaModel.objects.get_or_create(id=1, defaults={'nomina': 'JUBILADO', 'es_activo': False})
    dc, _ = DenominacionCargoModel.objects.get_or_create(id=1, defaults={'cargo': 'ANALISTA'})
    dce, _ = DenominacionCargoEspecificoModel.objects.get_or_create(id=1, defaults={'cargo': 'ANALISTA I'})

    for cedula, nombre, tipo, correo in [
        (PASIVO, 'MARIA PEREZ', tipo_pasivo, 'maria@correo.test'),
        (ANALISTA, 'ANA LOPEZ', tipo_activo, 'ana@conatel.gob.ve'),
        (ADMINISTRADORA, 'ELENA SOTO', tipo_activo, 'elena@conatel.gob.ve'),
    ]:
        e, _ = EmployeeModel.objects.get_or_create(
            cedulaidentidad=cedula,
            defaults={
                'nombres': nombre.split()[0],
                'apellidos': nombre.split()[-1],
                'sexoid': sexo,
                'correo': correo,
                'telefono_movil': '04140000000',
            },
        )
        AsigTrabajoModel.objects.get_or_create(
            employee=e,
            defaults={
                'codigo': f'C-{cedula}',
                'denominacioncargoid': dc,
                'denominacioncargoespecificoid': dce,
                'tiponominaid': nomina,
                'estatusid': estatus,
                'Tipo_personal': tipo,
            },
        )

    PlantillaConstanciaModel.objects.get_or_create(
        version=1,
        defaults={'titulo': 'CONSTANCIA DE FE DE VIDA', 'activa': True, 'texto': 'Validado'},
    )


def _cliente(cedula, permisos, pk=1):
    c = APIClient()
    c.force_authenticate(user=Usuario(cedula, permisos, pk))
    return c


def _cuerpo(r):
    data = r.json()
    return data.get('data', data)


def _foto_jpeg():
    b = io.BytesIO()
    Image.new('RGB', (500, 500), color='blue').save(b, 'JPEG')
    b.seek(0)
    b.name = 'foto.jpg'
    return b


def test_buscar_pasivo_presencial_permiso_y_resultado(datos):
    cli_sin_permiso = _cliente(ANALISTA, {'fe_de_vida.revisar'})
    r = cli_sin_permiso.get(f'{BASE}/presencial/buscar/?texto={PASIVO}')
    assert r.status_code == 403

    cli_con_permiso = _cliente(ANALISTA, {'fe_de_vida.registrar_presencial'})
    r = cli_con_permiso.get(f'{BASE}/presencial/buscar/?texto={PASIVO}')
    assert r.status_code == 200
    res = _cuerpo(r)
    assert len(res['results']) == 1
    assert res['results'][0]['cedula'] == PASIVO
    assert res['results'][0]['nombre_completo'] == 'MARIA PEREZ'


def test_flujo_completo_fe_de_vida_presencial(datos):
    # Abrir proceso
    cli_admin = _cliente(ADMINISTRADORA, {'fe_de_vida.gestionar_procesos'})
    r_proc = cli_admin.post(f'{BASE}/procesos/', {
        'nombre': 'JUBILADOS 2026', 'fecha_apertura': '2026-01-01T00:00:00Z', 'fecha_cierre': '2026-12-31T23:59:59Z',
    }, format='json')
    pid = _cuerpo(r_proc)['id']
    cli_admin.post(f'{BASE}/procesos/{pid}/abrir/')

    # Analista de Bienestar registra fe de vida presencial
    cli_bienestar = _cliente(ANALISTA, {'fe_de_vida.registrar_presencial'})

    # 1. Iniciar solicitud presencial
    r_ini = cli_bienestar.post(f'{BASE}/presencial/solicitudes/', {'cedula': PASIVO}, format='json')
    assert r_ini.status_code == 200
    sol = _cuerpo(r_ini)['solicitud']
    sid = sol['id']
    assert sol['canal'] == 'PRESENCIAL'
    assert sol['registrada_por_cedula'] == ANALISTA

    # 2. Guardar borrador
    r_borr = cli_bienestar.put(
        f'{BASE}/presencial/solicitudes/{sid}/borrador/',
        {'cambios': [{
            'seccion': 'contacto', 'entidad': 'employee', 'accion': 'MODIFICAR',
            'campo': 'telefono_movil', 'valor': '04121234567',
        }]},
        format='json',
    )
    assert r_borr.status_code == 200

    # 3. Subir evidencia (foto)
    r_foto = cli_bienestar.post(
        f'{BASE}/presencial/solicitudes/{sid}/evidencia/',
        {'file': _foto_jpeg(), 'origen': 'CAMARA'},
        format='multipart',
    )
    assert r_foto.status_code == 200

    # 4. Enviar con declaración presencial
    r_env = cli_bienestar.post(
        f'{BASE}/presencial/solicitudes/{sid}/enviar/',
        {'declaracion_presencial': True},
        format='json',
    )
    assert r_env.status_code == 200
    sol_env = _cuerpo(r_env)
    assert sol_env['estado'] == 'PENDIENTE_REVISION'
    assert sol_env['canal'] == 'PRESENCIAL'
    assert sol_env['registrada_por_cedula'] == ANALISTA

    # En la base de datos queda marcada como PRESENCIAL
    m = SolicitudFeDeVidaModel.objects.get(pk=sid)
    assert m.canal == 'PRESENCIAL'
    assert m.registrada_por_cedula == ANALISTA


def test_constancia_bienestar_imprimir_endpoint(datos):
    proc = ProcesoFeDeVidaModel.objects.create(
        id='01a1a8cc-0000-7000-8000-000000000002',
        nombre='PROCESO 2026',
        fecha_apertura='2026-01-01T00:00:00Z',
        fecha_cierre='2026-12-31T23:59:59Z',
    )
    sol = SolicitudFeDeVidaModel.objects.create(
        id='01a1a8cc-0000-7000-8000-000000000001',
        proceso=proc,
        cedula=PASIVO,
        estado='VALIDADA',
        canal='PRESENCIAL',
    )
    AlmacenFalso.objetos['fe_de_vida/constancias/FV-2026-0001.pdf'] = b'%PDF-1.4 test pdf content'
    ConstanciaFeDeVidaModel.objects.create(
        solicitud=sol,
        numero='FV-2026-0001',
        codigo_verificacion='abc12345',
        clave_pdf='fe_de_vida/constancias/FV-2026-0001.pdf',
    )

    cli_bienestar = _cliente(ANALISTA, {'fe_de_vida.revisar'})
    r = cli_bienestar.get(f'{BASE}/solicitudes/{sol.id}/constancia/')
    assert r.status_code == 200
    assert r['Content-Type'] == 'application/pdf'
    assert b''.join(r.streaming_content).startswith(b'%PDF')
