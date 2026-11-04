"""Puerto del repositorio de trabajos de exportación."""
from datetime import datetime
from typing import Protocol

from apps.exportaciones.domain.entities.trabajo_exportacion import TrabajoExportacion


class RepoExportaciones(Protocol):
    def crear(self, trabajo: TrabajoExportacion) -> TrabajoExportacion: ...

    def obtener(self, trabajo_id: str) -> TrabajoExportacion | None: ...

    def contar_activos_de(self, solicitante_id: int | None) -> int: ...

    def guardar_task_id(self, trabajo_id: str, task_id: str) -> None: ...

    def marcar_en_proceso(self, trabajo_id: str, ahora: datetime) -> bool:
        """Pasa PENDIENTE -> EN_PROCESO. False si el trabajo ya no está pendiente (idempotencia)."""
        ...

    def actualizar_progreso(self, trabajo_id: str, progreso: int) -> None: ...

    def marcar_listo(
        self, trabajo_id: str, *, clave_archivo: str, nombre_archivo: str,
        tamano_bytes: int, metadatos: dict, ahora: datetime,
    ) -> None: ...

    def marcar_error(self, trabajo_id: str, mensaje: str, ahora: datetime) -> None: ...

    def listar_vencidos(self, ahora: datetime, limite: int) -> list[TrabajoExportacion]:
        """LISTO con `expira_en` vencido (se borra su archivo)."""
        ...

    def marcar_expirado(self, trabajo_id: str) -> None: ...

    def eliminar_antiguos(self, antes_de: datetime) -> int:
        """Borra filas finalizadas (ERROR/EXPIRADO) anteriores a `antes_de`."""
        ...

    def marcar_atascados(self, creados_antes_de: datetime, ahora: datetime) -> int:
        """PENDIENTE/EN_PROCESO creados antes de `creados_antes_de` -> ERROR (worker caído)."""
        ...
