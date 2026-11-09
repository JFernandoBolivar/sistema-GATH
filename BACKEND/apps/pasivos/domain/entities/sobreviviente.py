"""
Entidades de dominio del alta de pensionados por sobrevivencia (C20).
Sin Django ni DRF (regla B1).
"""
from dataclasses import dataclass

TIPO_PENSION_SOBREVIVIENTE = 'PENSION_SOBREVIVIENTE'


@dataclass(frozen=True)
class FamiliarBeneficiario:
    """Familiar del titular fallecido candidato a pensión de sobrevivencia."""

    id: int
    cedula: str | None
    nombres: str
    apellidos: str
    heredero: bool = False


@dataclass(frozen=True)
class ResultadoAltaSobreviviente:
    """Resultado del alta de un beneficiario; `creado=False` indica idempotencia."""

    cedula: str
    nombre_completo: str
    creado: bool
    codigo_asignacion: str | None = None
