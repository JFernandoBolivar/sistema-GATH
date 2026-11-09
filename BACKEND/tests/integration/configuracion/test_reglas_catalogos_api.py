"""O36: alta, edición y baja de parentescos y tipos de nómina por API."""
import pytest
from rest_framework.test import APIClient

from apps.autogestion.infrastructure.models.soporte_config_models import (
    ChecklistSoporteSeccionModel,
    TipoSoporteDocumentoModel,
)
from apps.catalogos.infrastructure.models.catalogo_models import (
    PaisModel,
    ParentescoModel,
    TipoNominaModel,
)
from apps.configuracion.infrastructure.models.regla_parentesco_model import (
    ReglaParentescoModel,
)

pytestmark = pytest.mark.django_db

BASE = '/api/v1/configuracion/reglas-catalogos'
LISTA = f'{BASE}/'
PARENTESCOS = f'{BASE}/parentescos/'
NOMINAS = f'{BASE}/nominas/'
PAISES = f'{BASE}/paises/'
TIPOS_SOPORTE = f'{BASE}/tipos-soporte/'
PERMISOS = ('configuracion.ver', 'configuracion.editar')


class Usuario:
    is_authenticated = True
    is_active = True

    def __init__(self, permisos, pk=1, cedula='V12345678'):
        self.pk = self.id = pk
        self.cedula_id = cedula
        self.rol = type('Rol', (), {'nombre_rol': 'ADMINISTRADOR'})()
        self._permisos = set(permisos)

    def tiene_permiso(self, codigo):
        return codigo in self._permisos


def cliente(*permisos):
    api = APIClient()
    api.force_authenticate(user=Usuario(permisos))
    return api


def data(respuesta):
    return respuesta.json()['data']


def test_crear_editar_y_eliminar_parentesco_sin_referencias():
    api = cliente(*PERMISOS)

    creado = api.post(PARENTESCOS, {'descripcion': '  PRIMO   HERMANO '}, format='json')
    assert creado.status_code == 201, creado.content
    parentesco = data(creado)
    assert parentesco['descripcion'] == 'PRIMO HERMANO'

    repetido = api.post(PARENTESCOS, {'descripcion': 'primo hermano'}, format='json')
    assert repetido.status_code == 400
    assert 'Ya existe' in repetido.json()['message']

    editado = api.patch(
        f"{PARENTESCOS}{parentesco['id']}/", {'descripcion': 'PRIMO'}, format='json',
    )
    assert editado.status_code == 200, editado.content
    assert data(editado)['descripcion'] == 'PRIMO'

    eliminado = api.delete(f"{PARENTESCOS}{parentesco['id']}/")
    assert eliminado.status_code == 200, eliminado.content
    assert not ParentescoModel.objects.filter(pk=parentesco['id']).exists()

    listado = api.get(LISTA)
    assert listado.status_code == 200
    assert all(p['descripcion'] != 'PRIMO' for p in data(listado)['parentescos'])


def test_crear_editar_y_eliminar_pais():
    api = cliente(*PERMISOS)

    creado = api.post(PAISES, {'nombre': '  Chile ', 'codigo': 'cl'}, format='json')
    assert creado.status_code == 201, creado.content
    pais = data(creado)
    assert pais['nombre'] == 'Chile'
    assert pais['codigo'] == 'CL'
    assert pais['es_venezuela'] is False

    repetido = api.post(PAISES, {'nombre': 'chile', 'codigo': 'CHL'}, format='json')
    assert repetido.status_code == 400
    assert 'Ya existe' in repetido.json()['message']

    editado = api.patch(
        f"{PAISES}{pais['id']}/", {'nombre': 'República de Chile'}, format='json',
    )
    assert editado.status_code == 200, editado.content
    assert data(editado)['nombre'] == 'República de Chile'

    listado = api.get(LISTA)
    assert listado.status_code == 200
    assert any(p['codigo'] == 'CL' for p in data(listado)['paises'])

    eliminado = api.delete(f"{PAISES}{pais['id']}/")
    assert eliminado.status_code == 200, eliminado.content
    assert not PaisModel.objects.filter(pk=pais['id']).exists()


def test_el_pais_por_defecto_no_se_elimina():
    venezuela = PaisModel.objects.create(
        nombre='Venezuela', codigo='VE', es_venezuela=True,
    )
    api = cliente(*PERMISOS)

    respuesta = api.delete(f'{PAISES}{venezuela.pk}/')
    assert respuesta.status_code == 400
    assert 'no puede eliminarse' in respuesta.json()['message']
    assert PaisModel.objects.filter(pk=venezuela.pk).exists()


def test_parentesco_reservado_no_se_renombra_ni_se_elimina():
    ParentescoModel.objects.create(descripcion_parentesco='HIJO (A)', aplica_familiar=True)
    api = cliente(*PERMISOS)

    reservado = next(
        p for p in data(api.get(LISTA))['parentescos'] if p['descripcion'] == 'HIJO (A)'
    )

    renombrar = api.patch(
        f"{PARENTESCOS}{reservado['id']}/", {'descripcion': 'HIJO'}, format='json',
    )
    assert renombrar.status_code == 400
    assert 'reservado' in renombrar.json()['message']

    eliminar = api.delete(f"{PARENTESCOS}{reservado['id']}/")
    assert eliminar.status_code == 400
    assert 'reservado' in eliminar.json()['message']


def test_crear_editar_y_eliminar_nomina_sin_referencias():
    api = cliente(*PERMISOS)

    creada = api.post(
        NOMINAS, {'nomina': '  CONTRATO  NUEVO ', 'es_activo': False, 'requiere_codig': True},
        format='json',
    )
    assert creada.status_code == 201, creada.content
    nomina = data(creada)
    assert nomina['nomina'] == 'CONTRATO NUEVO'
    assert nomina['es_activo'] is False
    assert nomina['requiere_codig'] is True

    repetida = api.post(NOMINAS, {'nomina': 'contrato nuevo'}, format='json')
    assert repetida.status_code == 400
    assert 'Ya existe' in repetida.json()['message']

    editada = api.patch(
        f"{NOMINAS}{nomina['id']}/", {'nomina': 'CONTRATO PLANTA'}, format='json',
    )
    assert editada.status_code == 200, editada.content
    assert data(editada)['nomina'] == 'CONTRATO PLANTA'

    eliminada = api.delete(f"{NOMINAS}{nomina['id']}/")
    assert eliminada.status_code == 200, eliminada.content
    assert not TipoNominaModel.objects.filter(pk=nomina['id']).exists()


def test_nomina_reservada_no_se_renombra_ni_se_elimina():
    TipoNominaModel.objects.create(nomina='JUBILADO', es_activo=False, requiere_codig=False)
    api = cliente(*PERMISOS)
    reservada = next(
        n for n in data(api.get(LISTA))['nominas'] if n['nomina'] == 'JUBILADO'
    )

    renombrar = api.patch(
        f"{NOMINAS}{reservada['id']}/", {'nomina': 'JUBILADO ESPECIAL'}, format='json',
    )
    assert renombrar.status_code == 400
    assert 'reservada' in renombrar.json()['message']

    eliminar = api.delete(f"{NOMINAS}{reservada['id']}/")
    assert eliminar.status_code == 400
    assert 'reservada' in eliminar.json()['message']


def test_sin_permiso_de_crear_no_puede_dar_de_alta():
    api = cliente('configuracion.ver')

    assert api.post(PARENTESCOS, {'descripcion': 'PRIMO'}, format='json').status_code == 403
    assert api.post(NOMINAS, {'nomina': 'NUEVA'}, format='json').status_code == 403


def test_tipos_de_soporte_crud_y_checklist_protegido():
    api = cliente(*PERMISOS)
    reservado = TipoSoporteDocumentoModel.objects.create(
        codigo='CEDULA', nombre='Copia de la cédula', es_reservado=True, es_protegido=True, orden=10,
    )
    ChecklistSoporteSeccionModel.objects.create(
        seccion='identidad', tipo_soporte=reservado, etiqueta='Copia de la cédula',
        permitido=True, requerido=True, orden=10,
    )

    creado = api.post(
        TIPOS_SOPORTE, {'codigo': 'certificado_medico', 'nombre': 'Certificado médico', 'orden': 70},
        format='json',
    )
    assert creado.status_code == 201, creado.content
    nuevo = data(creado)
    assert nuevo['codigo'] == 'CERTIFICADO_MEDICO'
    assert nuevo['es_reservado'] is False and nuevo['es_protegido'] is False

    repetido = api.post(TIPOS_SOPORTE, {'codigo': 'CEDULA', 'nombre': 'Otra'}, format='json')
    assert repetido.status_code == 400
    assert 'Ya existe' in repetido.json()['message']

    # El tipo exigido por la regla no puede quitarse del checklist.
    quitar = api.put(
        f'{TIPOS_SOPORTE}checklist/identidad/',
        {'tipos': [{'tipo_soporte_id': nuevo['id'], 'permitido': True, 'requerido': False}]},
        format='json',
    )
    assert quitar.status_code == 400
    assert 'exigido por una regla' in quitar.json()['message']

    # Sí puede agregarse un tipo nuevo junto al exigido.
    guardado = api.put(
        f'{TIPOS_SOPORTE}checklist/identidad/',
        {'tipos': [
            {'tipo_soporte_id': reservado.id, 'permitido': True, 'requerido': True},
            {'tipo_soporte_id': nuevo['id'], 'permitido': True, 'requerido': False},
        ]},
        format='json',
    )
    assert guardado.status_code == 200, guardado.content
    filas = {f['codigo']: f for f in data(guardado)}
    assert filas['CEDULA']['permitido'] is True and filas['CERTIFICADO_MEDICO']['permitido'] is True

    # No se puede eliminar mientras esté en el checklist.
    en_uso = api.delete(f"{TIPOS_SOPORTE}{nuevo['id']}/")
    assert en_uso.status_code == 400
    assert 'checklist' in en_uso.json()['message']

    # El reservado tampoco se elimina.
    reservado_delete = api.delete(f'{TIPOS_SOPORTE}{reservado.id}/')
    assert reservado_delete.status_code == 400
    assert 'reservado' in reservado_delete.json()['message']

    api.put(
        f'{TIPOS_SOPORTE}checklist/identidad/',
        {'tipos': [{'tipo_soporte_id': reservado.id, 'permitido': True, 'requerido': True}]},
        format='json',
    )
    eliminado = api.delete(f"{TIPOS_SOPORTE}{nuevo['id']}/")
    assert eliminado.status_code == 200, eliminado.content
    assert not TipoSoporteDocumentoModel.objects.filter(pk=nuevo['id']).exists()

    listado = data(api.get(LISTA))
    assert any(t['codigo'] == 'CEDULA' for t in listado['tipos_soporte'])
    assert any(f['seccion'] == 'identidad' for f in listado['checklist_soporte'])
    assert any(s['codigo'] == 'identidad' for s in listado['secciones_soporte'])


def test_checklist_de_seccion_inexistente_es_rechazado():
    api = cliente(*PERMISOS)
    respuesta = api.put(
        f'{TIPOS_SOPORTE}checklist/no-existe/', {'tipos': []}, format='json',
    )
    assert respuesta.status_code == 400
    assert 'no admite checklist' in respuesta.json()['message']


def test_reordenar_tipos_soporte_en_bloque_transaccional():
    api = cliente(*PERMISOS)

    t1 = TipoSoporteDocumentoModel.objects.create(codigo='DOC_UNO', nombre='Doc 1', orden=10)
    t2 = TipoSoporteDocumentoModel.objects.create(codigo='DOC_DOS', nombre='Doc 2', orden=20)
    t3 = TipoSoporteDocumentoModel.objects.create(codigo='DOC_TRES', nombre='Doc 3', orden=30)

    # Reordenar pasando lista de {id, orden}
    resp = api.put(
        f'{TIPOS_SOPORTE}reordenar/',
        {'ordenes': [
            {'id': t3.id, 'orden': 1},
            {'id': t1.id, 'orden': 2},
            {'id': t2.id, 'orden': 3},
        ]},
        format='json',
    )
    assert resp.status_code == 200, resp.content
    tipos = {item['id']: item['orden'] for item in data(resp)}
    assert tipos[t3.id] == 1
    assert tipos[t1.id] == 2
    assert tipos[t2.id] == 3

    # Reordenar pasando lista de ids (posicional)
    resp2 = api.put(
        f'{TIPOS_SOPORTE}reordenar/',
        {'ids': [t2.id, t3.id, t1.id]},
        format='json',
    )
    assert resp2.status_code == 200, resp2.content
    tipos2 = {item['id']: item['orden'] for item in data(resp2)}
    assert tipos2[t2.id] == 1
    assert tipos2[t3.id] == 2
    assert tipos2[t1.id] == 3
def test_crear_y_editar_reglas_de_parentesco():
    api = cliente(*PERMISOS)
    creado = api.post(PARENTESCOS, {
        'descripcion': 'TUTELADO',
        'es_hijo': False,
        'menor_a_cargo': True,
        'sin_cedula_hasta_edad': 9,
        'diferencia_minima': 12,
        'diferencia_tipo': 'MENOR',
        'soporte_sugerido': 'SENTENCIA DE TUTELA',
        'activo': True,
    }, format='json')
    assert creado.status_code == 201, creado.content
    parentesco = data(creado)
    assert parentesco['menor_a_cargo'] is True
    assert parentesco['sin_cedula_hasta_edad'] == 9
    assert parentesco['diferencia_tipo'] == 'MENOR'
    regla = ReglaParentescoModel.objects.get(parentesco_id=parentesco['id'])
    assert regla.menor_a_cargo is True and regla.sin_cedula_hasta_edad == 9

    editado = api.patch(
        f"{PARENTESCOS}{parentesco['id']}/",
        {'edad_minima': 18, 'sexo_permitido': 'F', 'soporte_sugerido': 'OTRO'},
        format='json',
    )
    assert editado.status_code == 200, editado.content
    assert data(editado)['edad_minima'] == 18
    assert data(editado)['sexo_permitido'] == 'F'
    assert data(editado)['menor_a_cargo'] is True
    regla.refresh_from_db()
    assert regla.edad_minima == 18 and regla.sexo_permitido == 'F'
    assert regla.menor_a_cargo is True and regla.sin_cedula_hasta_edad == 9


def test_regla_parentesco_valida_rangos_y_marcas():
    api = cliente(*PERMISOS)
    p = ParentescoModel.objects.create(descripcion_parentesco='OTRO', aplica_familiar=True)

    rango = api.patch(
        f'{PARENTESCOS}{p.pk}/', {'edad_minima': 200}, format='json',
    )
    assert rango.status_code == 400

    sin_marca = api.patch(
        f'{PARENTESCOS}{p.pk}/', {'sin_cedula_hasta_edad': 9}, format='json',
    )
    assert sin_marca.status_code == 400
    assert 'hijo o menor a cargo' in sin_marca.json()['message']


def test_hijo_reservado_permite_editar_sus_reglas_sin_renombrarlo():
    p = ParentescoModel.objects.create(descripcion_parentesco='HIJO (A)', aplica_familiar=True)
    api = cliente(*PERMISOS)

    reglas = api.patch(
        f'{PARENTESCOS}{p.pk}/',
        {'es_hijo': True, 'sin_cedula_hasta_edad': 9},
        format='json',
    )
    assert reglas.status_code == 200, reglas.content

    renombrar = api.patch(
        f'{PARENTESCOS}{p.pk}/', {'descripcion': 'HIJO'}, format='json',
    )
    assert renombrar.status_code == 400
    assert 'reservado' in renombrar.json()['message']
