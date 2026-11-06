"""DTOs de Punto de Cuenta (Regla B2)."""
from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class PuntoCuentaDTO:
    id: Any
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
    oficina_origen_id: int | None = None
    oficina_origen: str | None = None
    oficina_destino_id: int | None = None
    oficina_destino: str | None = None
    division_origen_id: int | None = None
    division_origen: str | None = None
    division_destino_id: int | None = None
    division_destino: str | None = None
    numero: str | None = None
    anio: int | None = None
    secuencia: int | None = None
    cargo_codigo: str | None = None
    cargo_nombre: str | None = None
    cargo_destino: str | None = None
    nivel: str | None = None
    tipo_personal: str | None = None
    fecha_efectiva: str | None = None
    fecha_ingreso: str | None = None
    anios_servicio: str | int | None = None
    presentado_a: str | None = None
    cargo_presentado_a: str | None = None
    presentado_por: str | None = None
    cargo_presentado_por: str | None = None
    unidad: str | None = None
    configuracion_version: int | None = None
    snapshot_formato: dict | None = None
