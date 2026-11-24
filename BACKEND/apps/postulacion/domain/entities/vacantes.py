"""Puesto de trabajo visto desde Presupuesto (lectura del módulo cargos por un puerto). Sin Django."""
from dataclasses import dataclass


@dataclass(frozen=True)
class FiltroVacantes:
    """Criterios de la consulta de vacantes; `None` = sin filtrar por ese criterio."""

    cargo_id: int | None = None
    dependencia_id: int | None = None
    direccion_general_id: int | None = None
    direccion_linea_id: int | None = None
    coordinacion_id: int | None = None
    texto: str = ''
    expediente_propio_id: str = ''   # quien consulta: su propia reserva NO se excluye (las de otros sí)


@dataclass(frozen=True)
class PuestoVacante:
    id: int
    codigo: str
    cargo_id: int
    cargo_nombre: str
    cargo_especifico_id: int | None = None
    cargo_especifico_nombre: str = ''
    tipo_nomina_id: int | None = None
    tipo_nomina_nombre: str = ''
    dependencia_id: int | None = None
    dependencia_nombre: str = ''
    direccion_general_id: int | None = None
    direccion_general_nombre: str = ''
    direccion_linea_id: int | None = None
    direccion_linea_nombre: str = ''
    coordinacion_id: int | None = None
    coordinacion_nombre: str = ''
    vacante: bool = True
