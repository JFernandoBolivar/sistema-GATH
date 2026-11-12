"""Listado de puestos y vacantes paginado en el servidor (repositorio y vistas)."""
import pytest
from rest_framework.test import APIClient

from apps.cargos.domain.value_objects.paginacion import Paginacion
from apps.cargos.infrastructure.models.cargo_models import (
    AsigTrabajoModel,
    DenominacionCargoEspecificoModel,
    DenominacionCargoModel,
)
from apps.cargos.infrastructure.repositories.repo_cargos_orm import RepoCargosORM
from apps.catalogos.infrastructure.models.catalogo_models import (
    EstatusModel,
    TipoNominaModel,
    TipoPersonalModel,
)

pytestmark = pytest.mark.django_db

TOTAL = 12  # 12 puestos de personal activo (4 "VAC" + 8 "OCU"; ninguno tiene empleado, todos son vacantes)


class Usuario:
    is_authenticated = True
    is_active = True

    def __init__(self, permisos):
        self.pk, self.id, self.cedula_id, self.rol_id, self.rol = 1, None, '30799436', 1, None
        self._permisos = set(permisos)

    def tiene_permiso(self, codigo):
        return codigo in self._permisos


def _cliente(permisos=('cargos.ver',)):
    c = APIClient()
    c.force_authenticate(user=Usuario(permisos))
    return c


@pytest.fixture
def puestos(db):
    estatus = EstatusModel.objects.create(estatus='VACANTE')
    activo = TipoPersonalModel.objects.create(tipo_personal='ACTIVO')
    pasivo = TipoPersonalModel.objects.create(tipo_personal='PASIVO')
    nomina = TipoNominaModel.objects.create(nomina='EMPLEADO')
    dc = DenominacionCargoModel.objects.create(cargo='ANALISTA')
    dce = DenominacionCargoEspecificoModel.objects.create(cargo='ANALISTA I')
    comun = dict(denominacioncargoid=dc, denominacioncargoespecificoid=dce, tiponominaid=nomina, estatusid=estatus)
    for i in range(4):
        AsigTrabajoModel.objects.create(codigo=f'VAC-{i:02d}', Tipo_personal=activo, **comun)
    for i in range(8):
        AsigTrabajoModel.objects.create(codigo=f'OCU-{i:02d}', Tipo_personal=activo, **comun)
    AsigTrabajoModel.objects.create(codigo='P_0001', Tipo_personal=pasivo, **comun)


# --- Paginacion (dominio) -------------------------------------------------

def test_paginacion_valores_por_defecto_y_tope():
    assert Paginacion.desde_parametros({}) == Paginacion(pagina=1, tamano=10)
    assert Paginacion.desde_parametros({'pagina': '3', 'page_size': '500'}) == Paginacion(pagina=3, tamano=50)


def test_paginacion_solicitada_solo_con_parametros():
    assert not Paginacion.solicitada({})
    assert Paginacion.solicitada({'pagina': '1'})
    assert Paginacion.solicitada({'page_size': '20'})


# --- Repositorio ----------------------------------------------------------

def test_repo_pagina_1_y_2_no_se_solapan(puestos):
    repo = RepoCargosORM()
    p1, total = repo.listar_cargos_paginado(Paginacion(pagina=1, tamano=5))
    p2, total2 = repo.listar_cargos_paginado(Paginacion(pagina=2, tamano=5))
    p3, _ = repo.listar_cargos_paginado(Paginacion(pagina=3, tamano=5))
    assert total == total2 == TOTAL  # el puesto de pasivo no cuenta
    assert [len(p1), len(p2), len(p3)] == [5, 5, 2]
    ids = [c.id for c in p1 + p2 + p3]
    assert len(set(ids)) == TOTAL


def test_repo_filtros_se_aplican_antes_del_corte(puestos):
    repo = RepoCargosORM()
    pagina, total = repo.listar_cargos_paginado(Paginacion(pagina=1, tamano=3), solo_vacantes=True, codigo='VAC')
    assert total == 4
    assert len(pagina) == 3
    pagina, total = repo.listar_cargos_paginado(Paginacion(pagina=1, tamano=10), codigo='OCU-0')
    assert total == 8
    assert all(c.codigo.startswith('OCU-0') for c in pagina)


def test_repo_pagina_fuera_de_rango_devuelve_vacia_con_total(puestos):
    pagina, total = RepoCargosORM().listar_cargos_paginado(Paginacion(pagina=9, tamano=10))
    assert pagina == []
    assert total == TOTAL


def test_repo_pagina_sin_n_mas_1(puestos, django_assert_max_num_queries):
    with django_assert_max_num_queries(3):  # count + pagina (+ margen)
        RepoCargosORM().listar_cargos_paginado(Paginacion(pagina=1, tamano=10))


# --- Vistas ---------------------------------------------------------------

def test_vista_cargos_pagina_1(puestos):
    r = _cliente().get('/api/v1/cargos/', {'pagina': 1, 'page_size': 5})
    assert r.status_code == 200
    datos = r.json()['data']
    assert datos['total'] == TOTAL
    assert datos['pagina'] == 1
    assert datos['tamano'] == 5
    assert datos['total_paginas'] == 3
    assert len(datos['resultados']) == 5


def test_vista_cargos_pagina_2_y_defecto_10(puestos):
    datos = _cliente().get('/api/v1/cargos/', {'pagina': 2}).json()['data']
    assert datos['tamano'] == 10
    assert datos['pagina'] == 2
    assert len(datos['resultados']) == 2


def test_vista_cargos_tope_50(puestos):
    datos = _cliente().get('/api/v1/cargos/', {'pagina': 1, 'page_size': 999}).json()['data']
    assert datos['tamano'] == 50


def test_vista_cargos_filtros(puestos):
    datos = _cliente().get('/api/v1/cargos/', {'pagina': 1, 'codigo': 'VAC', 'solo_vacantes': 'true'}).json()['data']
    assert datos['total'] == 4
    assert all(c['codigo'].startswith('VAC') for c in datos['resultados'])


def test_vista_cargos_sin_pagina_devuelve_lista_completa(puestos):
    datos = _cliente().get('/api/v1/cargos/').json()['data']
    assert isinstance(datos, list)
    assert len(datos) == TOTAL


def test_vista_cargos_parametro_invalido_400(puestos):
    assert _cliente().get('/api/v1/cargos/', {'pagina': 'abc'}).status_code == 400
    assert _cliente().get('/api/v1/cargos/', {'pagina': 0}).status_code == 400


def test_vista_vacantes_paginada_y_completa(puestos):
    paginada = _cliente().get('/api/v1/cargos/vacantes/', {'pagina': 1, 'page_size': 3}).json()['data']
    assert paginada['total'] == TOTAL  # todas las vacantes: sin empleado asignado
    assert len(paginada['resultados']) == 3
    completa = _cliente().get('/api/v1/cargos/vacantes/').json()['data']
    assert isinstance(completa, list)
    assert len(completa) == TOTAL


def test_vista_requiere_permiso(puestos):
    assert _cliente(permisos=()).get('/api/v1/cargos/', {'pagina': 1}).status_code == 403


# --- Busqueda de texto libre ----------------------------------------------

@pytest.fixture
def puestos_busqueda(db):
    from apps.catalogos.infrastructure.models.catalogo_models import NacionalidadModel, SexoModel
    from apps.personal.infrastructure.models.personal_models import EmployeeModel

    # Employee exige nacionalidad (FK con default 1): la base de pruebas parte vacía.
    NacionalidadModel.objects.get_or_create(id=1, defaults={'codigo': 'V', 'nombre': 'VENEZOLANO'})
    estatus = EstatusModel.objects.create(estatus='ACTIVO')
    activo = TipoPersonalModel.objects.create(tipo_personal='ACTIVO')
    nomina = TipoNominaModel.objects.create(nomina='EMPLEADO')
    dc = DenominacionCargoModel.objects.create(cargo='ANALISTA')
    dc2 = DenominacionCargoModel.objects.create(cargo='COORDINADOR')
    dce = DenominacionCargoEspecificoModel.objects.create(cargo='GESTIÓN DE PERSONAL')
    base = dict(denominacioncargoespecificoid=dce, tiponominaid=nomina, estatusid=estatus, Tipo_personal=activo)
    AsigTrabajoModel.objects.create(codigo='ZZ-001', denominacioncargoid=dc, **base)
    AsigTrabajoModel.objects.create(codigo='ZZ-002', denominacioncargoid=dc2, **base)
    ocupante = EmployeeModel.objects.create(cedulaidentidad='12345678', nombres='José Ángel', apellidos='Pérez Núñez',
        sexoid=SexoModel.objects.create(sexo='M'),
    )
    AsigTrabajoModel.objects.create(codigo='ZZ-003', denominacioncargoid=dc, employee=ocupante, **base)


def _buscar(texto, **extra):
    r = _cliente().get('/api/v1/cargos/', {'pagina': 1, 'busqueda': texto, **extra})
    assert r.status_code == 200
    return r.json()['data']


def test_busqueda_por_codigo_sin_mayusculas(puestos_busqueda):
    datos = _buscar('zz-00')
    assert datos['total'] == 3
    assert [c['codigo'] for c in _buscar('zz-002')['resultados']] == ['ZZ-002']


def test_busqueda_por_denominacion_y_especifica_sin_acentos(puestos_busqueda):
    assert _buscar('coordinador')['total'] == 1
    assert _buscar('gestion de personal')['total'] == 3  # la especifica lleva tilde
    assert _buscar('GESTIÓN')['total'] == 3


def test_busqueda_por_ocupante_nombre_y_cedula(puestos_busqueda):
    assert [c['codigo'] for c in _buscar('jose angel')['resultados']] == ['ZZ-003']
    assert _buscar('nunez')['total'] == 1
    assert _buscar('123456')['total'] == 1


def test_busqueda_sin_resultados_y_vacia(puestos_busqueda):
    assert _buscar('inexistente')['total'] == 0
    assert _buscar('   ')['total'] == 3  # sin texto no filtra


def test_busqueda_se_combina_con_filtros_y_paginacion(puestos_busqueda):
    datos = _buscar('analista', solo_vacantes='true', page_size=1)
    assert datos['total'] == 1
    assert datos['resultados'][0]['codigo'] == 'ZZ-001'
    assert _buscar('.*')['total'] == 0  # el texto se escapa: no es una expresion regular
