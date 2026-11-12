"""Puerto de consulta de personas registradas para invitar a un evento."""
from abc import ABC, abstractmethod

from apps.carnetizacion.domain.entities.persona_origen import PersonaOrigen


class RepoOrigenInvitadosPort(ABC):
    @abstractmethod
    def buscar_personal(
        self,
        poblacion: str,
        dependencia_id: int | None,
        busqueda: str,
        offset: int,
        limite: int,
    ) -> tuple[list[PersonaOrigen], int]:
        """Página de trabajadores del filtro y total que lo cumple."""
        raise NotImplementedError

    @abstractmethod
    def cedulas_personal(
        self, poblacion: str, dependencia_id: int | None, busqueda: str, tope: int
    ) -> list[str]:
        """Cédulas de todo el filtro (hasta `tope`) para «seleccionar todos»."""
        raise NotImplementedError

    @abstractmethod
    def resolver_personal(
        self,
        cedulas: list[str] | None,
        poblacion: str,
        dependencia_id: int | None,
        tope: int,
    ) -> list[PersonaOrigen]:
        """Trabajadores por lista de cédulas o, sin ella, por filtro de población (hasta `tope`)."""
        raise NotImplementedError

    @abstractmethod
    def buscar_externos(
        self, busqueda: str, offset: int, limite: int
    ) -> tuple[list[PersonaOrigen], int]:
        raise NotImplementedError

    @abstractmethod
    def ids_externos(self, busqueda: str, tope: int) -> list[str]:
        raise NotImplementedError

    @abstractmethod
    def resolver_externos(self, ids: list[str], tope: int) -> list[PersonaOrigen]:
        raise NotImplementedError
