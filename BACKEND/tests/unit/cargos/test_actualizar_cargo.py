"""
Tests unitarios de actualizar cargo (paridad con legado update_position).
Puros, sin BD: repositorio en memoria implementando el puerto `RepoCargos`.
"""
import pytest

from apps.cargos.application.use_cases.actualizar_cargo import actualizar_cargo
from apps.cargos.domain.entities.cargo_asignacion import CargoAsignacion
from core.domain.exceptions import NotFoundError


class RepoCargosMemoria:
    def __init__(self, cargos=()):
        self.cargos = {c.id: c for c in cargos}

    def actualizar_cargo(self, cargo_id, datos, usuario_id=None):
        cargo = self.cargos.get(cargo_id)
        if not cargo:
            raise NotFoundError(f"Cargo {cargo_id} no encontrado")
        actualizado = CargoAsignacion(
            id=cargo.id,
            codigo=cargo.codigo,
            empleado_cedula=cargo.empleado_cedula,
            denominacion_id=datos.get('denominacioncargoid', cargo.denominacion_id),
            denominacion_nombre='NUEVA DENOMINACION',
            especifica_id=datos.get('denominacioncargoespecificoid', cargo.especifica_id),
            especifica_nombre='NUEVA ESPECIFICA',
            tipo_nomina_id=datos.get('tiponominaid', cargo.tipo_nomina_id),
            tipo_nomina_nombre=cargo.tipo_nomina_nombre,
            estatus_id=cargo.estatus_id,
            estatus_nombre=cargo.estatus_nombre,
            dependencia_id=datos.get('Dependencia', cargo.dependencia_id),
            dependencia_nombre=cargo.dependencia_nombre,
            direccion_general_id=datos.get('DireccionGeneral', cargo.direccion_general_id),
            direccion_general_nombre=cargo.direccion_general_nombre,
            direccion_linea_id=datos.get('DireccionLinea', cargo.direccion_linea_id),
            direccion_linea_nombre=cargo.direccion_linea_nombre,
            coordinacion_id=datos.get('Coordinacion', cargo.coordinacion_id),
            coordinacion_nombre=cargo.coordinacion_nombre,
            organismo_id=datos.get('OrganismoAdscritoid', cargo.organismo_id),
            organismo_nombre=cargo.organismo_nombre,
            grado_id=datos.get('gradoid', cargo.grado_id),
            grado_nombre=cargo.grado_nombre,
            observaciones=cargo.observaciones,
            fecha_actualizacion="2026-09-24T20:00:00Z",
        )
        self.cargos[cargo_id] = actualizado
        return actualizado


def test_actualizar_cargo_exitoso():
    cargo_inicial = CargoAsignacion(
        id=10,
        codigo='ADM-001',
        empleado_cedula='12345678',
        denominacion_id=1,
        denominacion_nombre='ANALISTA',
        especifica_id=1,
        especifica_nombre='ANALISTA I',
        tipo_nomina_id=2,
        tipo_nomina_nombre='CONTRATADO',
        estatus_id=1,
        estatus_nombre='ACTIVO',
    )
    repo = RepoCargosMemoria([cargo_inicial])
    datos = {
        'denominacioncargoid': 5,
        'denominacioncargoespecificoid': 6,
        'tiponominaid': 2,
        'Dependencia': 3,
        'DireccionGeneral': 4,
    }
    resultado = actualizar_cargo(repo, cargo_id=10, datos=datos, usuario_id=1)
    assert resultado.id == 10
    assert resultado.denominacion_id == 5
    assert resultado.especifica_id == 6
    assert resultado.dependencia_id == 3
    assert resultado.direccion_general_id == 4


def test_actualizar_cargo_inexistente_lanza_not_found():
    repo = RepoCargosMemoria([])
    with pytest.raises(NotFoundError):
        actualizar_cargo(repo, cargo_id=999, datos={'denominacioncargoid': 1}, usuario_id=1)
