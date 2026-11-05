"""
Casos de uso para consulta y atención de Reportes de Error en Datos Laborales por RRHH (A11).
"""
from datetime import datetime, timezone
from uuid import UUID

from apps.personal.application.dtos.reporte_error_dtos import AtenderReporteErrorDTO
from apps.personal.domain.entities.reporte_error import ReporteErrorDatoLaboral
from apps.personal.domain.ports.repo_reportes_error import RepoReportesErrorLaboral
from core.domain.exceptions import NotFoundError, ValidationError


def listar_reportes_error_laboral(
    repo: RepoReportesErrorLaboral,
    *,
    trabajador_cedula: str | None = None,
    estado: str | None = None,
    dato: str | None = None,
    texto_busqueda: str | None = None,
    limite: int = 50,
    desplazamiento: int = 0,
) -> tuple[list[ReporteErrorDatoLaboral], int]:
    """Consulta paginada con filtros por estado, dato o búsqueda."""
    return repo.listar(
        trabajador_cedula=trabajador_cedula,
        estado=estado,
        dato=dato,
        texto_busqueda=texto_busqueda,
        limite=limite,
        desplazamiento=desplazamiento,
    )


def obtener_reporte_error_laboral(
    repo: RepoReportesErrorLaboral,
    reporte_id: UUID,
) -> ReporteErrorDatoLaboral:
    """Recupera un reporte por su identificador."""
    reporte = repo.obtener_por_id(reporte_id)
    if not reporte:
        raise NotFoundError(f"Reporte de error '{reporte_id}' no encontrado.")
    return reporte


def atender_reporte_error_laboral(
    repo: RepoReportesErrorLaboral,
    dto: AtenderReporteErrorDTO,
) -> ReporteErrorDatoLaboral:
    """Marca como atendido un reporte de error laboral por parte del analista."""
    reporte = repo.obtener_por_id(dto.reporte_id)
    if not reporte:
        raise NotFoundError(f"Reporte de error '{dto.reporte_id}' no encontrado.")

    if not dto.funcionario_cedula or not dto.funcionario_cedula.strip():
        raise ValidationError("La cédula del funcionario que atiende es obligatoria.")

    ahora = datetime.now(timezone.utc)
    reporte.marcar_atendido(
        funcionario_id=dto.funcionario_id,
        funcionario_cedula=dto.funcionario_cedula,
        funcionario_nombre=dto.funcionario_nombre,
        fecha_atencion=ahora,
        observacion=dto.observacion,
    )

    return repo.guardar(reporte)
