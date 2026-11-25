"""Configuración operativa del Punto de Cuenta como entidad de dominio (pura, sin Django)."""
from dataclasses import dataclass, field
from datetime import datetime


@dataclass(frozen=True)
class ConfiguracionPuntoCuenta:
    """Procesos habilitados de la emisión automática.

    Los textos y firmas los administra el diseñador de documentos. La versión
    y el actor se conservan para auditar los cambios operativos.
    """

    id: str | None = None
    procesos_habilitados: dict = field(default_factory=dict)
    version: int = 1
    actualizado_por_id: int | None = None
    actualizada_en: datetime | None = None
