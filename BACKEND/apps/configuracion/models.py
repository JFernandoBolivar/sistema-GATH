"""Re-exporta los modelos de `infrastructure/models/` (regla B26)."""
from apps.configuracion.infrastructure.models.configuracion_visual_model import ConfiguracionVisualModel
from apps.configuracion.infrastructure.models.parametro_model import ParametroSistemaModel

__all__ = ['ConfiguracionVisualModel', 'ParametroSistemaModel']
