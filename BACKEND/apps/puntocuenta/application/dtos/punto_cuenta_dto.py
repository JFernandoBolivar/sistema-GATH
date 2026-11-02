"""DTOs de Punto de Cuenta (Regla B2)."""
from dataclasses import dataclass


@dataclass(frozen=True)
class PuntoCuentaDTO:
    id: int
    cargo_id: int
    empleado_cedula: str
    empleado_nombre: str | None
    dependencia_origen_id: int | None
    dependencia_origen_nombre: str | None
    dependencia_destino_id: int | None
    dependencia_destino_nombre: str | None
    motivo_id: int | None
    motivo_nombre: str | None
    usuario_id: int | None
    fecha: str
    documento_pdf_clave: str | None
    documento_generado: bool
