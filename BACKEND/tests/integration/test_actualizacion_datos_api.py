"""
Integración (BD de pruebas, nunca la real) de la autogestión por solicitud, PLAN_PRIORIDAD B-T:
solicitar -> habilitar -> borrador + soportes -> enviar -> aprobar parcial -> solo lo aprobado se aplica.
Autenticación forzada con usuarios de prueba; almacén y condición del trabajador simulados.
"""
from datetime import timedelta

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone
from rest_framework.test import APIClient

from apps.autogestion.infrastructure.models.actualizacion_models import (
    CambioPropuestoModel,
    DatosComplementariosTrabajadorModel,
    SeccionAbiertaModel,
    SeccionAutogestionableModel,
    SolicitudActualizacionModel,
)
from apps.autogestion.infrastructure.tasks.expirar_ventanas_tasks import expirar_ventanas_vencidas
from apps.catalogos.infrastructure.models.catalogo_models import NacionalidadModel, ParentescoModel, SexoModel
from apps.familiares.infrastructure.models.familiar_models import EmployeefamilyModel
from apps.personal.infrastructure.models.personal_models import EmployeeModel
from core.infrastructure.models.auditoria import AuditoriaLog

BASE = '/api/v1/autogestion'
TRABAJADOR, OTRO, ANALISTA, ADMINISTRADORA = '20111234', '20444444', '20222222', '20333333'
PDF = b'%PDF-1.4 soporte de prueba'
JPG = b'\xff\xd8\xff\xe0 foto de prueba'
PERMISOS_TRABAJADOR = {
    'autogestion.ver_propio', 'autogestion.solicitar_actualizacion', 'autogestion.editar_borrador', 'autogestion.subir_soporte',
}
PERMISOS_BIENESTAR = {
    'bienestar.ver_solicitudes', 'bienestar.habilitar_ventana', 'bienestar.revisar_actualizacion',
    'bienestar.aprobar', 'bienestar.prorrogar_ventana', 'autogestion.ver_propio',
}


class Usuario:
    is_authenticated = True
    is_active = True

    def __init__(self, cedula, permisos, pk):
        self.cedula_id, self.pk, self.id, self._permisos = cedula, pk, pk, set(permisos)
        self.rol = None

    def tiene_permiso(self, codigo):
        return codigo in self._permisos


class AlmacenFalso:
    objetos: dict = {}

    def subir(self, clave, contenido, mime_type='application/octet-stream'):
        self.objetos[clave] = contenido
        return clave

    def descargar_flujo(self, clave, tamano_bloque=65536):
        yield self.objetos[clave]


class ResolutorCondicion:
    def condicion_de(self, cedula):
        return 'ACTIVO' if cedula in (TRABAJADOR, OTRO) else 'SIN_ASIGNACION'


@pytest.fixture(autouse=True)
def entorno(monkeypatch):
    AlmacenFalso.objetos = {}
    monkeypatch.setattr('apps.autogestion.presentation.views.solicitud_trabajador_views.SeaweedFSStorage', AlmacenFalso)
    monkeypatch.setattr('core.presentation.permissions.obtener_resolutor_condicion', lambda: ResolutorCondicion())


@pytest.fixture
def datos(db):
    sexo, _ = SexoModel.objects.get_or_create(id=1, defaults={'sexo': 'FEMENINO'})
    NacionalidadModel.objects.get_or_create(id=1, defaults={'codigo': 'V', 'nombre': 'VENEZOLANO'})
    for cedula, nombre in ((TRABAJADOR, 'MARIA'), (OTRO, 'JUAN'), (ANALISTA, 'ANA'), (ADMINISTRADORA, 'ELENA')):
        EmployeeModel.objects.get_or_create(cedulaidentidad=cedula, defaults={
            'nombres': nombre, 'apellidos': 'PRUEBA', 'sexoid': sexo, 'correo': f'{cedula}@conatel.gob.ve',
            'telefono_movil': '04141111111', 'telefono_habitacion': '02121111111', 'profile': 'perfiles/viejo.jpg',
        })
    ParentescoModel.objects.get_or_create(id=1, defaults={'descripcion_parentesco': 'HIJO (A)'})
    for codigo, nombre, soporte in (('contacto', 'Contacto', False), ('vivienda', 'Vivienda', False),
                                    ('formacion', 'Formación', True), ('familiar', 'Grupo familiar', True), ('foto', 'Foto', False)):
        SeccionAutogestionableModel.objects.get_or_create(codigo=codigo, defaults={'nombre': nombre, 'requiere_soporte': soporte})
    return sexo


def cliente(cedula, permisos, pk=1):
    c = APIClient()
    c.force_authenticate(user=Usuario(cedula, permisos, pk))
    return c


@pytest.fixture
def trabajador(datos):
    return cliente(TRABAJADOR, PERMISOS_TRABAJADOR, 1)


@pytest.fixture
def analista(datos):
    return cliente(ANALISTA, PERMISOS_BIENESTAR, 2)


def data(respuesta):
    return respuesta.json()['data']


def solicitar(c, secciones=('contacto', 'familiar', 'foto')):
    r = c.post(f'{BASE}/solicitudes/', {'secciones': list(secciones), 'motivo': 'Actualizo mis datos'}, format='json')
    assert r.status_code == 201, r.content
    return data(r)['id']


def habilitar(c, sid, dias=7):
    r = c.post(f'{BASE}/bienestar/solicitudes/{sid}/habilitar/', {'plazo_dias': dias}, format='json')
    assert r.status_code == 200, r.content
    return data(r)


def test_flujo_completo_solicita_habilita_carga_envia_y_aprueba_parcial(trabajador, analista):
    sid = solicitar(trabajador)
    assert data(analista.get(f'{BASE}/bienestar/solicitudes/?estado=SOLICITADA'))['count'] == 1
    habilitada = habilitar(analista, sid)
    assert habilitada['estado'] == 'HABILITADA' and habilitada['habilitada_por'] == ANALISTA

    cambios = [
        {'seccion': 'contacto', 'entidad': 'employee', 'accion': 'MODIFICAR', 'campo': 'telefono_movil', 'valor': '04245556677'},
        {'seccion': 'contacto', 'entidad': 'employee', 'accion': 'MODIFICAR', 'campo': 'telefono_habitacion', 'valor': '02129998877'},
        {'seccion': 'contacto', 'entidad': 'datos_complementarios', 'accion': 'MODIFICAR', 'campo': 'correo_alternativo', 'valor': 'maria@gmail.com'},
        {'seccion': 'familiar', 'entidad': 'familiar', 'accion': 'CREAR', 'campo': '*', 'valor': {
            'primer_nombre': 'LUCIA', 'primer_apellido': 'PRUEBA', 'parentesco_id': 1,
            'fecha_nacimiento': (timezone.now().date() - timedelta(days=365 * 4)).isoformat(), 'sexo_id': 1}},
    ]
    r = trabajador.put(f'{BASE}/solicitudes/{sid}/borrador/', {'cambios': cambios}, format='json')
    assert r.status_code == 200, r.content

    # Soporte obligatorio del grupo familiar: sin él no se puede enviar.
    assert trabajador.post(f'{BASE}/solicitudes/{sid}/enviar/', {}, format='json').status_code == 400
    acta = trabajador.post(f'{BASE}/solicitudes/{sid}/soportes/', {
        'seccion': 'familiar', 'tipo': 'ACTA_NACIMIENTO', 'file': SimpleUploadedFile('acta.pdf', PDF, 'application/pdf'),
    }, format='multipart')
    assert acta.status_code == 201, acta.content
    foto = trabajador.post(f'{BASE}/solicitudes/{sid}/soportes/', {
        'seccion': 'foto', 'tipo': 'FOTO', 'file': SimpleUploadedFile('yo.jpg', JPG, 'image/jpeg'),
    }, format='multipart')
    assert foto.status_code == 201, foto.content
    # Contenido que no corresponde a la extensión: rechazado.
    falso = trabajador.post(f'{BASE}/solicitudes/{sid}/soportes/', {
        'seccion': 'familiar', 'tipo': 'OTRO', 'file': SimpleUploadedFile('x.pdf', b'no soy pdf', 'application/pdf'),
    }, format='multipart')
    assert falso.status_code == 400

    enviada = trabajador.post(f'{BASE}/solicitudes/{sid}/enviar/', {}, format='json')
    assert enviada.status_code == 200 and data(enviada)['estado'] == 'ENVIADA'
    # Ventana cerrada: ya no admite cambios.
    assert trabajador.put(f'{BASE}/solicitudes/{sid}/borrador/', {'cambios': []}, format='json').status_code == 409

    # La ficha real NO cambia antes de la aprobación.
    empleado = EmployeeModel.objects.get(cedulaidentidad=TRABAJADOR)
    assert empleado.telefono_movil == '04141111111' and empleado.profile == 'perfiles/viejo.jpg'
    assert not EmployeefamilyModel.objects.filter(employeecedula_id=TRABAJADOR).exists()

    comparativo = data(analista.get(f'{BASE}/bienestar/solicitudes/{sid}/comparativo/'))
    por_campo = {c['campo']: c for c in comparativo['cambios']}
    assert por_campo['telefono_movil']['valor_anterior'] == '04141111111'
    assert por_campo['telefono_movil']['valor_actual'] == '04141111111' and not por_campo['telefono_movil']['conflicto']
    assert len(comparativo['soportes']) == 2

    # Aprueba UNA sola persona, campo por campo: rechaza el teléfono de habitación.
    decisiones = [
        {'cambio_id': c['id'], 'aprobado': c['campo'] != 'telefono_habitacion',
         'motivo': '' if c['campo'] != 'telefono_habitacion' else 'No coincide con el soporte'}
        for c in comparativo['cambios']
    ]
    r = analista.post(f'{BASE}/bienestar/solicitudes/{sid}/decidir/', {'version': comparativo['version'], 'decisiones': decisiones}, format='json')
    assert r.status_code == 200, r.content
    resultado = data(r)
    assert resultado['estado'] == 'APROBADA_PARCIAL' and resultado['decidida_por'] == ANALISTA

    empleado.refresh_from_db()
    assert empleado.telefono_movil == '04245556677'          # aprobado
    assert empleado.telefono_habitacion == '02121111111'      # rechazado: intacto
    assert empleado.profile.startswith(f'autogestion/soportes/{TRABAJADOR}/')  # foto aprobada
    assert DatosComplementariosTrabajadorModel.objects.get(cedula=TRABAJADOR).correo_alternativo == 'maria@gmail.com'
    familiar = EmployeefamilyModel.objects.get(employeecedula_id=TRABAJADOR)
    assert familiar.primer_nombre == 'LUCIA' and familiar.cedulaFamiliar == f'{TRABAJADOR}-1'
    rechazado = CambioPropuestoModel.objects.get(origen_id=sid, campo='telefono_habitacion')
    assert rechazado.decision == 'RECHAZADO' and rechazado.motivo_decision and rechazado.decidido_por == ANALISTA
    assert not SeccionAbiertaModel.objects.filter(solicitud_id=sid).exists()  # secciones liberadas
    # Auditoría de cada hito, con user-agent.
    acciones = set(AuditoriaLog.objects.filter(recurso_id=sid).values_list('accion', flat=True))
    assert {'SOLICITUD_CREADA', 'VENTANA_HABILITADA', 'BORRADOR_GUARDADO', 'SOPORTE_ADJUNTADO',
            'SOLICITUD_ENVIADA', 'ACTUALIZACION_DECIDIDA'} <= acciones

    # Una segunda decisión ya no cabe (no hay doble aprobación ni reapertura).
    otra = cliente(ADMINISTRADORA, PERMISOS_BIENESTAR, 3)
    assert otra.post(f'{BASE}/bienestar/solicitudes/{sid}/decidir/', {'version': 99, 'decisiones': decisiones}, format='json').status_code == 409


def test_soportes_se_sirven_solo_al_dueno_y_a_bienestar(trabajador, analista, datos):
    sid = solicitar(trabajador, ('familiar',))
    habilitar(analista, sid)
    soporte = data(trabajador.post(f'{BASE}/solicitudes/{sid}/soportes/', {
        'seccion': 'familiar', 'tipo': 'ACTA_NACIMIENTO', 'file': SimpleUploadedFile('acta.pdf', PDF, 'application/pdf'),
    }, format='multipart'))
    url = soporte['url_archivo']
    propio = trabajador.get(url)
    assert propio.status_code == 200 and propio['Content-Type'] == 'application/pdf'
    assert b''.join(propio.streaming_content) == PDF and 'no-store' in propio['Cache-Control']
    assert analista.get(url).status_code == 200
    assert cliente(OTRO, PERMISOS_TRABAJADOR, 4).get(url).status_code == 404
    assert APIClient().get(url).status_code in (401, 403)


def test_permisos_y_condicion(trabajador, analista, datos):
    sid = solicitar(trabajador, ('contacto',))
    # El trabajador no puede habilitar ni decidir; Bienestar no puede solicitar por sí (sin permiso del trabajador).
    assert trabajador.post(f'{BASE}/bienestar/solicitudes/{sid}/habilitar/', {'plazo_dias': 3}, format='json').status_code == 403
    assert trabajador.post(f'{BASE}/bienestar/solicitudes/{sid}/decidir/', {'version': 1, 'decisiones': []}, format='json').status_code == 403
    assert trabajador.get(f'{BASE}/bienestar/solicitudes/').status_code == 403
    assert analista.post(f'{BASE}/solicitudes/', {'secciones': ['contacto'], 'motivo': 'x'}, format='json').status_code == 403
    # Solo ACTIVO puede solicitar: un trabajador sin asignación (o pasivo) recibe 403 aunque tenga el permiso.
    sin_asignacion = cliente(ANALISTA, PERMISOS_TRABAJADOR, 9)
    assert sin_asignacion.post(f'{BASE}/solicitudes/', {'secciones': ['vivienda'], 'motivo': 'x'}, format='json').status_code == 403
    # Con solo `bienestar.revisar_actualizacion` se puede rechazar una SOLICITADA, no una ENVIADA.
    revisor = cliente(ADMINISTRADORA, {'bienestar.revisar_actualizacion'}, 5)
    assert revisor.post(f'{BASE}/bienestar/solicitudes/{sid}/rechazar/', {'motivo': 'Sin sustento'}, format='json').status_code == 200
    assert data(trabajador.get(f'{BASE}/solicitudes/{sid}/'))['estado'] == 'RECHAZADA'


def test_zero_idor_cada_trabajador_ve_solo_lo_suyo(trabajador, datos):
    sid = solicitar(trabajador, ('contacto',))
    otro = cliente(OTRO, PERMISOS_TRABAJADOR, 4)
    assert otro.get(f'{BASE}/solicitudes/{sid}/').status_code == 404
    assert otro.put(f'{BASE}/solicitudes/{sid}/borrador/', {'cambios': []}, format='json').status_code == 404
    assert otro.post(f'{BASE}/solicitudes/{sid}/enviar/', {}, format='json').status_code == 404
    assert data(otro.get(f'{BASE}/solicitudes/')) == []
    assert len(data(trabajador.get(f'{BASE}/solicitudes/'))) == 1
    # La cédula del cuerpo se ignora: la solicitud nace con la de la sesión.
    r = otro.post(f'{BASE}/solicitudes/', {'secciones': ['contacto'], 'motivo': 'x', 'cedula': TRABAJADOR}, format='json')
    assert data(r)['cedula'] == OTRO


def test_nadie_aprueba_su_propia_solicitud_y_hay_una_abierta_por_seccion(trabajador, analista, datos):
    solicitar(trabajador, ('contacto',))
    r = trabajador.post(f'{BASE}/solicitudes/', {'secciones': ['contacto'], 'motivo': 'otra'}, format='json')
    assert r.status_code == 409
    # Bienestar que también es trabajador no puede decidir lo suyo.
    ambos = cliente(TRABAJADOR, PERMISOS_TRABAJADOR | PERMISOS_BIENESTAR, 1)
    sid = data(ambos.get(f'{BASE}/solicitudes/'))[0]['id']
    habilitar(ambos, sid)
    ambos.put(f'{BASE}/solicitudes/{sid}/borrador/', {'cambios': [
        {'seccion': 'contacto', 'entidad': 'employee', 'accion': 'MODIFICAR', 'campo': 'telefono_movil', 'valor': '04245556677'},
    ]}, format='json')
    ambos.post(f'{BASE}/solicitudes/{sid}/enviar/', {}, format='json')
    cambio = data(ambos.get(f'{BASE}/bienestar/solicitudes/{sid}/'))['cambios'][0]
    r = ambos.post(f'{BASE}/bienestar/solicitudes/{sid}/decidir/', {
        'version': data(ambos.get(f'{BASE}/solicitudes/{sid}/'))['version'],
        'decisiones': [{'cambio_id': cambio['id'], 'aprobado': True}],
    }, format='json')
    assert r.status_code == 409
    assert EmployeeModel.objects.get(cedulaidentidad=TRABAJADOR).telefono_movil == '04141111111'


def test_campos_no_autogestionables_se_rechazan_en_el_servidor(trabajador, analista, datos):
    sid = solicitar(trabajador, ('contacto',))
    habilitar(analista, sid)
    for campo in ('cedula', 'correo', 'nombres', 'estatus'):
        r = trabajador.put(f'{BASE}/solicitudes/{sid}/borrador/', {'cambios': [
            {'seccion': 'contacto', 'entidad': 'employee', 'accion': 'MODIFICAR', 'campo': campo, 'valor': 'X'},
        ]}, format='json')
        assert r.status_code == 400, campo
    assert not CambioPropuestoModel.objects.filter(origen_id=sid).exists()


def test_prorroga_y_expiracion_por_tarea_periodica(trabajador, analista, datos):
    sid = solicitar(trabajador, ('contacto',))
    habilitar(analista, sid, dias=1)
    nueva = (timezone.now() + timedelta(days=10)).isoformat()
    r = analista.post(f'{BASE}/bienestar/solicitudes/{sid}/prorrogar/', {'nueva_fecha_fin': nueva, 'motivo': 'Vacaciones'}, format='json')
    assert r.status_code == 200 and len(data(analista.get(f'{BASE}/bienestar/solicitudes/{sid}/'))['prorrogas']) == 1
    assert expirar_ventanas_vencidas() == 0  # la prórroga la mantiene vigente
    SolicitudActualizacionModel.objects.filter(pk=sid).update(ventana_fin=timezone.now() - timedelta(minutes=1))
    assert expirar_ventanas_vencidas() == 1
    assert expirar_ventanas_vencidas() == 0  # idempotente
    assert data(trabajador.get(f'{BASE}/solicitudes/{sid}/'))['estado'] == 'EXPIRADA'
    assert trabajador.put(f'{BASE}/solicitudes/{sid}/borrador/', {'cambios': []}, format='json').status_code == 409
    solicitar(trabajador, ('contacto',))  # EXPIRADA: puede solicitar de nuevo


def test_mi_expediente_incluye_datos_complementarios_y_rrhh_los_gestiona(datos, trabajador):
    rrhh = cliente(ANALISTA, {'personal.ver_detalle', 'personal.editar_personales'}, 2)
    r = rrhh.put(f'{BASE}/datos-complementarios/{TRABAJADOR}/', {'correo_alternativo': 'maria@hotmail.com', 'tiene_hijos': False}, format='json')
    assert r.status_code == 200 and data(r)['tiene_hijos'] is False
    mios = data(trabajador.get(f'{BASE}/mis-datos-complementarios/'))
    assert mios['correo_alternativo'] == 'maria@hotmail.com' and mios['actualizado_por'] == ANALISTA
    assert rrhh.put(f'{BASE}/datos-complementarios/{TRABAJADOR}/', {'correo_alternativo': 'malo'}, format='json').status_code == 400
    assert trabajador.put(f'{BASE}/datos-complementarios/{TRABAJADOR}/', {'tiene_hijos': True}, format='json').status_code == 403


def test_secciones_publicas_y_configurables_solo_con_permiso(trabajador, datos):
    secciones = data(trabajador.get(f'{BASE}/secciones/'))
    assert {s['codigo'] for s in secciones} == {'contacto', 'vivienda', 'formacion', 'familiar', 'foto'}
    assert next(s for s in secciones if s['codigo'] == 'formacion')['requiere_soporte'] is True
    assert trabajador.patch(f'{BASE}/bienestar/secciones/vivienda/', {'requiere_soporte': True}, format='json').status_code == 403
    admin = cliente(ADMINISTRADORA, {'bienestar.configurar_secciones'}, 3)
    r = admin.patch(f'{BASE}/bienestar/secciones/vivienda/', {'requiere_soporte': True}, format='json')
    assert r.status_code == 200 and data(r)['requiere_soporte'] is True
    assert admin.patch(f'{BASE}/bienestar/secciones/inexistente/', {'activa': False}, format='json').status_code == 404

