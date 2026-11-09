"""Re-exportador de modelos ORM del kernel."""
from core.infrastructure.models.auditoria import AuditoriaLog
from core.infrastructure.models.bootstrap import BootstrapStateModel

__all__ = ['AuditoriaLog', 'BootstrapStateModel']
