"""
Tests unitarios de creación de código de posición vacante (réplica de
"Crear Nuevo Código" del legado). Puros, sin BD.
"""
from apps.cargos.application.dtos.cargos_dtos import CrearCargoDTO
from apps.cargos.application.use_cases.crear_cargo import crear_cargo
import pytest

from core.domain.exceptions import ValidationError
from apps.cargos.domain.entities.cargo_asignacion import CargoAsignacion


class RepoCargosMemoria:
    def __init__(self):
        self.siguiente_id = 1

    def crear_cargo(self, datos):
        nuevo = CargoAsignacion(
            id=self.siguiente_id,
            codigo="01000104",
            empleado_cedula=None,
            denominacion_id=datos["denominacion_id"],
            denominacion_nombre="ANALISTA",
            especifica_id=datos["especifica_id"],
            especifica_nombre="ANALISTA I",
            tipo_nomina_id=datos["tipo_nomina_id"],
            tipo_nomina_nombre="FIJO",
            estatus_id=2,
            estatus_nombre="VACANTE",
            dependencia_id=datos.get("dependencia_id"),
            observaciones=datos.get("observaciones"),
        )
        self.siguiente_id += 1
        return nuevo


def test_crear_cargo_genera_codigo_vacante():
    repo = RepoCargosMemoria()
    dto = CrearCargoDTO(denominacion_id=1, especifica_id=1, tipo_nomina_id=1, dependencia_id=1, direccion_general_id=2)

    resultado = crear_cargo(repo, dto)

    assert resultado.empleado_cedula is None
    assert resultado.estatus_nombre == "VACANTE"
    assert resultado.codigo == "01000104"


def test_crear_cargo_pasa_observaciones_y_ubicacion():
    repo = RepoCargosMemoria()
    dto = CrearCargoDTO(
        denominacion_id=2, especifica_id=3, tipo_nomina_id=1,
        dependencia_id=5, direccion_general_id=7, observaciones="Puesto nuevo del área X",
    )

    resultado = crear_cargo(repo, dto)

    assert resultado.dependencia_id == 5
    assert resultado.observaciones == "Puesto nuevo del área X"


def test_crear_cargo_solo_con_nivel_exige_direccion_general():
    dto = CrearCargoDTO(denominacion_id=1, especifica_id=1, tipo_nomina_id=1, dependencia_id=1)
    with pytest.raises(ValidationError) as exc:
        crear_cargo(RepoCargosMemoria(), dto)
    assert exc.value.campo == 'direccion_general_id'


def test_crear_cargo_sin_nivel_exige_dependencia():
    dto = CrearCargoDTO(denominacion_id=1, especifica_id=1, tipo_nomina_id=1, direccion_general_id=3)
    with pytest.raises(ValidationError) as exc:
        crear_cargo(RepoCargosMemoria(), dto)
    assert exc.value.campo == 'dependencia_id'
