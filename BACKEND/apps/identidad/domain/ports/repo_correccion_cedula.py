"""Puerto de la corrección de la cédula de un trabajador (lectura y reescritura de referencias)."""
from typing import Protocol, Sequence


class RepoCorreccionCedula(Protocol):
    def obtener_nombre(self, cedula: str) -> str | None:
        """Nombre completo («APELLIDOS NOMBRES») del trabajador; None si no existe."""
        ...

    def contar_afectados(self, cedula: str) -> Sequence[tuple[str, int]]:
        """(tabla legible, registros) que guardan esa cédula; solo las de 1 o más."""
        ...

    def existe_cedula(self, cedula: str) -> bool:
        """True si la cédula ya está en `Employee`, `USER_cuenta` o una tabla con `unique`."""
        ...

    def aplicar(self, cedula_vieja: str, cedula_nueva: str) -> Sequence[tuple[str, int]]:
        """Bloquea la ficha y reescribe la cédula en todas las tablas. Exige transacción abierta."""
        ...
