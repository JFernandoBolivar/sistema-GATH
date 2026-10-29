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

    def url_firmada(self, clave: str, expira_segundos: int = 300) -> str: ...


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
