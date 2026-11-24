"""Re-exportador de modelos ORM del módulo postulacion (Regla B26)."""
from apps.postulacion.infrastructure.models.credencial_models import CredencialPostulanteModel
from apps.postulacion.infrastructure.models.presupuesto_models import (
    ConstanciaPresupuestariaModel,
    PuntoCuentaIngresoModel,
    ReservaPuestoModel,
)
from apps.postulacion.infrastructure.models.psicofisico_models import ResultadoPsicofisicoModel
from apps.postulacion.infrastructure.models.expediente_models import (
    ExpedientePostulacionModel,
    PostulanteModel,
    TransicionExpedienteModel,
)

__all__ = [
    'CredencialPostulanteModel', 'PostulanteModel', 'ExpedientePostulacionModel', 'TransicionExpedienteModel',
    'ResultadoPsicofisicoModel', 'ReservaPuestoModel', 'ConstanciaPresupuestariaModel', 'PuntoCuentaIngresoModel',
]
