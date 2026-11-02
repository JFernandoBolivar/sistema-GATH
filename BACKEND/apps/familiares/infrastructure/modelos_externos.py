"""
Re-exporta modelos ORM de otros módulos que el serializer de familiares
necesita para validar catálogos compartidos (parentesco, sexo, salud,
físico, académico) y resolver el empleado dueño de la carga familiar.

Solo `infrastructure/` puede cruzar módulos (regla B16, ver cabecera de
`.importlinter`) — este archivo es el único punto de esa frontera para
`apps.familiares`; `presentation/` importa de aquí, nunca directo de
`apps.catalogos`/`apps.personal`.
"""
from apps.catalogos.infrastructure.models.catalogo_models import ParentescoModel
from apps.personal.infrastructure.models.catalogos_soporte_models import (
    AlergiaModel,
    CarreraModel,
    DiscapacidadModel,
    GrupoSanguineoModel,
    InstitucionModel,
    MencionModel,
    NivelAcademicoModel,
    PatologiaCronicaModel,
    TallaModel,
)
from apps.personal.infrastructure.models.personal_models import EmployeeModel

__all__ = [
    'AlergiaModel',
    'CarreraModel',
    'DiscapacidadModel',
    'EmployeeModel',
    'GrupoSanguineoModel',
    'InstitucionModel',
    'MencionModel',
    'NivelAcademicoModel',
    'ParentescoModel',
    'PatologiaCronicaModel',
    'TallaModel',
]
