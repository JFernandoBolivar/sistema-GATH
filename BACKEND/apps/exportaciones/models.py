"""
Re-exportador de modelos ORM del módulo exportaciones (Regla B26).
"""
from apps.exportaciones.infrastructure.models.trabajo_exportacion_model import (
    TrabajoExportacionModel,
)

__all__ = ['TrabajoExportacionModel']
