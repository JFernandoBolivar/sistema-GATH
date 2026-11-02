"""
Puerto del Repositorio de Punto de Cuenta (Reglas B1, B21, D-09).
"""
from typing import Protocol

from apps.puntocuenta.domain.entities.punto_cuenta import PuntoCuenta


class RepoPuntoCuenta(Protocol):
    def crear(
        self,
        *,
        cargo_id: int,
        cedula: str,
        dependencia_origen_id: int | None,
        dependencia_destino_id: int | None,
        motivo_id: int | None,
        usuario_id: int | None,
    ) -> PuntoCuenta: ...

    def adjuntar_documento(self, id: int, clave: str) -> PuntoCuenta: ...

    def listar(self) -> list[PuntoCuenta]: ...

    def obtener_por_id(self, id: int) -> PuntoCuenta | None: ...
