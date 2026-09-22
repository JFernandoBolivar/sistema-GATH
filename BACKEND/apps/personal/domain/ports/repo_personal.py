"""
Puerto del Repositorio de Personal (Reglas B1, B21).
"""
from typing import Protocol

from apps.personal.domain.entities.empleado import Empleado


class RepoPersonal(Protocol):
    def listar_empleados(
        self,
        busqueda: str | None = None,
        codigo: str | None = None,
        tipo_nomina: str | int | None = None,
    ) -> list[Empleado]:
        ...

    def obtener_por_cedula(self, cedula: str) -> Empleado | None:
        ...

    def crear_empleado(self, datos: dict) -> Empleado:
        ...

    def actualizar_empleado(self, cedula: str, datos: dict) -> Empleado:
        ...

    def guardar_foto(self, cedula: str, clave: str) -> None:
        ...
