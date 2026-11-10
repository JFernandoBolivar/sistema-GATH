"""
Puerto de lectura para la validación de un familiar (S5-01).

El serializer de entrada validaba contra el ORM directamente (empleado,
parentesco, regla configurada, sexo, cédulas ya usadas y heredero existente).
Esas lecturas viven ahora detrás de este puerto; el serializer se queda con
las reglas puras y con el mapeo de errores.
"""
from dataclasses import dataclass, field
from datetime import date
from typing import Protocol

from apps.familiares.domain.value_objects.regla_parentesco import (
    ReglaParentescoFamiliar,
)


@dataclass(frozen=True)
class ParentescoDeFamiliar:
    """Datos del parentesco que la validación necesita (sin el modelo ORM)."""

    id: int
    descripcion: str
    aplica_familiar: bool = True


class LectorValidacionFamiliar(Protocol):
    """Lecturas de apoyo para validar el registro de un familiar."""

    def empleado_existe(self, empleado_cedula: str) -> bool:
        ...

    def fecha_nacimiento_titular(self, empleado_cedula: str) -> date | None:
        """Fecha de nacimiento del titular (None si la cédula no existe o no la tiene)."""
        ...

    def parentesco(self, parentesco_id: int) -> ParentescoDeFamiliar | None:
        ...

    def regla_de_parentesco(self, parentesco: ParentescoDeFamiliar) -> ReglaParentescoFamiliar:
        ...

    def sexo_nombre(self, sexo_id: int) -> str | None:
        ...

    def cedulas_familiares(self, empleado_cedula: str, excluir_id: int | None) -> set[str]:
        ...

    def existe_heredero(self, empleado_cedula: str, excluir_id: int | None) -> bool:
        ...


@dataclass(frozen=True)
class ContextoValidacionFamiliar:
    """Todo lo que el serializer necesita para validar, ya leído del ORM."""

    empleado_cedula: str | None
    parentesco: ParentescoDeFamiliar | None
    regla: ReglaParentescoFamiliar
    sexo_nombre: str | None = None
    cedulas_existentes: set[str] = field(default_factory=set)
    existe_heredero: bool = False
