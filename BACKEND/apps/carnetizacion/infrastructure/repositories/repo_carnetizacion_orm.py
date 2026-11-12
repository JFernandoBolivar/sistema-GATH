"""Repositorio ORM de Carnetización (Reglas B4, B7, O44 - E3).

Las secciones viven en mixins (`repo_carnetizacion_*.py`); esta clase las
compone para conservar el contrato `RepoCarnetizacionORM` de siempre.
"""
from typing import Any

from core.infrastructure.storage.seaweedfs_storage import SeaweedFSStorage

from .repo_carnetizacion_biblioteca import RepoBibliotecaMixin
from .repo_carnetizacion_campos import RepoCamposCredencialMixin
from .repo_carnetizacion_carnets import RepoCarnetsEmitidosMixin
from .repo_carnetizacion_comun import (  # noqa: F401 - re-exportadas
    vencimiento_de_carnet,
    vencimiento_segun_parametros,
)
from .repo_carnetizacion_pdf import RepoCarnetsPdfMixin
from .repo_carnetizacion_privacidad import RepoPrivacidadMixin
from .repo_carnetizacion_qr import RepoQrPrivacidadMixin
from .repo_carnetizacion_sugerencias import RepoSugerenciasColorMixin
from .repo_carnetizacion_tipos import RepoTiposCredencialMixin
from .repo_carnetizacion_tipos_plantillas import RepoPlantillasMixin


class RepoCarnetizacionORM(
    RepoTiposCredencialMixin,
    RepoPlantillasMixin,
    RepoCarnetsEmitidosMixin,
    RepoCarnetsPdfMixin,
    RepoBibliotecaMixin,
    RepoCamposCredencialMixin,
    RepoQrPrivacidadMixin,
    RepoPrivacidadMixin,
    RepoSugerenciasColorMixin,
):
    def __init__(self, almacen: Any = None):
        self._almacen = almacen or SeaweedFSStorage()
