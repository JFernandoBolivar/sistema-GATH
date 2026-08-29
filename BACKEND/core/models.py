"""
Re-exportador de modelos ORM del kernel (patrón B2.15 / B26).

Django descubre modelos por convención en `<app>.models`; los modelos reales
viven en `core/infrastructure/models/` para respetar la capa que les
corresponde en la arquitectura Onion.
"""
from core.infrastructure.models.auditoria import AuditoriaLog

__all__ = ['AuditoriaLog']
