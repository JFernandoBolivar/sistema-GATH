"""
Re-exportador de modelos ORM del módulo catálogos (Regla B26).
"""
from apps.catalogos.infrastructure.models.catalogo_models import (
    CategoriaMovimientoModel,
    EstatusModel,
    GradoModel,
    ParentescoModel,
    SexoModel,
    TipoMovimientoModel,
    TipoNominaModel,
    TipoPersonalModel,
    TipoProcedenciaModel,
    EstadoCivilModel,
    NacionalidadModel,
)
from apps.catalogos.infrastructure.models.geografia_models import (
    EstadoModel,
    MunicipioModel,
    ParroquiaModel,
    RegionModel,
)

__all__ = [
    'RegionModel',
    'EstadoModel',
    'MunicipioModel',
    'ParroquiaModel',
    'SexoModel',
    'EstatusModel',
    'TipoPersonalModel',
    'TipoNominaModel',
    'ParentescoModel',
    'TipoProcedenciaModel',
    'GradoModel',
    'CategoriaMovimientoModel',
    'TipoMovimientoModel',
    'EstadoCivilModel',
    'NacionalidadModel',
]
