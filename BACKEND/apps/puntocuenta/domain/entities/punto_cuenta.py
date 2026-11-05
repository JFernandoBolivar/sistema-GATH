"""
Entidad de Dominio `PuntoCuenta` (Punto de Cuenta automático).

Registro contable/administrativo generado automáticamente (RN-006-01)
cuando una operación habilitada en la configuración ocurre. Append-only:
no se edita ni se elimina, es un registro histórico.

Los campos `*_nombre` se resuelven en el repositorio (join de lectura, no
se persisten) para no duplicar información ya dueña de otros módulos.
"""
from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class PuntoCuenta:
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
    oficina_origen_id: int | None = None
    oficina_origen_nombre: str | None = None
    oficina_destino_id: int | None = None
    oficina_destino_nombre: str | None = None
    division_origen_id: int | None = None
    division_origen_nombre: str | None = None
    division_destino_id: int | None = None
    division_destino_nombre: str | None = None
    numero: str | None = None
    anio: int | None = None
    secuencia: int | None = None
    cargo_codigo: str | None = None
    cargo_nombre: str | None = None
    configuracion_version: int | None = None
    snapshot_formato: dict | None = None
