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

    def crear_dependencia(self, codigo: str, nombre: str) -> Dependencia:
        ...

    def actualizar_dependencia(self, dependencia_id: int, codigo: str, nombre: str) -> Dependencia:
        ...

    def eliminar_dependencia(self, dependencia_id: int) -> None:
        ...

    def listar_direcciones_generales(
        self, dependencia_id: int | None = None
    ) -> list[DireccionGeneral]:
        ...

    def crear_direccion_general(self, codigo: str, nombre: str, dependencia_id: int | None) -> DireccionGeneral:
        ...

    def actualizar_direccion_general(self, direccion_general_id: int, codigo: str, nombre: str, dependencia_id: int | None) -> DireccionGeneral:
        ...

    def eliminar_direccion_general(self, direccion_general_id: int) -> None:
        ...

    def listar_direcciones_linea(
        self, direccion_general_id: int | None = None
    ) -> list[DireccionLinea]:
        ...

    def crear_direccion_linea(self, codigo: str, nombre: str, direccion_general_id: int | None) -> DireccionLinea:
        ...

    def actualizar_direccion_linea(self, direccion_linea_id: int, codigo: str, nombre: str, direccion_general_id: int | None) -> DireccionLinea:
        ...

    def eliminar_direccion_linea(self, direccion_linea_id: int) -> None:
        ...

    def listar_coordinaciones(
        self,
        direccion_linea_id: int | None = None,
        direccion_general_id: int | None = None,
    ) -> list[Coordinacion]:
        ...

    def crear_coordinacion(self, codigo: str, nombre: str, direccion_linea_id: int | None) -> Coordinacion:
        ...

    def actualizar_coordinacion(self, coordinacion_id: int, codigo: str, nombre: str, direccion_linea_id: int | None) -> Coordinacion:
        ...

    def eliminar_coordinacion(self, coordinacion_id: int) -> None:
        ...

    def listar_organismos_adscritos(self) -> list[OrganismoAdscrito]:
        ...

    def crear_organismo_adscrito(self, nombre: str, parent_id: int | None) -> OrganismoAdscrito:
        ...

    def actualizar_organismo_adscrito(self, organismo_id: int, nombre: str, parent_id: int | None) -> OrganismoAdscrito:
        ...

    def eliminar_organismo_adscrito(self, organismo_id: int) -> None:
        ...
