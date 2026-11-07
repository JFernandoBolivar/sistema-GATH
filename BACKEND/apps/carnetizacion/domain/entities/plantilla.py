"""
Entidad de Dominio `PlantillaCarnet` (O44 - E3).
Motor de plantillas por capas en mm, dos caras, tamaños libres, versiones y estado.
"""
from dataclasses import dataclass, field
from typing import Any


@dataclass(frozen=True)
class PlantillaCarnet:
    id: str | int
    nombre: str
    imagen_url: str = ""
    activo: bool | None = None
    creado: str = ""
    codigo_tipo: str = "trabajador"
    ancho_mm: float = 54.0
    alto_mm: float = 85.6
    orientacion: str = "vertical"  # 'vertical' | 'horizontal'
    regla_criterio: str = "todos"  # 'todos', 'nomina', 'cargo', 'oficina', etc.
    regla_valor: str = "*"
    estado: str = "publicada"      # 'borrador' | 'publicada' | 'archivada'
    activa: bool = True
    version: int = 1
    definicion: dict[str, Any] = field(default_factory=dict)
    actualizado: str = ""
    plantilla_raiz_id: str | int | None = None
    creado_por: str | None = None
    descripcion: str = ""

    def __post_init__(self):
        if self.activo is not None:
            object.__setattr__(self, 'activa', bool(self.activo))
        else:
            object.__setattr__(self, 'activo', bool(self.activa))
