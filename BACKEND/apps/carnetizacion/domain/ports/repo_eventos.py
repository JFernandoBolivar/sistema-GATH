"""
Puerto del Repositorio de Eventos, Categorías, Zonas e Invitados (Regla B1, O45-B).
"""
from abc import ABC, abstractmethod

from apps.carnetizacion.domain.entities.persona_origen import PersonaOrigen
from apps.carnetizacion.domain.entities.evento import (
    Evento,
    EventoCategoria,
    EventoInvitado,
    EventoZona,
    RegistroAccesoEvento,
    ResolucionCarnetInstitucional,
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

    @abstractmethod
    def listar_eventos_paginado(
        self,
        offset: int,
        limite: int,
        estado: str | None = None,
        busqueda: str | None = None,
    ) -> tuple[list[Evento], int]:
        """Página de eventos y total del filtro. `estado` admite también «proximo»."""
        raise NotImplementedError

    @abstractmethod
    def resumen_global_eventos(self) -> dict[str, int]:
        """Totales reales de todos los eventos: eventos, en_curso, proximos, invitados, ingresos."""
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
    def siguiente_codigo_credencial(self) -> str:
        """Siguiente código INV libre en TODA la tabla (la columna es única global)."""
        raise NotImplementedError

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

    def resolver_carnet_institucional(
        self, codigo: str, evento_id: str | None = None,
    ) -> tuple[ResolucionCarnetInstitucional, EventoInvitado | None, Evento | None]:
        """Interpreta `codigo` como el QR de un carnet institucional (`security_hash`).

        Devuelve si es un carnet vigente, anulado o vencido y, si el trabajador está invitado al
        evento, su invitación. Por defecto ningún código es un carnet institucional.
        """
        return ResolucionCarnetInstitucional.NO_ES_CARNET, None, None

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
    def listar_invitados_paginado(
        self,
        evento_id: str,
        offset: int,
        limite: int,
        categoria_id: str | None = None,
        zona_id: str | None = None,
        estado: str | None = None,
        busqueda: str | None = None,
    ) -> tuple[list[EventoInvitado], int]:
        """Página de invitados (corte en la consulta) y total que cumple el filtro."""
        raise NotImplementedError

    @abstractmethod
    def listar_ids_invitados(
        self,
        evento_id: str,
        categoria_id: str | None = None,
        zona_id: str | None = None,
        estado: str | None = None,
        busqueda: str | None = None,
    ) -> list[str]:
        """Solo los ids que cumplen el filtro (selección masiva de todo el filtro)."""
        raise NotImplementedError

    @abstractmethod
    def documentos_invitados(self, evento_id: str) -> set[str]:
        """Documentos (normalizados) de quienes ya están invitados al evento."""
        raise NotImplementedError

    @abstractmethod
    def agregar_invitados_en_bloque(
        self,
        evento_id: str,
        categoria_id: str,
        zona_id: str,
        personas: list[PersonaOrigen],
    ) -> tuple[int, int]:
        """Inserta en una transacción a quienes no estén ya invitados.

        Devuelve `(agregados, duplicados)`.
        """
        raise NotImplementedError

    @abstractmethod
    def contar_invitados_categoria(self, categoria_id: str) -> int:
        raise NotImplementedError

    @abstractmethod
    def contar_invitados_zona(self, zona_id: str) -> int:
        raise NotImplementedError

    @abstractmethod
    def eliminar_categoria(self, categoria_id: str) -> None:
        raise NotImplementedError

    @abstractmethod
    def eliminar_zona(self, zona_id: str) -> None:
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
