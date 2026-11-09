"""DTOs de Configuración Visual (Regla B2)."""
from dataclasses import dataclass


@dataclass(frozen=True)
class ConfiguracionVisualDTO:
    id: int
    tipo_cintillo: str
    nombre_empresa: str | None
    logo_principal_clave: str | None
    logo_secundario_clave: str | None
    cintillo_pie_clave: str | None
    color_fondo: str | None
    actualizado_por_id: int | None
    actualizado_en: str | None
