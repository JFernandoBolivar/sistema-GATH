"""
Entidad de Dominio `PuntoCuenta` (Punto de Cuenta automático).

Registro contable/administrativo generado automáticamente (RN-006-01)
cuando el campo Dependencia (Gerencia/Oficina) de un cargo cambia -- nunca
cuando solo cambian cargo/salario dentro de la misma oficina. Append-only:
no se edita ni se elimina, es un registro histórico.

Los campos `*_nombre` se resuelven en el repositorio (join de lectura, no
se persisten) para no duplicar informacion ya dueña de otros módulos
(personal/organizacion/catalogos) en esta tabla propia.
"""
from dataclasses import dataclass


@dataclass(frozen=True)
class PuntoCuenta:
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
