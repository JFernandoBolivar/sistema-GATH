"""
Tests unitarios del módulo cargos (Arquitectura Onion pura sin BD).
"""
import pytest

from apps.cargos.application.use_cases.asignar_cargo import asignar_cargo, desasignar_cargo
from apps.cargos.application.use_cases.listar_cargos import listar_cargos
from apps.cargos.application.use_cases.listar_denominaciones import (
    listar_denominaciones,
    listar_denominaciones_especificas,
)
from apps.cargos.domain.entities.cargo_asignacion import CargoAsignacion
from apps.cargos.domain.entities.denominacion_cargo import DenominacionCargo
from apps.cargos.domain.entities.denominacion_especifica import DenominacionEspecifica


class RepoCargosMemoria:
    def __init__(self):
        self.denominaciones = [
            DenominacionCargo(id=1, nombre="DIRECTOR GENERAL", orden=10),
            DenominacionCargo(id=2, nombre="ANALISTA", orden=20),
        ]
        self.especificas = [
            DenominacionEspecifica(id=10, nombre="ANALISTA DE SISTEMAS", orden=20),
        ]
        self.cargos = [
            CargoAsignacion(
                id=100,
                codigo="CARGO-001",
                empleado_cedula=None,
                denominacion_id=2,
                denominacion_nombre="ANALISTA",
                especifica_id=10,
                especifica_nombre="ANALISTA DE SISTEMAS",
                tipo_nomina_id=1,
                tipo_nomina_nombre="EMPLEADOS",
                estatus_id=1,
                estatus_nombre="ACTIVO",
                dependencia_id=1,
            ),
            CargoAsignacion(
                id=101,
                codigo="CARGO-002",
                empleado_cedula="12345678",
                denominacion_id=1,
                denominacion_nombre="DIRECTOR GENERAL",
                especifica_id=10,
                especifica_nombre="ANALISTA DE SISTEMAS",
                tipo_nomina_id=1,
                tipo_nomina_nombre="EMPLEADOS",
                estatus_id=1,
                estatus_nombre="ACTIVO",
                dependencia_id=1,
            ),
        ]

    def listar_denominaciones(self):
        return list(self.denominaciones)

    def listar_denominaciones_especificas(self):
        return list(self.especificas)

    def listar_cargos(self, tipo_nomina_id=None, dependencia_id=None, solo_vacantes=False):
        resultado = list(self.cargos)
        if solo_vacantes:
            resultado = [c for c in resultado if c.esta_vacante]
        return resultado

    def obtener_cargo(self, cargo_id):
        return next((c for c in self.cargos if c.id == cargo_id), None)

    def asignar_cargo_a_empleado(self, cargo_id, cedula, motivo_id=None, usuario_id=None):
        c = self.obtener_cargo(cargo_id)
        idx = self.cargos.index(c)
        nuevo = CargoAsignacion(
            id=c.id,
            codigo=c.codigo,
            empleado_cedula=cedula,
            denominacion_id=c.denominacion_id,
            denominacion_nombre=c.denominacion_nombre,
            especifica_id=c.especifica_id,
            especifica_nombre=c.especifica_nombre,
            tipo_nomina_id=c.tipo_nomina_id,
            tipo_nomina_nombre=c.tipo_nomina_nombre,
            estatus_id=c.estatus_id,
            estatus_nombre=c.estatus_nombre,
            dependencia_id=c.dependencia_id,
        )
        self.cargos[idx] = nuevo
        return nuevo

    def desasignar_cargo(self, cargo_id, motivo_id=None, usuario_id=None):
        c = self.obtener_cargo(cargo_id)
        idx = self.cargos.index(c)
        nuevo = CargoAsignacion(
            id=c.id,
            codigo=c.codigo,
            empleado_cedula=None,
            denominacion_id=c.denominacion_id,
            denominacion_nombre=c.denominacion_nombre,
            especifica_id=c.especifica_id,
            especifica_nombre=c.especifica_nombre,
            tipo_nomina_id=c.tipo_nomina_id,
            tipo_nomina_nombre=c.tipo_nomina_nombre,
            estatus_id=c.estatus_id,
            estatus_nombre=c.estatus_nombre,
            dependencia_id=c.dependencia_id,
        )
        self.cargos[idx] = nuevo
        return nuevo


def test_listar_denominaciones():
    repo = RepoCargosMemoria()
    resultado = listar_denominaciones(repo)
    assert len(resultado) == 2
    assert resultado[0].nombre == "DIRECTOR GENERAL"


def test_listar_cargos_vacantes():
    repo = RepoCargosMemoria()
    vacantes = listar_cargos(repo, solo_vacantes=True)
    assert len(vacantes) == 1
    assert vacantes[0].codigo == "CARGO-001"
    assert vacantes[0].esta_vacante is True


def test_asignar_y_desasignar_cargo():
    repo = RepoCargosMemoria()
    asignado = asignar_cargo(repo, cargo_id=100, cedula="99887766")
    assert asignado.empleado_cedula == "99887766"
    assert asignado.esta_vacante is False

    liberado = desasignar_cargo(repo, cargo_id=100)
    assert liberado.empleado_cedula is None
    assert liberado.esta_vacante is True
