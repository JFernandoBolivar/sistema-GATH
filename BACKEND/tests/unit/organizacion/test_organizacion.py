"""
Tests unitarios del módulo organización (Arquitectura Onion pura sin BD).
"""
import pytest

from apps.organizacion.application.use_cases.listar_coordinaciones import listar_coordinaciones
from apps.organizacion.application.use_cases.listar_dependencias import listar_dependencias
from apps.organizacion.application.use_cases.listar_direcciones_generales import (
    listar_direcciones_generales,
)
from apps.organizacion.application.use_cases.listar_direcciones_linea import listar_direcciones_linea
from apps.organizacion.application.use_cases.listar_organismos import listar_organismos_adscritos
from apps.organizacion.domain.entities.coordinacion import Coordinacion
from apps.organizacion.domain.entities.dependencia import Dependencia
from apps.organizacion.domain.entities.direccion_general import DireccionGeneral
from apps.organizacion.domain.entities.direccion_linea import DireccionLinea
from apps.organizacion.domain.entities.organismo_adscrito import OrganismoAdscrito


class RepoOrganizacionMemoria:
    def __init__(self):
        self.dependencias = [
            Dependencia(id=1, codigo="DEP-01", nombre="Sede Principal"),
            Dependencia(id=2, codigo="DEP-02", nombre="Sede Regional"),
        ]
        self.direcciones_generales = [
            DireccionGeneral(id=10, codigo="DG-01", nombre="DG de Tecnología", dependencia_id=1),
            DireccionGeneral(id=20, codigo="DG-02", nombre="DG de Talento Humano", dependencia_id=1),
        ]
        self.direcciones_linea = [
            DireccionLinea(id=100, codigo="DL-01", nombre="Dirección de Desarrollo", direccion_general_id=10),
        ]
        self.coordinaciones = [
            Coordinacion(id=1000, codigo="COORD-01", nombre="Coordinación Backend", direccion_linea_id=100),
        ]
        self.organismos = [
            OrganismoAdscrito(id=5, nombre="CONATEL Central"),
        ]

    def listar_dependencias(self):
        return list(self.dependencias)

    def obtener_dependencia(self, dep_id):
        return next((d for d in self.dependencias if d.id == dep_id), None)

    def listar_direcciones_generales(self, dependencia_id=None):
        if dependencia_id:
            return [dg for dg in self.direcciones_generales if dg.dependencia_id == dependencia_id]
        return list(self.direcciones_generales)

    def listar_direcciones_linea(self, direccion_general_id=None):
        if direccion_general_id:
            return [dl for dl in self.direcciones_linea if dl.direccion_general_id == direccion_general_id]
        return list(self.direcciones_linea)

    def listar_coordinaciones(self, direccion_linea_id=None, direccion_general_id=None):
        if direccion_linea_id:
            return [c for c in self.coordinaciones if c.direccion_linea_id == direccion_linea_id]
        return list(self.coordinaciones)

    def listar_organismos_adscritos(self):
        return list(self.organismos)


def test_listar_dependencias():
    repo = RepoOrganizacionMemoria()
    resultado = listar_dependencias(repo)
    assert len(resultado) == 2
    assert resultado[0].codigo == "DEP-01"
    assert resultado[0].nombre == "Sede Principal"


def test_listar_direcciones_generales_filtrado():
    repo = RepoOrganizacionMemoria()
    resultado = listar_direcciones_generales(repo, dependencia_id=1)
    assert len(resultado) == 2
    assert resultado[0].codigo == "DG-01"


def test_listar_direcciones_linea():
    repo = RepoOrganizacionMemoria()
    resultado = listar_direcciones_linea(repo, direccion_general_id=10)
    assert len(resultado) == 1
    assert resultado[0].codigo == "DL-01"


def test_listar_coordinaciones():
    repo = RepoOrganizacionMemoria()
    resultado = listar_coordinaciones(repo, direccion_linea_id=100)
    assert len(resultado) == 1
    assert resultado[0].nombre == "Coordinación Backend"


def test_listar_organismos():
    repo = RepoOrganizacionMemoria()
    resultado = listar_organismos_adscritos(repo)
    assert len(resultado) == 1
    assert resultado[0].nombre == "CONATEL Central"
