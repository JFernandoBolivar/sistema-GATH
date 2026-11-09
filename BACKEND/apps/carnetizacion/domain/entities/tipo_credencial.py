"""
Entidad de Dominio `TipoCredencial` (O44 - E3).
Catálogo extensible de tipos de credencial (trabajadores, pasivos, etc.).
"""
from dataclasses import dataclass


@dataclass(frozen=True)
class TipoCredencial:
    codigo: str
    nombre: str
    descripcion: str
    ancho_mm: float
    alto_mm: float
    orientacion: str  # 'vertical' | 'horizontal'
    grupo: str = 'trabajador'
    activo: bool = True
    orden: int = 1
