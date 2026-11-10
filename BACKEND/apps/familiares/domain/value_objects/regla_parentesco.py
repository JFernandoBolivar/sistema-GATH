"""
Value Object con la regla configurable de un parentesco (S5-01).

Estaba en `application/use_cases/validaciones_familiar.py`; se movió a
`domain/` porque el puerto `LectorValidacionFamiliar` (domain) la necesita y
`domain` no puede importar de `application` (B2/B3). `validaciones_familiar`
la reexporta para no romper los imports existentes. Sin Django (B1).
"""
from dataclasses import dataclass


@dataclass(frozen=True)
class ReglaParentescoFamiliar:
    """Regla configurable del catálogo de parentescos (sin dependencias de Django)."""

    descripcion: str = ''
    es_hijo: bool = False
    menor_a_cargo: bool = False
    sin_cedula_hasta_edad: int | None = None
    edad_minima: int | None = None
    diferencia_minima: int | None = None
    diferencia_tipo: str = 'NINGUNA'
    sexo_permitido: str = ''
    soporte_sugerido: str = ''
    activo: bool = True

    @property
    def permite_cedula_sintetica(self) -> bool:
        return bool(self.es_hijo or self.menor_a_cargo)
