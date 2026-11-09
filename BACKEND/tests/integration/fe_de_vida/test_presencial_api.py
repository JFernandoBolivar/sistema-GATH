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
from core.domain.configuracion import (
    CLAVE_FE_DE_VIDA_ADMIN_REGISTRADORA_PUEDE_APROBAR,
    CLAVE_FE_DE_VIDA_REGISTRADOR_PUEDE_CHECAR,
)
from core.infrastructure.models.auditoria import AuditoriaLog

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
        {'cambios': [
            {
                'seccion': 'contacto', 'entidad': 'employee', 'accion': 'MODIFICAR',
                'campo': 'telefono_movil', 'valor': '04121234567',
            },
            {
                'seccion': 'contacto', 'entidad': 'datos_complementarios', 'accion': 'MODIFICAR',
                'campo': 'correo_alternativo', 'valor': 'maria.alterna@correo.test',
            },
        ]},
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


def test_flujo_presencial_sin_correo_con_justificacion(datos):
    cli_admin = _cliente(ADMINISTRADORA, {'fe_de_vida.gestionar_procesos'})
    r_proc = cli_admin.post(f'{BASE}/procesos/', {
        'nombre': 'JUBILADOS 2026 - sin correo',
        'fecha_apertura': '2026-01-01T00:00:00Z',
        'fecha_cierre': '2026-12-31T23:59:59Z',
    }, format='json')
    pid = _cuerpo(r_proc)['id']
    cli_admin.post(f'{BASE}/procesos/{pid}/abrir/')

    cli_bienestar = _cliente(ANALISTA, {'fe_de_vida.registrar_presencial'})
    r_ini = cli_bienestar.post(f'{BASE}/presencial/solicitudes/', {'cedula': PASIVO}, format='json')
    sid = _cuerpo(r_ini)['solicitud']['id']
    telefono = {
        'seccion': 'contacto', 'entidad': 'employee', 'accion': 'MODIFICAR',
        'campo': 'telefono_movil', 'valor': '04121234567',
    }

    # Justificación demasiado corta: no se guarda.
    r_corta = cli_bienestar.put(
        f'{BASE}/presencial/solicitudes/{sid}/borrador/',
        {'cambios': [telefono], 'sin_correo_alternativo': True,
         'justificacion_sin_correo': 'corto'},
        format='json',
    )
    assert r_corta.status_code == 400

    # Excepción válida: se guarda y se devuelve la solicitud ya actualizada.
    justificacion = 'El pasivo no posee correo electrónico ni familiar de contacto.'
    r_borr = cli_bienestar.put(
        f'{BASE}/presencial/solicitudes/{sid}/borrador/',
        {'cambios': [telefono], 'sin_correo_alternativo': True,
         'justificacion_sin_correo': justificacion},
        format='json',
    )
    assert r_borr.status_code == 200, r_borr.content
    sol_guardada = _cuerpo(r_borr)['solicitud']
    assert sol_guardada['sin_correo_alternativo'] is True
    assert sol_guardada['justificacion_sin_correo'] == justificacion

    r_foto = cli_bienestar.post(
        f'{BASE}/presencial/solicitudes/{sid}/evidencia/',
        {'file': _foto_jpeg(), 'origen': 'CAMARA'},
        format='multipart',
    )
    assert r_foto.status_code == 200

    r_env = cli_bienestar.post(
        f'{BASE}/presencial/solicitudes/{sid}/enviar/',
        {'declaracion_presencial': True},
        format='json',
    )
    assert r_env.status_code == 200, r_env.content
    enviada = _cuerpo(r_env)
    assert enviada['estado'] == 'PENDIENTE_REVISION'
    assert enviada['sin_correo_alternativo'] is True
    assert enviada['justificacion_sin_correo'] == justificacion

    m = SolicitudFeDeVidaModel.objects.get(pk=sid)
    assert m.sin_correo_alternativo is True
    assert m.justificacion_sin_correo == justificacion


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


RUTA_VISTAS = 'apps.fe_de_vida.presentation.views.revision_views'
PERMISOS_ADMIN = {'fe_de_vida.revisar', 'fe_de_vida.check_administradora', 'fe_de_vida.aprobar_directo'}


def _interruptores(monkeypatch, *, analistas: bool, administradora: bool):
    monkeypatch.setattr(f'{RUTA_VISTAS}._registrador_puede_checar', lambda: analistas)
    monkeypatch.setattr(f'{RUTA_VISTAS}._admin_registradora_puede_aprobar', lambda: administradora)


@pytest.mark.parametrize('analistas', [False, True])
def test_administradora_registradora_con_su_interruptor_apagado_no_decide(datos, monkeypatch, analistas):
    _interruptores(monkeypatch, analistas=analistas, administradora=False)
    sol = _proceso_abierto_y_solicitud_presencial(registrada_por=ADMINISTRADORA)
    registradora = _cliente(ADMINISTRADORA, PERMISOS_ADMIN)
    detalle = _cuerpo(registradora.get(f'{BASE}/solicitudes/{sol.id}/'))
    assert detalle['acciones_disponibles'] == []
    rutas = [
        (f'{BASE}/solicitudes/{sol.id}/aprobar-directo/', {'justificacion': 'Pasivo sin movilidad'}),
        (f'{BASE}/solicitudes/{sol.id}/check/', None),
        (f'{BASE}/solicitudes/{sol.id}/devolver/', {'motivo': 'Corrija el teléfono'}),
        (f'{BASE}/solicitudes/{sol.id}/rechazar/', {'motivo': 'Documentación ilegible'}),
    ]
    for ruta, cuerpo in rutas:
        r = registradora.post(ruta, cuerpo, format='json')
        assert r.status_code == 409 and 'registró esta fe de vida' in r.json()['message'], (ruta, r.content)


@pytest.mark.parametrize('analistas', [False, True])
def test_administradora_registradora_con_su_interruptor_encendido_revisa_y_aprueba(
    datos, monkeypatch, analistas,
):
    _interruptores(monkeypatch, analistas=analistas, administradora=True)
    sol = _proceso_abierto_y_solicitud_presencial(registrada_por=ADMINISTRADORA)
    registradora = _cliente(ADMINISTRADORA, PERMISOS_ADMIN)
    detalle = _cuerpo(registradora.get(f'{BASE}/solicitudes/{sol.id}/'))
    assert detalle['acciones_disponibles'] == ['dar_check', 'aprobar_directo', 'devolver', 'rechazar']

    sin_justificar = registradora.post(
        f'{BASE}/solicitudes/{sol.id}/aprobar-directo/', {'justificacion': ' '}, format='json',
    )
    assert sin_justificar.status_code == 400

    r = registradora.post(
        f'{BASE}/solicitudes/{sol.id}/aprobar-directo/', {'justificacion': 'Pasivo sin movilidad'}, format='json',
    )
    assert r.status_code == 200, r.content
    datos_resp = _cuerpo(r)
    assert datos_resp['estado'] == 'VALIDADA'
    assert datos_resp['via_aprobacion'] == 'DIRECTA_ADMINISTRADORA'
    assert datos_resp['registrador_tambien_aprobo'] is True
    registro = AuditoriaLog.objects.get(accion='APROBACION_DIRECTA_ADMINISTRADORA', recurso_id=str(sol.id))
    assert registro.estado_nuevo['registrador_tambien_aprobo'] is True
    assert registro.estado_nuevo['justificacion'] == 'Pasivo sin movilidad'


@pytest.mark.parametrize(
    ('accion', 'cuerpo', 'estado'),
    [
        ('check', None, 'PENDIENTE_SEGUNDO_CHECK'),
        ('devolver', {'motivo': 'Corrija el teléfono'}, 'DEVUELTA'),
        ('rechazar', {'motivo': 'Documentación ilegible'}, 'RECHAZADA'),
    ],
)
def test_administradora_registradora_con_su_interruptor_encendido_revisa(
    datos, monkeypatch, accion, cuerpo, estado,
):
    _interruptores(monkeypatch, analistas=False, administradora=True)
    sol = _proceso_abierto_y_solicitud_presencial(registrada_por=ADMINISTRADORA)
    registradora = _cliente(ADMINISTRADORA, PERMISOS_ADMIN)
    r = registradora.post(f'{BASE}/solicitudes/{sol.id}/{accion}/', cuerpo, format='json')
    assert r.status_code == 200, r.content
    assert _cuerpo(r)['estado'] == estado


def test_interruptor_de_analistas_no_habilita_a_la_administradora_y_el_de_ella_no_habilita_a_analistas(
    datos, monkeypatch,
):
    _interruptores(monkeypatch, analistas=False, administradora=True)
    sol = _proceso_abierto_y_solicitud_presencial(registrada_por=ANALISTA)
    registrador = _cliente(ANALISTA, {'fe_de_vida.revisar', 'fe_de_vida.check_analista'})
    assert _cuerpo(registrador.get(f'{BASE}/solicitudes/{sol.id}/'))['acciones_disponibles'] == []
    assert registrador.post(f'{BASE}/solicitudes/{sol.id}/check/').status_code == 409


def test_registrador_analista_con_su_interruptor_encendido_decide_y_queda_marcado(datos, monkeypatch):
    _interruptores(monkeypatch, analistas=True, administradora=False)
    sol = _proceso_abierto_y_solicitud_presencial()
    registrador = _cliente(ANALISTA, {'fe_de_vida.revisar', 'fe_de_vida.check_analista'})
    detalle = _cuerpo(registrador.get(f'{BASE}/solicitudes/{sol.id}/'))
    assert {'dar_check', 'devolver', 'rechazar'} <= set(detalle['acciones_disponibles'])
    r = registrador.post(f'{BASE}/solicitudes/{sol.id}/check/')
    assert r.status_code == 200
    assert _cuerpo(r)['registrador_tambien_aprobo'] is True
    registro = AuditoriaLog.objects.get(accion='CHECK_DADO', recurso_id=str(sol.id))
    assert registro.estado_nuevo['registrador_tambien_aprobo'] is True


def test_otra_administradora_aprueba_directo_sin_marcar_al_registrador(datos, monkeypatch):
    _interruptores(monkeypatch, analistas=False, administradora=False)
    sol = _proceso_abierto_y_solicitud_presencial(registrada_por=ANALISTA)
    administradora = _cliente(ADMINISTRADORA, PERMISOS_ADMIN)
    r = administradora.post(
        f'{BASE}/solicitudes/{sol.id}/aprobar-directo/', {'justificacion': 'Pasivo sin movilidad'}, format='json',
    )
    assert r.status_code == 200, r.content
    assert _cuerpo(r)['registrador_tambien_aprobo'] is False


def _fijar_parametro(clave, valor, pk=77):
    """Cambia el interruptor por la API real de Parámetros del sistema (auditado y con historial)."""
    editor = _cliente('20000099', {'configuracion.editar'}, pk=pk)
    r = editor.put(f'/api/v1/configuracion/parametros/{clave}/', {'valor': valor}, format='json')
    assert r.status_code == 200, r.content
    return editor


def test_interruptores_por_parametros_del_sistema_apagados_por_defecto_visibles_y_con_historial(datos):
    editor = _cliente('20000099', {'configuracion.editar'}, pk=77)
    listado = {p['clave']: p for p in _cuerpo(editor.get('/api/v1/configuracion/parametros/'))}
    for clave in (CLAVE_FE_DE_VIDA_REGISTRADOR_PUEDE_CHECAR, CLAVE_FE_DE_VIDA_ADMIN_REGISTRADORA_PUEDE_APROBAR):
        assert listado[clave]['valor'] == 'false' and listado[clave]['defecto'] == 'false'
        assert listado[clave]['tipo'] == 'booleano'
    assert listado[CLAVE_FE_DE_VIDA_ADMIN_REGISTRADORA_PUEDE_APROBAR]['grupo'] ==         listado[CLAVE_FE_DE_VIDA_REGISTRADOR_PUEDE_CHECAR]['grupo']

    _fijar_parametro(CLAVE_FE_DE_VIDA_ADMIN_REGISTRADORA_PUEDE_APROBAR, 'true')
    auditoria = AuditoriaLog.objects.get(recurso_id=CLAVE_FE_DE_VIDA_ADMIN_REGISTRADORA_PUEDE_APROBAR)
    assert auditoria.estado_previo == {'valor': 'false'} and auditoria.estado_nuevo == {'valor': 'true'}
    historial = _cuerpo(editor.get(
        f'/api/v1/configuracion/parametros/{CLAVE_FE_DE_VIDA_ADMIN_REGISTRADORA_PUEDE_APROBAR}/historial/'
    ))
    assert historial['total'] == 1 and historial['resultados'][0]['valor_nuevo'] == 'true'


def test_administradora_registradora_extremo_a_extremo_con_los_dos_interruptores_reales(datos):
    sol = _proceso_abierto_y_solicitud_presencial(registrada_por=ADMINISTRADORA)
    registradora = _cliente(ADMINISTRADORA, PERMISOS_ADMIN)
    ruta = f'{BASE}/solicitudes/{sol.id}/'

    # Ambos apagados (valor por defecto).
    assert _cuerpo(registradora.get(ruta))['acciones_disponibles'] == []

    # Solo el de analistas encendido: no cambia nada para la Administradora.
    _fijar_parametro(CLAVE_FE_DE_VIDA_REGISTRADOR_PUEDE_CHECAR, 'true')
    assert _cuerpo(registradora.get(ruta))['acciones_disponibles'] == []

    # El suyo encendido: revisa su propio registro y además puede aprobar de forma directa.
    _fijar_parametro(CLAVE_FE_DE_VIDA_ADMIN_REGISTRADORA_PUEDE_APROBAR, 'true')
    assert _cuerpo(registradora.get(ruta))['acciones_disponibles'] == [
        'dar_check', 'aprobar_directo', 'devolver', 'rechazar',
    ]

    # Apagarlo de nuevo la bloquea otra vez, también en la acción real.
    _fijar_parametro(CLAVE_FE_DE_VIDA_ADMIN_REGISTRADORA_PUEDE_APROBAR, 'false')
    r = registradora.post(f'{ruta}aprobar-directo/', {'justificacion': 'Pasivo sin movilidad'}, format='json')
    assert r.status_code == 409


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


def test_borrador_presencial_registro_nuevo_vivienda_pais_extranjero(datos):
    """PRUEBAS-USUARIO P12: Pasivo sin vivienda registra vivienda en país extranjero."""
    from apps.catalogos.infrastructure.models.catalogo_models import PaisModel
    from apps.personal.infrastructure.models.catalogos_soporte_models import CondicionViviendaModel

    pais_ext = PaisModel.objects.filter(es_venezuela=False).first()
    if not pais_ext:
        pais_ext = PaisModel.objects.create(codigo='DEU', nombre='ALEMANIA', es_venezuela=False)
    cond = CondicionViviendaModel.objects.first()
    if not cond:
        cond = CondicionViviendaModel.objects.create(condicion='PROPIA')

    cli, sid = _iniciar_sin_celular(datos)
    cambios = [
        {
            'seccion': 'contacto', 'entidad': 'employee', 'accion': 'MODIFICAR',
            'campo': 'telefono_movil', 'valor': '+584147574312', 'entidad_id': None,
        },
        {
            'seccion': 'vivienda', 'entidad': 'datos_vivienda', 'accion': 'CREAR',
            'campo': '*',
            'valor': {
                'pais_id': pais_ext.id,
                'ciudad_region': 'BERLÍN',
                'direccion_exacta': 'ALEXANDERPLATZ 1',
                'condicion_vivienda_id': cond.id,
            },
            'entidad_id': None,
        },
    ]
    r = cli.put(f'{BASE}/presencial/solicitudes/{sid}/borrador/', {'cambios': cambios}, format='json')
    assert r.status_code == 200, r.content
    res_cambios = _cuerpo(r)['cambios']
    viv = next(c for c in res_cambios if c['entidad'] == 'datos_vivienda')
    assert viv['accion'] == 'CREAR'
    assert viv['valor_propuesto']['ciudad_region'] == 'BERLÍN'
    assert viv['valor_propuesto']['pais_id'] == pais_ext.id


def test_borrador_presencial_vivienda_venezuela_exige_ubicacion_con_nombres_legibles(datos):
    """PRUEBAS-USUARIO P12: Con Venezuela, los campos faltantes se listan con etiquetas legibles."""
    from apps.catalogos.infrastructure.models.catalogo_models import PaisModel
    from apps.personal.infrastructure.models.catalogos_soporte_models import CondicionViviendaModel

    pais_vzla = PaisModel.objects.filter(es_venezuela=True).first()
    if not pais_vzla:
        pais_vzla = PaisModel.objects.create(codigo='VEN', nombre='VENEZUELA', es_venezuela=True)
    cond = CondicionViviendaModel.objects.first()
    if not cond:
        cond = CondicionViviendaModel.objects.create(condicion='PROPIA')

    cli, sid = _iniciar_sin_celular(datos)
    cambios = [
        {
            'seccion': 'contacto', 'entidad': 'employee', 'accion': 'MODIFICAR',
            'campo': 'telefono_movil', 'valor': '+584147574312', 'entidad_id': None,
        },
        {
            'seccion': 'vivienda', 'entidad': 'datos_vivienda', 'accion': 'CREAR',
            'campo': '*',
            'valor': {
                'pais_id': pais_vzla.id,
                'direccion_exacta': 'CALLE PRINCIPAL 123',
                'condicion_vivienda_id': cond.id,
            },
            'entidad_id': None,
        },
    ]
    r = cli.put(f'{BASE}/presencial/solicitudes/{sid}/borrador/', {'cambios': cambios}, format='json')
    assert r.status_code == 400
    contenido = r.content.decode()
    assert 'codigo_postal_id' not in contenido
    assert 'estado_id' not in contenido
    assert 'municipio_id' not in contenido
    assert 'parroquia_id' not in contenido
    assert 'Estado' in contenido
    assert 'Municipio' in contenido
    assert 'Parroquia' in contenido


def _abrir_proceso(cli_admin, nombre='FE DE VIDA CONCURRENTE'):
    r_proc = cli_admin.post(f'{BASE}/procesos/', {
        'nombre': nombre,
        'fecha_apertura': '2026-01-01T00:00:00Z',
        'fecha_cierre': '2026-12-31T23:59:59Z',
    }, format='json')
    pid = _cuerpo(r_proc)['id']
    cli_admin.post(f'{BASE}/procesos/{pid}/abrir/')
    return pid


def _cli_pasivo():
    return _cliente(PASIVO, {'fe_de_vida.solicitar', 'fe_de_vida.ver_propia'}, pk=2)


def _cambios_contacto(valor='04141234567'):
    # O39: el correo alternativo es obligatorio para enviar la fe de vida.
    return [
        {
            'seccion': 'contacto', 'entidad': 'employee', 'accion': 'MODIFICAR',
            'campo': 'telefono_movil', 'valor': valor,
        },
        {
            'seccion': 'contacto', 'entidad': 'datos_complementarios', 'accion': 'MODIFICAR',
            'campo': 'correo_alternativo', 'valor': 'pasivo.alterno@correo.test',
        },
    ]


def test_presencial_y_autogestion_comparten_la_misma_solicitud_y_no_duplican(datos):
    """A9: si Bienestar inicia la presencial, el pasivo ve y edita ESA misma solicitud."""
    cli_admin = _cliente(ADMINISTRADORA, {'fe_de_vida.gestionar_procesos'})
    pid = _abrir_proceso(cli_admin)
    cli_bienestar = _cliente(ANALISTA, {'fe_de_vida.registrar_presencial'})
    cli_pasivo = _cli_pasivo()

    r_ini = cli_bienestar.post(f'{BASE}/presencial/solicitudes/', {'cedula': PASIVO}, format='json')
    assert r_ini.status_code == 200, r_ini.content
    sid = _cuerpo(r_ini)['solicitud']['id']

    # El pasivo entra a Autogestión y ve exactamente la solicitud presencial.
    r_vig = cli_pasivo.get(f'{BASE}/procesos/vigente/')
    assert r_vig.status_code == 200, r_vig.content
    vigente = _cuerpo(r_vig)
    assert vigente['solicitud']['id'] == sid
    assert vigente['solicitud']['canal'] == 'PRESENCIAL'

    # Ambos guardan el mismo borrador (se bloquea la fila; gana la última escritura).
    r_online = cli_pasivo.put(
        f'{BASE}/mis-solicitudes/{sid}/borrador/',
        {'cambios': _cambios_contacto('04141111111')}, format='json',
    )
    assert r_online.status_code == 200, r_online.content
    r_pres = cli_bienestar.put(
        f'{BASE}/presencial/solicitudes/{sid}/borrador/',
        {'cambios': _cambios_contacto('04142222222')}, format='json',
    )
    assert r_pres.status_code == 200, r_pres.content

    from apps.autogestion.infrastructure.models.actualizacion_models import CambioPropuestoModel
    valores = list(CambioPropuestoModel.objects.filter(
        origen_id=sid, origen_tipo='FE_DE_VIDA', campo='telefono_movil',
    ).values_list('valor_propuesto', flat=True))
    assert valores == ['+584142222222']

    assert SolicitudFeDeVidaModel.objects.filter(proceso_id=pid, cedula=PASIVO).count() == 1


def test_pasivo_envia_y_el_presencial_ya_no_puede_guardar(datos):
    """En cuanto el pasivo envía, el borrador presencial queda bloqueado y no se duplica."""
    cli_admin = _cliente(ADMINISTRADORA, {'fe_de_vida.gestionar_procesos'})
    pid = _abrir_proceso(cli_admin)
    cli_bienestar = _cliente(ANALISTA, {'fe_de_vida.registrar_presencial'})
    cli_pasivo = _cli_pasivo()

    sid = _cuerpo(cli_bienestar.post(
        f'{BASE}/presencial/solicitudes/', {'cedula': PASIVO}, format='json',
    ))['solicitud']['id']

    # El pasivo corrige el borrador desde Autogestión (misma solicitud) y envía.
    r_online = cli_pasivo.put(
        f'{BASE}/mis-solicitudes/{sid}/borrador/',
        {'cambios': _cambios_contacto()}, format='json',
    )
    assert r_online.status_code == 200, r_online.content
    r_foto = cli_pasivo.post(
        f'{BASE}/mis-solicitudes/{sid}/evidencia/',
        {'file': _foto_jpeg(), 'origen': 'CAMARA'}, format='multipart',
    )
    assert r_foto.status_code == 200, r_foto.content
    r_env = cli_pasivo.post(f'{BASE}/mis-solicitudes/{sid}/enviar/', {}, format='json')
    assert r_env.status_code == 200, r_env.content
    assert _cuerpo(r_env)['estado'] == 'PENDIENTE_REVISION'

    r_pres = cli_bienestar.put(
        f'{BASE}/presencial/solicitudes/{sid}/borrador/',
        {'cambios': _cambios_contacto()}, format='json',
    )
    assert r_pres.status_code == 400
    assert 'ya no admite cambios' in str(r_pres.json())

    r_ini = cli_bienestar.post(f'{BASE}/presencial/solicitudes/', {'cedula': PASIVO}, format='json')
    assert _cuerpo(r_ini)['solicitud']['id'] == sid
    assert _cuerpo(r_ini)['solicitud']['estado'] == 'PENDIENTE_REVISION'
    assert SolicitudFeDeVidaModel.objects.filter(proceso_id=pid, cedula=PASIVO).count() == 1


def test_presencial_envia_y_la_autogestion_ya_no_puede_guardar(datos):
    """Al revés: enviada en sede, el portal del pasivo ya no edita el borrador."""
    cli_admin = _cliente(ADMINISTRADORA, {'fe_de_vida.gestionar_procesos'})
    _abrir_proceso(cli_admin)
    cli_bienestar = _cliente(ANALISTA, {'fe_de_vida.registrar_presencial'})
    cli_pasivo = _cli_pasivo()

    r_ini = cli_bienestar.post(f'{BASE}/presencial/solicitudes/', {'cedula': PASIVO}, format='json')
    sid = _cuerpo(r_ini)['solicitud']['id']
    assert cli_bienestar.put(
        f'{BASE}/presencial/solicitudes/{sid}/borrador/',
        {'cambios': _cambios_contacto()}, format='json',
    ).status_code == 200
    assert cli_bienestar.post(
        f'{BASE}/presencial/solicitudes/{sid}/evidencia/',
        {'file': _foto_jpeg(), 'origen': 'ARCHIVO'}, format='multipart',
    ).status_code == 200
    r_env = cli_bienestar.post(
        f'{BASE}/presencial/solicitudes/{sid}/enviar/',
        {'declaracion_presencial': True}, format='json',
    )
    assert r_env.status_code == 200, r_env.content
    assert _cuerpo(r_env)['estado'] == 'PENDIENTE_REVISION'

    r_online = cli_pasivo.put(
        f'{BASE}/mis-solicitudes/{sid}/borrador/',
        {'cambios': _cambios_contacto()}, format='json',
    )
    assert r_online.status_code == 400
    assert 'ya no admite cambios' in str(r_online.json())

    vigente = _cuerpo(cli_pasivo.get(f'{BASE}/procesos/vigente/'))
    assert vigente['solicitud']['id'] == sid
    assert vigente['solicitud']['estado'] == 'PENDIENTE_REVISION'
