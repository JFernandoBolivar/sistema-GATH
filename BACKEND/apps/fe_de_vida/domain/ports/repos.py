"""Puertos de persistencia y servicios de la fe de vida (D-09, B21). Sin Django."""
from datetime import datetime
from typing import Protocol

from apps.fe_de_vida.domain.entities.cambio_acta import CambioActa
from apps.fe_de_vida.domain.entities.proceso import ProcesoFeDeVida, ProrrogaProceso
from apps.fe_de_vida.domain.entities.solicitud import SolicitudFeDeVida


class RepoProcesos(Protocol):
    def crear(self, proceso: ProcesoFeDeVida) -> ProcesoFeDeVida: ...

    def obtener(self, proceso_id: str, bloquear: bool = False) -> ProcesoFeDeVida | None: ...

    def guardar(self, proceso: ProcesoFeDeVida) -> ProcesoFeDeVida: ...

    def listar(self, estado: str | None = None) -> list[ProcesoFeDeVida]: ...

    def listar_abiertos_vencidos(self, ahora: datetime) -> list[ProcesoFeDeVida]:
        """Procesos ABIERTOS cuya fecha de cierre ya pasó (cierre automático por beat)."""
        ...

    def agregar_prorroga(self, prorroga: ProrrogaProceso) -> ProrrogaProceso: ...

    def listar_prorrogas(self, proceso_id: str) -> list[ProrrogaProceso]: ...


class RepoSolicitudesFeDeVida(Protocol):
    def crear(self, solicitud: SolicitudFeDeVida) -> SolicitudFeDeVida:
        """`ConflictError` si ya existe una solicitud de esa cédula en ese proceso (una por pasivo y proceso)."""
        ...

    def obtener(self, solicitud_id: str, bloquear: bool = False) -> SolicitudFeDeVida | None: ...

    def obtener_de(self, proceso_id: str, cedula: str, bloquear: bool = False) -> SolicitudFeDeVida | None: ...

    def guardar(self, solicitud: SolicitudFeDeVida, version_esperada: int) -> SolicitudFeDeVida:
        """Bloqueo optimista (`ConflictError` si difiere). Persiste solo las decisiones nuevas (historial inmutable)."""
        ...

    def listar_de_cedula(self, cedula: str) -> list[SolicitudFeDeVida]: ...

    def listar_de_proceso(self, proceso_id: str, estados: tuple[str, ...] | None = None) -> list[SolicitudFeDeVida]: ...

    def listar(
        self, proceso_id: str | None, estado: str | None, cedula: str | None, limite: int, desplazamiento: int,
    ) -> tuple[list[SolicitudFeDeVida], int]: ...


class RepoCambiosActa(Protocol):
    """Respuestas del acta como cambios propuestos (se reutiliza `CambioPropuesto` de autogestión)."""

    def reemplazar(self, solicitud_id: str, cambios: list[CambioActa]) -> None: ...

    def listar(self, solicitud_id: str) -> list[CambioActa]: ...


class ValidadorCambiosActa(Protocol):
    def validar(self, cedula: str, cambio: CambioActa) -> CambioActa | None:
        """Valida contra la lista blanca y devuelve el cambio normalizado (con `valor_anterior`); None si no difiere del dato actual."""
        ...


class AplicadorCambiosActa(Protocol):
    def aplicar(self, solicitud_id: str, cedula: str, actor_cedula: str, ahora: datetime) -> int:
        """
        C19: aprueba los cambios pendientes del acta y los aplica a los datos reales con
        `aplicar_cambios_aprobados` (autogestión), en la transacción vigente. Devuelve cuántos aplicó.
        """
        ...


class VerificadorPasivo(Protocol):
    def es_pasivo(self, cedula: str) -> bool: ...
