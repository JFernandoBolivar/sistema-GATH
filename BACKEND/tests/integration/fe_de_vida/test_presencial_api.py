"""
Pruebas de integración para los endpoints de Fe de Vida Presencial (A9).
"""
import io
from datetime import timedelta

import pytest
from django.utils import timezone
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


def _proceso_abierto_y_solicitud_presencial(registrada_por=ANALISTA):
    ahora = timezone.now()
    proceso = ProcesoFeDeVidaModel.objects.create(
        nombre='Proceso presencial FIX-QA4', fecha_apertura=ahora,
        fecha_cierre=ahora + timedelta(days=30), estado='ABIERTO',
    )
    return SolicitudFeDeVidaModel.objects.create(
        proceso=proceso, cedula=PASIVO, estado='PENDIENTE_REVISION', canal='PRESENCIAL',
        registrada_por='ANA LOPEZ', registrada_por_cedula=registrada_por, fecha_envio=ahora,
        origen_evidencia='CAMARA', evidencia_clave='fotos/qa4.jpg',
    )


def test_registrador_presencial_no_puede_decidir_y_otro_analista_si(datos, monkeypatch):
    monkeypatch.setattr(
        'apps.fe_de_vida.presentation.views.revision_views._registrador_puede_checar', lambda: False,
    )
    sol = _proceso_abierto_y_solicitud_presencial()
    registrador = _cliente(ANALISTA, {
        'fe_de_vida.revisar', 'fe_de_vida.check_analista',
    })
    otro = _cliente('20000009', {'fe_de_vida.revisar', 'fe_de_vida.check_analista'}, pk=9)

    detalle = _cuerpo(registrador.get(f'{BASE}/solicitudes/{sol.id}/'))
    assert detalle['acciones_disponibles'] == []

    rutas = [
        (f'{BASE}/solicitudes/{sol.id}/check/', None),
        (f'{BASE}/solicitudes/{sol.id}/devolver/', {'motivo': 'Corrija el teléfono'}),
        (f'{BASE}/solicitudes/{sol.id}/rechazar/', {'motivo': 'Documentación ilegible'}),
    ]
    for ruta, cuerpo in rutas:
        r = registrador.post(ruta, cuerpo, format='json')
        assert r.status_code == 409, (ruta, r.content)
        assert 'registró esta fe de vida' in r.json()['message']

    # Otro analista sí puede revisar.
    assert otro.post(f'{BASE}/solicitudes/{sol.id}/check/').status_code == 200


def test_administradora_registradora_no_puede_aprobar_directo(datos, monkeypatch):
    monkeypatch.setattr(
        'apps.fe_de_vida.presentation.views.revision_views._registrador_puede_checar', lambda: False,
    )
    sol = _proceso_abierto_y_solicitud_presencial(registrada_por=ADMINISTRADORA)
    registradora = _cliente(ADMINISTRADORA, {
        'fe_de_vida.revisar', 'fe_de_vida.check_administradora', 'fe_de_vida.aprobar_directo',
    })
    detalle = _cuerpo(registradora.get(f'{BASE}/solicitudes/{sol.id}/'))
    assert detalle['acciones_disponibles'] == []
    r = registradora.post(
        f'{BASE}/solicitudes/{sol.id}/aprobar-directo/',
        {'justificacion': 'Pasivo sin movilidad'}, format='json',
    )
    assert r.status_code == 409 and 'registró esta fe de vida' in r.json()['message']


def test_registrador_presencial_decide_si_el_parametro_esta_encendido(datos, monkeypatch):
    monkeypatch.setattr(
        'apps.fe_de_vida.presentation.views.revision_views._registrador_puede_checar', lambda: True,
    )
    sol = _proceso_abierto_y_solicitud_presencial()
    registrador = _cliente(ANALISTA, {
        'fe_de_vida.revisar', 'fe_de_vida.check_analista',
    })
    detalle = _cuerpo(registrador.get(f'{BASE}/solicitudes/{sol.id}/'))
    assert {'dar_check', 'devolver', 'rechazar'} <= set(detalle['acciones_disponibles'])
    assert registrador.post(f'{BASE}/solicitudes/{sol.id}/check/').status_code == 200


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


def _iniciar_sin_celular(datos):
    """Pasivo sin celular en el expediente y solicitud presencial iniciada; devuelve (cliente, id)."""
    EmployeeModel.objects.filter(cedulaidentidad=PASIVO).update(telefono_movil='')
    cli_admin = _cliente(ADMINISTRADORA, {'fe_de_vida.gestionar_procesos'})
    pid = _cuerpo(cli_admin.post(f'{BASE}/procesos/', {
        'nombre': 'JUBILADOS 2026', 'fecha_apertura': '2026-01-01T00:00:00Z', 'fecha_cierre': '2026-12-31T23:59:59Z',
    }, format='json'))['id']
    cli_admin.post(f'{BASE}/procesos/{pid}/abrir/')
    cli = _cliente(ANALISTA, {'fe_de_vida.registrar_presencial'})
    sid = _cuerpo(cli.post(f'{BASE}/presencial/solicitudes/', {'cedula': PASIVO}, format='json'))['solicitud']['id']
    return cli, sid


def _borrador_contacto(valor):
    # Mismo cuerpo que arma el frontend en el paso Contacto (+58 · 0414 · 7574312 => E.164).
    return {'cambios': [{
        'seccion': 'contacto', 'entidad': 'employee', 'accion': 'MODIFICAR',
        'campo': 'telefono_movil', 'valor': valor, 'entidad_id': None,
    }]}


def test_borrador_presencial_acepta_celular_del_mismo_borrador(datos):
    cli, sid = _iniciar_sin_celular(datos)
    r = cli.put(f'{BASE}/presencial/solicitudes/{sid}/borrador/', _borrador_contacto('+584147574312'), format='json')
    assert r.status_code == 200, r.content
    assert _cuerpo(r)['cambios'][0]['valor_propuesto'] == '+584147574312'


def test_borrador_presencial_rechaza_celular_vacio(datos):
    cli, sid = _iniciar_sin_celular(datos)
    r = cli.put(f'{BASE}/presencial/solicitudes/{sid}/borrador/', {'cambios': []}, format='json')
    assert r.status_code == 400
    assert 'celular' in r.content.decode().lower()
