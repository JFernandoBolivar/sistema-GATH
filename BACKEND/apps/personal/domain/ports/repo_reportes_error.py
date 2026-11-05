"""
Puerto del repositorio para Reportes de Error en Datos Laborales (D-09 / Onion).
"""
from typing import Protocol
from uuid import UUID

from apps.personal.domain.entities.reporte_error import ReporteErrorDatoLaboral


class RepoReportesErrorLaboral(Protocol):
    def guardar(self, reporte: ReporteErrorDatoLaboral) -> ReporteErrorDatoLaboral:
        """Persiste o actualiza un reporte de error laboral."""
        ...

    def obtener_por_id(self, reporte_id: UUID) -> ReporteErrorDatoLaboral | None:
        """Obtiene un reporte por su identificador único."""
        ...

    def listar(
        self,
        *,
        trabajador_cedula: str | None = None,
        estado: str | None = None,
        dato: str | None = None,
        texto_busqueda: str | None = None,
        limite: int = 50,
        desplazamiento: int = 0,
    ) -> tuple[list[ReporteErrorDatoLaboral], int]:
        """Retorna la lista paginada de reportes y el conteo total."""
        ...
