"""
Tests unitarios del módulo catálogos (Arquitectura Onion pura sin BD).
"""
import pytest

from apps.catalogos.application.use_cases.listar_geografia import (
    listar_estados,
    listar_municipios,
    listar_parroquias,
    listar_regiones,
)
from apps.catalogos.application.use_cases.listar_tablas_maestras import (
    listar_categorias_movimiento,
    listar_estatus,
    listar_parentescos,
    listar_sexos,
    listar_tipos_movimiento,
    listar_tipos_nomina,
    listar_tipos_personal,
)
from apps.catalogos.domain.entities.catalogo_item import CatalogoItem
from apps.catalogos.domain.entities.geografia import Estado, Municipio, Parroquia, Region


class RepoCatalogosMemoria:
    def __init__(self):
        self.regiones = [Region(id=1, nombre="Capital")]
        self.estados = [Estado(id=10, nombre="Distrito Capital", region_id=1)]
        self.municipios = [Municipio(id=100, nombre="Libertador", estado_id=10)]
        self.parroquias = [Parroquia(id=1000, nombre="Altagracia", municipio_id=100)]
        self.sexos = [CatalogoItem(id=1, nombre="MASCULINO"), CatalogoItem(id=2, nombre="FEMENINO")]
        self.estatus = [CatalogoItem(id=1, nombre="ACTIVO"), CatalogoItem(id=2, nombre="EGRESADO")]
        self.tipos_personal = [CatalogoItem(id=1, nombre="EMPLEADO FIJO")]
        self.tipos_nomina = [
            CatalogoItem(id=1, nombre="EMPLEADOS ADM"),
            CatalogoItem(id=15, nombre="JUBILADO", extra={'es_activo': False}),
            CatalogoItem(id=10, nombre="PENSIONADO", extra={'es_activo': False}),
        ]
        self.parentescos = [CatalogoItem(id=1, nombre="HIJO(A)"), CatalogoItem(id=2, nombre="CONYUGE")]
        self.categorias_movimiento = [CatalogoItem(id=1, nombre="TRASLADO"), CatalogoItem(id=2, nombre="ENCARGADURIA")]
        self.tipos_movimiento = [
            CatalogoItem(id=1, nombre="TRASLADO POR NECESIDAD DEL SERVICIO", extra={'categoria': 'TRASLADO'}),
            CatalogoItem(id=2, nombre="ENCARGADURIA POR VACANTE", extra={'categoria': 'ENCARGADURIA'}),
        ]

    def listar_regiones(self):
        return list(self.regiones)

    def listar_estados(self, region_id=None):
        if region_id:
            return [e for e in self.estados if e.region_id == region_id]
        return list(self.estados)

    def listar_municipios(self, estado_id=None):
        if estado_id:
            return [m for m in self.municipios if m.estado_id == estado_id]
        return list(self.municipios)

    def listar_parroquias(self, municipio_id=None):
        if municipio_id:
            return [p for p in self.parroquias if p.municipio_id == municipio_id]
        return list(self.parroquias)

    def listar_sexos(self):
        return list(self.sexos)

    def listar_estatus(self):
        return list(self.estatus)

    def listar_tipos_personal(self):
        return list(self.tipos_personal)

    def listar_tipos_nomina(self, solo_especiales=False, solo_pasivos=False):
        if solo_pasivos:
            return [tn for tn in self.tipos_nomina if tn.extra.get('es_activo') is False]
        return list(self.tipos_nomina)

    def listar_parentescos(self):
        return list(self.parentescos)

    def listar_tipos_procedencia(self):
        return []

    def listar_grados(self):
        return []

    def listar_categorias_movimiento(self):
        return list(self.categorias_movimiento)

    def listar_tipos_movimiento(self, categoria=None):
        if categoria is not None:
            return [t for t in self.tipos_movimiento if t.extra.get('categoria') == categoria]
        return list(self.tipos_movimiento)


def test_listar_geografia():
    repo = RepoCatalogosMemoria()
    estados = listar_estados(repo, region_id=1)
    assert len(estados) == 1
    assert estados[0].nombre == "Distrito Capital"

    municipios = listar_municipios(repo, estado_id=10)
    assert len(municipios) == 1
    assert municipios[0].nombre == "Libertador"

    parroquias = listar_parroquias(repo, municipio_id=100)
    assert len(parroquias) == 1
    assert parroquias[0].nombre == "Altagracia"


def test_listar_tablas_maestras():
    repo = RepoCatalogosMemoria()
    sexos = listar_sexos(repo)
    assert len(sexos) == 2
    assert sexos[0].nombre == "MASCULINO"

    parentescos = listar_parentescos(repo)
    assert len(parentescos) == 2
    assert parentescos[0].nombre == "HIJO(A)"


def test_listar_categorias_y_tipos_movimiento():
    repo = RepoCatalogosMemoria()
    categorias = listar_categorias_movimiento(repo)
    assert len(categorias) == 2

    todos = listar_tipos_movimiento(repo)
    assert len(todos) == 2

    filtrados = listar_tipos_movimiento(repo, categoria='TRASLADO')
    assert len(filtrados) == 1
    assert filtrados[0].nombre == "TRASLADO POR NECESIDAD DEL SERVICIO"


def test_listar_tipos_nomina_solo_pasivos():
    repo = RepoCatalogosMemoria()
    todos = listar_tipos_nomina(repo)
    assert len(todos) == 3

    pasivos = listar_tipos_nomina(repo, solo_pasivos=True)
    assert len(pasivos) == 2
    nombres = [p.nombre for p in pasivos]
    assert "JUBILADO" in nombres
    assert "PENSIONADO" in nombres
