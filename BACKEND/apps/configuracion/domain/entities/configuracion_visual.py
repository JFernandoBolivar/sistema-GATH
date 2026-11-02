"""
Entidad de Dominio `ConfiguracionVisual` (HU 0009 — Cintillo Editable).

Fila única (singleton) que controla el cintillo/encabezado institucional de
los PDFs del sistema (motor ReportLab de `core/infrastructure/pdf/` y los 3
reportes React-PDF del frontend). "GENERICO" es una vista neutral de solo
lectura (RN-009-01): el sistema la renderiza con un título genérico y sin
logos institucionales, sin que existan campos editables para ella. "FIJO" es
la configuración institucional editable (nombre de empresa + hasta 3
imágenes + color de fondo).
"""
from dataclasses import dataclass
from typing import Literal

TipoCintillo = Literal['GENERICO', 'FIJO']


@dataclass(frozen=True)
class ConfiguracionVisual:
    id: int
    tipo_cintillo: TipoCintillo
    nombre_empresa: str | None
    logo_principal_clave: str | None
    logo_secundario_clave: str | None
    cintillo_pie_clave: str | None
    color_fondo: str | None
    actualizado_por_id: int | None
    actualizado_en: str | None

    @property
    def es_generico(self) -> bool:
        return self.tipo_cintillo == 'GENERICO'
