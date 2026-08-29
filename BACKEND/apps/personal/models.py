"""
Re-exportador de modelos ORM del módulo personal (Regla B26).
"""
from apps.personal.infrastructure.models.personal_models import EmployeeModel
from apps.personal.infrastructure.models.catalogos_soporte_models import (
    CarreraModel,
    CodigoPostalModel,
    CondicionViviendaModel,
    GrupoSanguineoModel,
    InstitucionModel,
    MencionModel,
    NivelAcademicoModel,
    PoliticaModel,
)
from apps.personal.infrastructure.models.expediente_models import (
    AntecedenteServicioModel,
    ContactoEmergenciaModel,
    ContratoModel,
    DatosViviendaModel,
    FormacionAcademicaModel,
    PerfilSaludModel,
)

__all__ = [
    'EmployeeModel',
    'PoliticaModel',
    'CondicionViviendaModel',
    'CodigoPostalModel',
    'GrupoSanguineoModel',
    'NivelAcademicoModel',
    'CarreraModel',
    'MencionModel',
    'InstitucionModel',
    'AntecedenteServicioModel',
    'ContratoModel',
    'DatosViviendaModel',
    'PerfilSaludModel',
    'FormacionAcademicaModel',
    'ContactoEmergenciaModel',
]
