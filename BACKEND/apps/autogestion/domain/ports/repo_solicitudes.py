"""
Puertos de persistencia de la solicitud de actualización (Reglas B1, B21, D-09).
"""
from datetime import date, datetime
from typing import Protocol

from apps.autogestion.domain.entities.solicitud_actualizacion import (
    CambioPropuesto,
    DatosComplementarios,
    ProrrogaVentana,
    SeccionAutogestionable,
    SoporteDocumental,
    SolicitudActualizacion,
)


class RepoSolicitudes(Protocol):
    def crear(self, solicitud: SolicitudActualizacion) -> SolicitudActualizacion:
        """Persiste y reserva sus secciones; `ConflictError` si ya hay una abierta en alguna de ellas."""
        ...

    def obtener(self, solicitud_id: str, bloquear: bool = False) -> SolicitudActualizacion | None:
        """`bloquear=True` toma el lock de la fila (dentro de la transacción de la petición)."""
        ...

    def guardar(self, solicitud: SolicitudActualizacion, version_esperada: int) -> SolicitudActualizacion:
        """Bloqueo optimista: `ConflictError` si la versión almacenada difiere. Incrementa `version`."""
        ...

    def liberar_secciones(self, solicitud_id: str, secciones: tuple[str, ...] | None = None) -> None:
        """Libera la reserva de secciones (todas si `secciones` es None)."""
        ...

    def listar(
        self, estado: str | None, cedula: str | None, limite: int, desplazamiento: int,
        desde: date | None = None, hasta: date | None = None,
    ) -> tuple[list[SolicitudActualizacion], int]:
        """Página y total filtrados por estado, cédula y rango (inclusivo) de la fecha de solicitud."""
        ...

    def listar_habilitadas_vencidas(self, ahora: datetime) -> list[SolicitudActualizacion]: ...

    def listar_habilitadas_por_vencer(self, ahora: datetime, hasta: datetime) -> list[SolicitudActualizacion]:
        """HABILITADAS cuya ventana sigue vigente y vence entre `ahora` y `hasta`."""
        ...

    def agregar_prorroga(self, prorroga: ProrrogaVentana) -> ProrrogaVentana: ...

    def listar_prorrogas(self, solicitud_id: str) -> list[ProrrogaVentana]: ...


class RepoCambiosPropuestos(Protocol):
    """Compartido con la fe de vida: se distingue por `origen_tipo`."""

    def reemplazar(self, origen_tipo: str, origen_id: str, cambios: list[CambioPropuesto], conservar_secciones: tuple[str, ...] = ()) -> None:
        """Sustituye los cambios del origen salvo los de `conservar_secciones` (p. ej. la foto)."""
        ...

    def listar(self, origen_tipo: str, origen_id: str) -> list[CambioPropuesto]: ...

    def guardar_decisiones(self, cambios: list[CambioPropuesto]) -> None: ...

    def eliminar_de_seccion(self, origen_tipo: str, origen_id: str, seccion: str) -> None: ...

    def guardar(self, cambio: CambioPropuesto) -> CambioPropuesto:
        """Inserta o reemplaza un cambio (clave: origen, entidad, entidad_id y campo)."""
        ...


class RepoSoportes(Protocol):
    def agregar(self, soporte: SoporteDocumental) -> SoporteDocumental: ...

    def obtener(self, soporte_id: str) -> SoporteDocumental | None: ...

    def listar(self, origen_tipo: str, origen_id: str) -> list[SoporteDocumental]: ...

    def eliminar(self, soporte_id: str) -> None: ...


class RepoSecciones(Protocol):
    def listar(self, solo_activas: bool = True) -> list[SeccionAutogestionable]: ...

    def obtener(self, codigo: str) -> SeccionAutogestionable | None: ...

    def guardar(self, seccion: SeccionAutogestionable) -> SeccionAutogestionable: ...


class RepoDatosComplementarios(Protocol):
    """Tabla propia `datos_complementarios_trabajador` (B13): correo alternativo y «¿tiene hijos?»."""

    def obtener(self, cedula: str) -> DatosComplementarios | None: ...

    def guardar(self, cedula: str, campos: dict, actor_cedula: str) -> DatosComplementarios:
        """Upsert parcial por cédula: solo las claves presentes en `campos`."""
        ...
