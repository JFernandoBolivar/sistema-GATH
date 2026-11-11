"""Entidades de la corrección de la cédula de un trabajador. Sin Django."""
from dataclasses import dataclass

Afectados = tuple[tuple[str, int], ...]


@dataclass(frozen=True)
class TrabajadorCorreccion:
    cedula_actual: str
    nombre: str
    condicion: str


@dataclass(frozen=True)
class CuentaCorreccion:
    existe: bool
    correo: str | None = None
    clave_inicial_pendiente: bool = False


@dataclass(frozen=True)
class VistaPreviaCorreccion:
    trabajador: TrabajadorCorreccion
    cedula_nueva: str
    cuenta: CuentaCorreccion
    afectados: Afectados

    @property
    def total_registros(self) -> int:
        return sum(n for _, n in self.afectados)


@dataclass(frozen=True)
class ResultadoCorreccion:
    cedula_anterior: str
    cedula_nueva: str
    afectados: Afectados
    clave_inicial_actualizada: bool

    @property
    def total_registros(self) -> int:
        return sum(n for _, n in self.afectados)
