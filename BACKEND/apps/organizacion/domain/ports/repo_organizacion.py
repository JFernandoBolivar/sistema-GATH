"""
Puerto del Repositorio de Organización (Reglas B1, B21).
Define el contrato abstracto para consultar y gestionar la estructura organizativa.
"""
from typing import Protocol

from apps.organizacion.domain.entities.coordinacion import Coordinacion
from apps.organizacion.domain.entities.dependencia import Dependencia
from apps.organizacion.domain.entities.direccion_general import DireccionGeneral
from apps.organizacion.domain.entities.direccion_linea import DireccionLinea
from apps.organizacion.domain.entities.organismo_adscrito import OrganismoAdscrito


class RepoOrganizacion(Protocol):
    def listar_dependencias(self) -> list[Dependencia]:
        ...

    def obtener_dependencia(self, dependencia_id: int) -> Dependencia | None:
        ...

    def listar_direcciones_generales(
        self, dependencia_id: int | None = None
    ) -> list[DireccionGeneral]:
        ...

    def listar_direcciones_linea(
        self, direccion_general_id: int | None = None
    ) -> list[DireccionLinea]:
        ...

    def listar_coordinaciones(
        self,
        direccion_linea_id: int | None = None,
        direccion_general_id: int | None = None,
    ) -> list[Coordinacion]:
        ...

    def listar_organismos_adscritos(self) -> list[OrganismoAdscrito]:
        ...
