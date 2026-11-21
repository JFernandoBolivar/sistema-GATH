"""Re-exportador de modelos ORM del módulo postulacion (Regla B26)."""
from apps.postulacion.infrastructure.models.expediente_models import (
    ExpedientePostulacionModel,
    PostulanteModel,
    TransicionExpedienteModel,
)

__all__ = ['PostulanteModel', 'ExpedientePostulacionModel', 'TransicionExpedienteModel']
