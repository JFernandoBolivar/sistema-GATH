"""
Puerto del Repositorio de Eventos, Categorías, Zonas e Invitados (Regla B1, O45-B).
"""
from abc import ABC, abstractmethod
from typing import Any

from apps.carnetizacion.domain.entities.evento import (
    Evento,
    EventoCategoria,
    EventoInvitado,
    EventoZona,
    RegistroAccesoEvento,
    ResumenPanelEvento,
)


class RepoEventosPort(ABC):

    # ─── Eventos ───
    @abstractmethod
    def crear_evento(self, evento: Evento) -> Evento:
        raise NotImplementedError

    @abstractmethod
    def actualizar_evento(self, evento: Evento) -> Evento:
        raise NotImplementedError

    @abstractmethod
    def obtener_evento(self, evento_id: str) -> Evento | None:
        raise NotImplementedError

    @abstractmethod
    def listar_eventos(
        self, estado: str | None = None, busqueda: str | None = None
    ) -> list[Evento]:
        raise NotImplementedError

    # ─── Categorías ───
    @abstractmethod
    def crear_categoria(self, categoria: EventoCategoria) -> EventoCategoria:
        raise NotImplementedError

    @abstractmethod
    def actualizar_categoria(self, categoria: EventoCategoria) -> EventoCategoria:
        raise NotImplementedError

    @abstractmethod
    def obtener_categoria(self, categoria_id: str) -> EventoCategoria | None:
        raise NotImplementedError

    @abstractmethod
    def listar_categorias(self, evento_id: str) -> list[EventoCategoria]:
        raise NotImplementedError

    # ─── Zonas ───
    @abstractmethod
    def crear_zona(self, zona: EventoZona) -> EventoZona:
        raise NotImplementedError

    @abstractmethod
    def actualizar_zona(self, zona: EventoZona) -> EventoZona:
        raise NotImplementedError

    @abstractmethod
    def obtener_zona(self, zona_id: str) -> EventoZona | None:
        raise NotImplementedError

    @abstractmethod
    def listar_zonas(self, evento_id: str) -> list[EventoZona]:
        raise NotImplementedError

    # ─── Invitados ───
    @abstractmethod
    def crear_invitado(self, invitado: EventoInvitado) -> EventoInvitado:
        raise NotImplementedError

    @abstractmethod
    def actualizar_invitado(self, invitado: EventoInvitado) -> EventoInvitado:
        raise NotImplementedError

    @abstractmethod
    def obtener_invitado(self, invitado_id: str) -> EventoInvitado | None:
        raise NotImplementedError

    @abstractmethod
    def buscar_invitado_por_hash_o_codigo(self, hash_o_codigo: str) -> tuple[EventoInvitado | None, Evento | None]:
        raise NotImplementedError

    @abstractmethod
    def listar_invitados(
        self,
        evento_id: str,
        categoria_id: str | None = None,
        zona_id: str | None = None,
        estado: str | None = None,
        busqueda: str | None = None,
    ) -> list[EventoInvitado]:
        raise NotImplementedError

    @abstractmethod
    def registrar_ingreso(
        self,
        invitado_id: str,
        registrado_por_id: int | None,
        zona_id: str | None = None,
    ) -> EventoInvitado:
        raise NotImplementedError

    @abstractmethod
    def registrar_bitacora_acceso(self, registro: RegistroAccesoEvento) -> RegistroAccesoEvento:
        raise NotImplementedError

    # ─── Panel y Estadísticas ───
    @abstractmethod
    def obtener_resumen_panel(self, evento_id: str) -> ResumenPanelEvento:
        raise NotImplementedError

    # ─── Notificaciones ───
    @abstractmethod
    def enviar_correo_invitado(self, invitado: EventoInvitado, evento: Evento) -> bool:
        raise NotImplementedError
