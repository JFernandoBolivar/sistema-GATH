"""Puertos de persistencia y servicios de la fe de vida (D-09, B21). Sin Django."""
from datetime import datetime
from typing import Protocol

from apps.fe_de_vida.domain.entities.cambio_acta import CambioActa
from apps.fe_de_vida.domain.entities.constancia import Certificador, ConstanciaFeDeVida, PlantillaConstancia
from apps.fe_de_vida.domain.entities.filtros import FiltroBandeja, FiltroCobertura
from apps.fe_de_vida.domain.entities.pasivo import DatosPasivo, PasivoCobertura, TipoPension
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

    def listar_con_prorroga_vigente(self, cedula: str, ahora: datetime) -> list[ProcesoFeDeVida]:
        """Procesos no BORRADOR con una prórroga vigente (general o de esa cédula)."""
        ...

    def agregar_prorroga(self, prorroga: ProrrogaProceso) -> ProrrogaProceso: ...

    def listar_prorrogas(self, proceso_id: str) -> list[ProrrogaProceso]: ...


class LectorAlcance(Protocol):
    """Alcance de los procesos por tipo de pensión (TipoNomina de la asignación PASIVO). Todo se resuelve por consulta."""

    def tipo_nomina_de(self, cedula: str) -> int | None:
        """Tipo de nómina de la asignación PASIVO vigente del trabajador (None si no tiene)."""
        ...

    def cedulas_en_alcance(self, tipos_nomina: tuple[int, ...]) -> list[str]:
        """Cédulas de los pasivos dentro del alcance (`tipos_nomina` vacío = todos los pasivos)."""
        ...

    def tipos_pension(self) -> list[TipoPension]:
        """Catálogo: nóminas de pasivos (TipoNomina con es_activo = False)."""
        ...

    def nombres_tipos(self, ids: list[int]) -> dict[int, str]: ...


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
        self, filtro: FiltroBandeja, limite: int, desplazamiento: int,
    ) -> tuple[list[SolicitudFeDeVida], int]:
        """Bandeja de Bienestar: página y total, más recientes primero."""
        ...


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


class LectorValorActual(Protocol):
    def valor_actual(self, cedula: str, cambio: CambioActa) -> object:
        """Valor que hoy tiene el dato en la ficha del trabajador (None si no aplica, p. ej. al CREAR)."""
        ...


class VerificadorPasivo(Protocol):
    def es_pasivo(self, cedula: str) -> bool: ...


class RepoConstancias(Protocol):
    def plantilla_activa(self) -> PlantillaConstancia | None: ...

    def obtener_de_solicitud(self, solicitud_id: str) -> ConstanciaFeDeVida | None: ...

    def obtener_por_codigo(self, codigo: str) -> ConstanciaFeDeVida | None: ...

    def reservar(
        self, solicitud_id: str, cedula: str, anio: int, certificadores: tuple[Certificador, ...],
        plantilla_version: int, ahora: datetime,
    ) -> ConstanciaFeDeVida:
        """Crea la constancia con el siguiente número correlativo del año (FV-AAAA-NNNNNN) y su código de verificación."""
        ...

    def registrar_pdf(self, constancia_id: str, clave_pdf: str) -> ConstanciaFeDeVida: ...


class LectorPasivos(Protocol):
    def datos(self, cedula: str) -> DatosPasivo:
        """Nombre, condición (tipo de nómina) y correos. `NotFoundError` si la persona no existe."""
        ...

    def nombre_de(self, cedula: str) -> str: ...

    def nombres_de(self, cedulas: list[str]) -> dict[str, str]: ...


class RepoCobertura(Protocol):
    def listar(self, filtro: FiltroCobertura, limite: int, desplazamiento: int) -> tuple[list[PasivoCobertura], int]:
        """Pasivos (según su asignación laboral) sin correo o sin cuenta de acceso."""
        ...


class GeneradorConstancia(Protocol):
    def generar(
        self, *, constancia: ConstanciaFeDeVida, plantilla: PlantillaConstancia, texto: str, proceso_nombre: str,
        emitida_en: datetime, via_directa: bool, url_verificacion: str,
    ) -> bytes: ...
