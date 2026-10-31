"""
Puertos transversales del kernel de dominio (B2.2).

Interfaces `Protocol` — sin Django, sin DRF, sin ORM, sin Celery (regla B1).
Cada módulo de negocio declara sus propios puertos de repositorio en
`apps/[modulo]/domain/ports/repo_[entidad].py`; los de aquí son los contratos
que usan varios módulos a la vez (regla B16: lo transversal vive en `core/`).

Las implementaciones concretas viven en `infrastructure/` de cada capa
(p. ej. `core/infrastructure/storage/seaweedfs_storage.py` para `FileStorage`,
diferido a la Fase B5).
"""
from typing import Any, Iterator, Protocol, TypeVar

from core.domain.notificaciones import SolicitudNotificacion

T = TypeVar('T')
ID = TypeVar('ID')


class Repository(Protocol[T, ID]):
    """Contrato mínimo de repositorio (patrón Repository, D-09)."""

    def obtener_por_id(self, id: ID) -> T | None: ...

    def guardar(self, entidad: T) -> T: ...


class UnitOfWork(Protocol):
    """Delimita una transacción de negocio que puede abarcar varios repositorios."""

    def __enter__(self) -> 'UnitOfWork': ...

    def __exit__(self, exc_type, exc_value, traceback) -> None: ...

    def confirmar(self) -> None: ...

    def revertir(self) -> None: ...


class FileStorage(Protocol):
    """Puerto de almacenamiento de archivos. Implementación SeaweedFS: Fase B5 (D-01)."""

    def subir(self, clave: str, contenido: bytes, mime_type: str) -> str: ...

    def descargar(self, clave: str) -> bytes: ...

    def descargar_flujo(self, clave: str, tamano_bloque: int = 65536) -> Iterator[bytes]: ...

    def eliminar(self, clave: str) -> None:
        """Borra el objeto (idempotente: una clave inexistente no es error)."""
        ...


class Notificador(Protocol):
    """
    Puerto transversal de notificaciones (campana + correo). Lo implementa `apps.notificaciones`
    y lo registra en `core.infrastructure.providers`; los módulos de negocio solo piden notificar
    con una `SolicitudNotificacion` y nunca importan la app de notificaciones (B16).
    """

    def notificar(self, solicitud: 'SolicitudNotificacion') -> int:
        """Crea las notificaciones (y el correo, si se pidió) en la transacción vigente. Devuelve cuántas creó."""
        ...


class TaskQueue(Protocol):
    """
    Puerto de encolado asíncrono. Ningún caso de uso importa Celery directamente
    (regla B20); encola a través de esta interfaz. Implementación Celery/RabbitMQ: Fase B5 (D-02).
    """

    def encolar(self, nombre_tarea: str, **kwargs: Any) -> str: ...


class AuditLogger(Protocol):
    """
    Puerto de auditoría dual (DB + TXT, D-04). Implementación concreta:
    `core/presentation/audit.py::registrar_auditoria` (B2.8).
    """

    def registrar(
        self,
        *,
        trace_id: str,
        actor_id: int | None,
        accion: str,
        modulo: str,
        recurso_tipo: str,
        recurso_id: str,
        resultado: str,
        estado_previo: dict | None = None,
        estado_nuevo: dict | None = None,
        ip_origen: str | None = None,
        user_agent: str = '',
    ) -> None: ...


class ReportGenerator(Protocol):
    """Puerto de generación de reportes (PDF/Excel). Consolidación de motores: R-07."""

    def generar(self, plantilla: str, contexto: dict) -> bytes: ...


class ResolutorPermisos(Protocol):
    """
    Puerto del resolutor de autorización por código `[modulo].[accion]`
    (Contrato C-3, B3.2).

    El kernel declara el contrato pero no conoce implementaciones (el kernel
    nunca importa de `apps/`, regla B16): la app `apps.identidad` registra la
    suya en `core.infrastructure.providers.registrar_resolutor_permisos()`
    durante su `AppConfig.ready()`.

    El actor viaja como primitivas de sesión (`cuenta.pk`, `cuenta.rol_id`),
    sin tipos del modelo legado.
    """

    def tiene_permiso(
        self,
        *,
        actor_id: int | None,
        rol_id: int | None,
        codigo: str,
        cedula: str | None = None,
    ) -> bool: ...

    def permisos_de_actor(
        self,
        *,
        actor_id: int | None,
        rol_id: int | None,
        cedula: str | None = None,
    ) -> frozenset[str]: ...


class ReportFieldRegistry(Protocol):
    """
    Puerto de mapeo de campos a ORM para reportes (R-06, B5.11).

    Consolida los dos motores duplicados que existían en
    `RAC/utils/mapa_reporte.py` y `AUTOGESTION/utils/mapa_reporte.py`: ambos
    tenían el mismo esquema por categoría (`modelo`, `campos_permitidos`,
    `filtros_permitidos`) y claves sin colisión, así que la implementación
    concreta (`core/infrastructure/report_field_registry.py`) simplemente los
    fusiona en un único registro, sin cambiar valores.
    """

    def configuracion(self, categoria: str) -> dict | None: ...

    def categorias_disponibles(self) -> list[str]: ...

    def tipos_reporte(self) -> set[str]: ...


class ResolutorCondicionTrabajador(Protocol):
    """
    Puerto del resolutor de la condición del trabajador (`ACTIVO`/`PASIVO`/`SIN_ASIGNACION`).

    La condición es un dato derivado de la asignación laboral, no un permiso ni un rol.
    `apps.identidad` registra su implementación en `AppConfig.ready()`; el kernel solo
    conoce el contrato (regla B16).
    """

    def condicion_de(self, cedula: str) -> str: ...


class LectorConfiguracion(Protocol):
    """
    Puerto de los parámetros del sistema editables (D9). Lo implementa
    `apps.configuracion` y se registra en `core.infrastructure.providers` durante
    su `AppConfig.ready()`; los módulos leen valores tipados y nunca importan
    Django para ellos. Si la fila no existe todavía, el lector devuelve el
    valor por defecto de la definición del parámetro.
    """

    def obtener_texto(self, clave: str) -> str: ...

    def obtener_booleano(self, clave: str) -> bool: ...

    def obtener_entero(self, clave: str) -> int: ...
