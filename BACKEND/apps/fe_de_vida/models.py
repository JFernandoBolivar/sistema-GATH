"""Re-exportador de modelos ORM del módulo fe_de_vida (Regla B26)."""
from apps.fe_de_vida.infrastructure.models.proceso_models import ProcesoFeDeVidaModel, ProrrogaProcesoModel
from apps.fe_de_vida.infrastructure.models.solicitud_models import (
    ConstanciaFeDeVidaModel,
    DecisionFeDeVidaModel,
    PlantillaConstanciaModel,
    SolicitudFeDeVidaModel,
)

__all__ = [
    'ProcesoFeDeVidaModel', 'ProrrogaProcesoModel', 'SolicitudFeDeVidaModel', 'DecisionFeDeVidaModel',
    'ConstanciaFeDeVidaModel', 'PlantillaConstanciaModel',
]
