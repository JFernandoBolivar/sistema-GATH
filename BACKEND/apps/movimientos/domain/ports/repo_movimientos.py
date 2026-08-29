"""
Puerto del Repositorio de Movimientos (Reglas B1, B21).
"""
from typing import Protocol

from apps.movimientos.domain.entities.movimiento import MovimientoCargo


class RepoMovimientos(Protocol):
    def registrar_movimiento(
        self,
        cargo_id: int,
        cedula: str,
        tipo_movimiento: str,
        motivo_id: int | None,
        usuario_id: int,
    ) -> MovimientoCargo:
        ...

    def listar_historial_por_empleado(self, cedula: str) -> list[MovimientoCargo]:
        ...

    def listar_historial_por_cargo(self, codigo_puesto: str) -> list[MovimientoCargo]:
        ...
