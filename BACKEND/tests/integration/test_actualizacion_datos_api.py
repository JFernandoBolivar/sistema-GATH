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
from apps.catalogos.infrastructure.models.catalogo_models import (
    EstadoCivilModel,
    NacionalidadModel,
    ParentescoModel,
    SexoModel,
)
from apps.familiares.infrastructure.models.familiar_models import EmployeefamilyModel
from apps.familiares.infrastructure.models.familiar_models import FamilyDocumentModel
from apps.personal.infrastructure.models.catalogos_soporte_models import (
    AlergiaModel,
    CategoriaAlergiaModel,
    GrupoSanguineoModel,
    RegionTallaModel,
    TallaModel,
    TipoPrendaModel,
)
from apps.personal.infrastructure.models.expediente_models import PerfilFisicoModel, PerfilSaludModel
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

    def eliminar(self, clave):
        self.objetos.pop(clave, None)

    def descargar_flujo(self, clave, tamano_bloque=65536):
        yield self.objetos[clave]

    def descargar(self, clave):
        return self.objetos[clave]


class ResolutorCondicion:
    def condicion_de(self, cedula):
        return 'ACTIVO' if cedula in (TRABAJADOR, OTRO) else 'SIN_ASIGNACION'


@pytest.fixture(autouse=True)
def entorno(monkeypatch):
    AlmacenFalso.objetos = {}
    monkeypatch.setattr('apps.autogestion.presentation.views.solicitud_trabajador_views.SeaweedFSStorage', AlmacenFalso)
    monkeypatch.setattr(
        'apps.autogestion.infrastructure.repositories.aplicador_cambios_orm.SeaweedFSStorage', AlmacenFalso,
    )
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
    for codigo, nombre, soporte in (('identidad', 'Identidad', False), ('contacto', 'Contacto', False),
                                    ('vivienda', 'Vivienda', False), ('formacion', 'Formación', True),
                                    ('familiar', 'Grupo familiar', True), ('salud', 'Salud y tallas', False),
                                    ('foto', 'Foto', False)):
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
    r = c.post(f'{BASE}/solicitudes/', {'secciones': list(secciones), 'motivo': 'Actualizo mis datos de contacto personal'}, format='json')
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
    assert empleado.telefono_movil == '+584245556677'          # aprobado
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
    assert data(otro.get(f'{BASE}/solicitudes/'))['results'] == []
    assert data(trabajador.get(f'{BASE}/solicitudes/'))['count'] == 1
    # La cédula del cuerpo se ignora: la solicitud nace con la de la sesión.
    r = otro.post(f'{BASE}/solicitudes/', {'secciones': ['contacto'], 'motivo': 'solicitud de un trabajador ajeno', 'cedula': TRABAJADOR}, format='json')
    assert data(r)['cedula'] == OTRO


def test_nadie_aprueba_su_propia_solicitud_y_hay_una_abierta_por_seccion(trabajador, analista, datos):
    solicitar(trabajador, ('contacto',))
    r = trabajador.post(f'{BASE}/solicitudes/', {'secciones': ['contacto'], 'motivo': 'otra solicitud distinta de la anterior'}, format='json')
    assert r.status_code == 409
    # Bienestar que también es trabajador no puede decidir lo suyo.
    ambos = cliente(TRABAJADOR, PERMISOS_TRABAJADOR | PERMISOS_BIENESTAR, 1)
    sid = data(ambos.get(f'{BASE}/solicitudes/'))['results'][0]['id']
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
    assert {s['codigo'] for s in secciones} == {
        'identidad', 'contacto', 'vivienda', 'formacion', 'familiar', 'salud', 'foto',
    }
    assert next(s for s in secciones if s['codigo'] == 'formacion')['requiere_soporte'] is True
    assert trabajador.patch(f'{BASE}/bienestar/secciones/vivienda/', {'requiere_soporte': True}, format='json').status_code == 403
    admin = cliente(ADMINISTRADORA, {'bienestar.configurar_secciones'}, 3)
    r = admin.patch(f'{BASE}/bienestar/secciones/vivienda/', {'requiere_soporte': True}, format='json')
    assert r.status_code == 200 and data(r)['requiere_soporte'] is True
    assert admin.patch(f'{BASE}/bienestar/secciones/inexistente/', {'activa': False}, format='json').status_code == 404



def test_campo_por_campo_motivo_devuelta_y_reenvio(trabajador, analista, datos):
    CAMBIO = {'seccion': 'contacto', 'entidad': 'employee', 'accion': 'MODIFICAR', 'campo': 'telefono_movil', 'valor': '04245556677'}
    # Motivo corto o campo del correo institucional: 400.
    corto = trabajador.post(f'{BASE}/solicitudes/', {'campos': ['employee.telefono_movil'], 'motivo': 'cambio'}, format='json')
    assert corto.status_code == 400
    correo = trabajador.post(f'{BASE}/solicitudes/', {'campos': ['employee.correo'], 'motivo': 'quiero cambiar mi correo institucional'}, format='json')
    assert correo.status_code == 400
    r = trabajador.post(f'{BASE}/solicitudes/', {'campos': ['employee.telefono_movil'], 'motivo': 'Cambié de número de teléfono móvil'}, format='json')
    assert r.status_code == 201 and data(r)['campos_solicitados'] == ['employee.telefono_movil']
    sid = data(r)['id']
    assert data(habilitar(analista, sid) and analista.get(f'{BASE}/bienestar/solicitudes/{sid}/'))['campos_habilitados'] == ['employee.telefono_movil']
    # Un campo de la misma sección que no se pidió se rechaza en el servidor.
    ajeno = dict(CAMBIO, campo='telefono_habitacion', valor='02129998877')
    assert trabajador.put(f'{BASE}/solicitudes/{sid}/borrador/', {'cambios': [ajeno]}, format='json').status_code == 400
    assert trabajador.put(f'{BASE}/solicitudes/{sid}/borrador/', {'cambios': [CAMBIO]}, format='json').status_code == 200
    assert trabajador.post(f'{BASE}/solicitudes/{sid}/enviar/', {}, format='json').status_code == 200
    # Devolver exige motivo y permiso de decisión; el trabajador corrige y reenvía.
    assert trabajador.post(f'{BASE}/bienestar/solicitudes/{sid}/devolver/', {'motivo': 'x'}, format='json').status_code == 403
    assert analista.post(f'{BASE}/bienestar/solicitudes/{sid}/devolver/', {'motivo': ''}, format='json').status_code == 400
    r = analista.post(f'{BASE}/bienestar/solicitudes/{sid}/devolver/', {'motivo': 'El número no coincide'}, format='json')
    assert r.status_code == 200 and data(r)['estado'] == 'DEVUELTA'
    propia = data(trabajador.get(f'{BASE}/solicitudes/{sid}/'))
    assert propia['motivo_devolucion'] == 'El número no coincide'
    corregido = dict(CAMBIO, valor='04165554433')
    assert trabajador.put(f'{BASE}/solicitudes/{sid}/borrador/', {'cambios': [corregido]}, format='json').status_code == 200
    r = trabajador.post(f'{BASE}/solicitudes/{sid}/enviar/', {}, format='json')
    assert r.status_code == 200 and data(r)['estado'] == 'ENVIADA'
    # La bandeja pagina de a 10 por defecto y con tope de 50.
    lista = data(analista.get(f'{BASE}/bienestar/solicitudes/?limit=500'))
    assert lista['limit'] == 50
    assert data(analista.get(f'{BASE}/bienestar/solicitudes/'))['limit'] == 10


def test_mis_solicitudes_paginan_en_servidor_y_filtran_por_estado_y_fechas(trabajador, analista):
    sid = solicitar(trabajador, ('contacto',))
    habilitar(analista, sid)
    hoy = timezone.localdate().isoformat()
    base = f'{BASE}/solicitudes/'
    p = data(trabajador.get(base))
    assert (p['count'], p['limit'], p['offset']) == (1, 10, 0)
    assert data(trabajador.get(base + '?limit=500'))['limit'] == 50
    assert data(trabajador.get(base + '?estado=HABILITADA'))['count'] == 1
    assert data(trabajador.get(base + '?estado=SOLICITADA'))['count'] == 0
    assert data(trabajador.get(f'{base}?fecha_desde={hoy}&fecha_hasta={hoy}'))['count'] == 1
    assert data(trabajador.get(base + '?fecha_hasta=2000-01-01'))['count'] == 0
    assert data(trabajador.get(base + '?offset=1'))['results'] == []
    assert trabajador.get(base + '?estado=XYZ').status_code == 400
    assert trabajador.get(f'{base}?fecha_desde={hoy}&fecha_hasta=2000-01-01').status_code == 400
    assert trabajador.get(base + '?fecha_desde=ayer').status_code == 400

def test_quitar_y_corregir_con_documento_por_registro_copia_al_expediente(trabajador, analista):
    sid = solicitar(trabajador, ('familiar',))
    habilitar(analista, sid)
    referencia = 'ref-nuevo-familiar'
    cambios = [
        {'seccion': 'familiar', 'entidad': 'familiar', 'accion': 'CREAR', 'campo': '*', 'referencia': referencia, 'valor': {
            'primer_nombre': 'MATEO', 'primer_apellido': 'PRUEBA', 'parentesco_id': 1,
            'fecha_nacimiento': (timezone.now().date() - timedelta(days=365 * 5)).isoformat(), 'sexo_id': 1}},
    ]
    assert trabajador.put(f'{BASE}/solicitudes/{sid}/borrador/', {'cambios': cambios}, format='json').status_code == 200
    acta = trabajador.post(f'{BASE}/solicitudes/{sid}/soportes/', {
        'seccion': 'familiar', 'tipo': 'ACTA_NACIMIENTO', 'referencia': referencia,
        'file': SimpleUploadedFile('acta.pdf', PDF, 'application/pdf'),
    }, format='multipart')
    assert acta.status_code == 201, acta.content
    assert trabajador.post(f'{BASE}/solicitudes/{sid}/enviar/', {}, format='json').status_code == 200
    comparativo = data(analista.get(f'{BASE}/bienestar/solicitudes/{sid}/comparativo/'))
    decisiones = [{'cambio_id': c['id'], 'aprobado': True, 'motivo': ''} for c in comparativo['cambios']]
    r = analista.post(f'{BASE}/bienestar/solicitudes/{sid}/decidir/',
                      {'version': comparativo['version'], 'decisiones': decisiones}, format='json')
    assert r.status_code == 200, r.content
    familiar = EmployeefamilyModel.objects.get(employeecedula_id=TRABAJADOR, primer_nombre='MATEO')
    documento = FamilyDocumentModel.objects.get(familymember_id=familiar.pk)
    assert documento.document_type == 'partida_nacimiento'
    assert documento.file.name in AlmacenFalso.objetos


def test_quitar_contacto_aprobado_lo_elimina_de_la_ficha(trabajador, analista):
    from apps.personal.infrastructure.models.expediente_models import ContactoEmergenciaModel

    empleado = EmployeeModel.objects.get(cedulaidentidad=TRABAJADOR)
    contacto = ContactoEmergenciaModel.objects.create(
        empleado=empleado, nombres='VIEJO', apellidos='CONTACTO', telefono='+584141234567',
        relacion=ParentescoModel.objects.get(id=1),
    )
    sid = solicitar(trabajador, ('contacto',))
    habilitar(analista, sid)
    cambios = [
        {'seccion': 'contacto', 'entidad': 'contacto_emergencia', 'accion': 'ELIMINAR', 'campo': '*',
         'entidad_id': str(contacto.pk), 'valor': {'motivo': 'El contacto ya no está disponible'}},
    ]
    assert trabajador.put(f'{BASE}/solicitudes/{sid}/borrador/', {'cambios': cambios}, format='json').status_code == 200
    assert trabajador.post(f'{BASE}/solicitudes/{sid}/enviar/', {}, format='json').status_code == 200
    comparativo = data(analista.get(f'{BASE}/bienestar/solicitudes/{sid}/comparativo/'))
    decisiones = [{'cambio_id': c['id'], 'aprobado': True, 'motivo': ''} for c in comparativo['cambios']]
    r = analista.post(f'{BASE}/bienestar/solicitudes/{sid}/decidir/',
                      {'version': comparativo['version'], 'decisiones': decisiones}, format='json')
    assert r.status_code == 200, r.content
    assert not ContactoEmergenciaModel.objects.filter(pk=contacto.pk).exists()


def test_identidad_con_copia_de_cedula_y_salud_sin_documento(trabajador, analista):
    """D19: la identidad exige copia de cédula y el cambio de cédula arrastra sus referencias.
    D21: estado civil, carnet, salud y tallas entran sin documento."""
    estado = EstadoCivilModel.objects.get_or_create(estadoCivil='O10 PRUEBA')[0]
    categoria = CategoriaAlergiaModel.objects.get_or_create(nombre_categoria='O10 PRUEBA')[0]
    alergia = AlergiaModel.objects.get_or_create(alergia='O10 PRUEBA', defaults={'categoria': categoria})[0]
    grupo = GrupoSanguineoModel.objects.get_or_create(GrupoSanguineo='O10 PRUEBA')[0]
    region = RegionTallaModel.objects.get_or_create(codigo='O10', defaults={'descripcion': 'O10'})[0]
    prenda = TipoPrendaModel.objects.get_or_create(categoria='Camisa')[0]
    talla = TallaModel.objects.create(valor='O10', region=region, tipo_prenda=prenda)
    nueva_cedula = '20999999'

    sid = solicitar(trabajador, ('identidad', 'salud'))
    habilitar(analista, sid)
    cambios = [
        {'seccion': 'identidad', 'entidad': 'employee', 'accion': 'MODIFICAR', 'campo': 'nombres', 'valor': 'MARIA ELENA'},
        {'seccion': 'identidad', 'entidad': 'employee', 'accion': 'MODIFICAR', 'campo': 'cedulaidentidad', 'valor': nueva_cedula},
        {'seccion': 'identidad', 'entidad': 'employee', 'accion': 'MODIFICAR', 'campo': 'fecha_nacimiento', 'valor': '1990-05-04'},
        {'seccion': 'identidad', 'entidad': 'employee', 'accion': 'MODIFICAR', 'campo': 'estadoCivil_id', 'valor': estado.pk},
        {'seccion': 'identidad', 'entidad': 'employee', 'accion': 'MODIFICAR', 'campo': 'carnet_patria', 'valor': '123-4567890-1'},
        {'seccion': 'salud', 'entidad': 'perfil_salud', 'accion': 'MODIFICAR', 'campo': 'grupo_sanguineo_id', 'valor': grupo.pk},
        {'seccion': 'salud', 'entidad': 'perfil_salud', 'accion': 'MODIFICAR', 'campo': 'alergias', 'valor': [alergia.pk]},
        {'seccion': 'salud', 'entidad': 'perfil_fisico', 'accion': 'MODIFICAR', 'campo': 'talla_camisa_id', 'valor': talla.pk},
    ]
    assert trabajador.put(f'{BASE}/solicitudes/{sid}/borrador/', {'cambios': cambios}, format='json').status_code == 200
    # Sin copia de cédula no se puede enviar una solicitud de identidad.
    sin_soporte = trabajador.post(f'{BASE}/solicitudes/{sid}/enviar/', {}, format='json')
    assert sin_soporte.status_code == 400 and 'CEDULA' in str(sin_soporte.json())
    cedula = trabajador.post(f'{BASE}/solicitudes/{sid}/soportes/', {
        'seccion': 'identidad', 'tipo': 'CEDULA',
        'file': SimpleUploadedFile('cedula.pdf', PDF, 'application/pdf'),
    }, format='multipart')
    assert cedula.status_code == 201, cedula.content
    assert trabajador.post(f'{BASE}/solicitudes/{sid}/enviar/', {}, format='json').status_code == 200

    comparativo = data(analista.get(f'{BASE}/bienestar/solicitudes/{sid}/comparativo/'))
    decisiones = [{'cambio_id': c['id'], 'aprobado': True, 'motivo': ''} for c in comparativo['cambios']]
    r = analista.post(f'{BASE}/bienestar/solicitudes/{sid}/decidir/',
                      {'version': comparativo['version'], 'decisiones': decisiones}, format='json')
    assert r.status_code == 200, r.content

    assert not EmployeeModel.objects.filter(cedulaidentidad=TRABAJADOR).exists()
    empleado = EmployeeModel.objects.get(cedulaidentidad=nueva_cedula)
    assert empleado.nombres == 'MARIA ELENA'
    assert empleado.fecha_nacimiento.isoformat() == '1990-05-04'
    assert empleado.estadoCivil_id == estado.pk
    assert empleado.carnet_patria == '1234567890'
    salud = PerfilSaludModel.objects.get(empleado=empleado)
    assert list(salud.alergias.values_list('pk', flat=True)) == [alergia.pk]
    assert PerfilFisicoModel.objects.get(empleado=empleado).tallaCamisa_id == talla.pk
    # La solicitud y sus reservas siguen a la nueva cédula.
    assert SolicitudActualizacionModel.objects.get(pk=sid).cedula == nueva_cedula


def test_acciones_solicitadas_en_seccion_de_lista(trabajador, analista, datos):
    r = trabajador.post(
        f'{BASE}/solicitudes/',
        {'campos': ['familiar.@CREAR'], 'motivo': 'Quiero agregar un familiar nuevo a mi grupo'}, format='json',
    )
    assert r.status_code == 201, r.content
    assert data(r)['campos_solicitados'] == ['familiar.@CREAR']
    sid = data(r)['id']
    assert data(habilitar(analista, sid) and analista.get(f'{BASE}/bienestar/solicitudes/{sid}/'))['campos_habilitados'] == ['familiar.@CREAR']
    quitar = {'seccion': 'familiar', 'entidad': 'familiar', 'accion': 'ELIMINAR', 'campo': '*', 'entidad_id': '1', 'valor': {'motivo': 'Ya no vive con el trabajador'}}
    rechazo = trabajador.put(f'{BASE}/solicitudes/{sid}/borrador/', {'cambios': [quitar]}, format='json')
    assert rechazo.status_code == 400 and 'quitar' in rechazo.content.decode()
    mal = trabajador.post(f'{BASE}/solicitudes/', {'campos': ['familiar.@BORRAR'], 'motivo': 'Quiero agregar un familiar nuevo a mi grupo'}, format='json')
    assert mal.status_code == 400
