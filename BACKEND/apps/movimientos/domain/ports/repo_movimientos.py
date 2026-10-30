"""
Puerto del Repositorio de Movimientos (Reglas B1, B21).
"""
from typing import Protocol

from apps.movimientos.domain.entities.movimiento import MovimientoCargo
from apps.movimientos.domain.value_objects.filtros_historial import FiltrosHistorial


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

    def listar_historial(
        self, filtros: FiltrosHistorial, limite: int, offset: int = 0
    ) -> tuple[list[MovimientoCargo], int]:
        """Página del historial y total de coincidencias (para paginar y avisar del tope)."""
        ...

    def listar_tipos_movimiento_disponibles(self) -> dict:
        ...
