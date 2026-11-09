"""
Puerto del Repositorio de Punto de Cuenta (Reglas B1, B21, D-09).
"""
from typing import Any, Protocol

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
        oficina_origen_id: int | None = None,
        oficina_destino_id: int | None = None,
        division_origen_id: int | None = None,
        division_destino_id: int | None = None,
        numero: str | None = None,
        anio: int | None = None,
        secuencia: int | None = None,
        configuracion_version: int | None = None,
        snapshot_formato: dict | None = None,
    ) -> PuntoCuenta: ...

    def adjuntar_documento(self, id: Any, clave: str) -> PuntoCuenta: ...

    def listar(self, filtros: dict | None = None) -> list[PuntoCuenta]: ...

    def obtener_por_id(self, id: Any) -> PuntoCuenta | None: ...
