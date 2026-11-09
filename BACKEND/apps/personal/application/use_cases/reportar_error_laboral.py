"""
Caso de uso: Crear Reporte de Error en Datos Laborales (D20 / A11).

Invocado desde «Mi ficha» (Autogestión). Registra la discrepancia reportada
por el trabajador y despacha la notificación a Talento Humano.
No altera ninguna tabla maestra ni modifica el expediente del trabajador.
"""
from datetime import datetime, timezone
from typing import Callable
from uuid import uuid4

from apps.personal.application.dtos.reporte_error_dtos import CrearReporteErrorDTO
from apps.personal.domain.entities.reporte_error import (
    DatoLaboralReportado,
    EstadoReporteError,
    ReporteErrorDatoLaboral,
)
from apps.personal.domain.ports.repo_reportes_error import RepoReportesErrorLaboral
from core.domain.exceptions import ValidationError
from core.domain.notificaciones import SolicitudNotificacion


def crear_reporte_error_laboral(
    repo: RepoReportesErrorLaboral,
    dto: CrearReporteErrorDTO,
    trabajador_nombre: str,
    notificador_fn: Callable[[SolicitudNotificacion], None] | None = None,
) -> ReporteErrorDatoLaboral:
    """Valida, persiste el reporte y notifica al personal con permiso en RRHH."""
    dato_str = (dto.dato or '').strip().lower()
    try:
        dato_enum = DatoLaboralReportado(dato_str)
    except ValueError:
        validos = ", ".join(d.value for d in DatoLaboralReportado)
        raise ValidationError(f"Dato laboral inválido: '{dto.dato}'. Debe ser uno de: {validos}.")

    ahora = datetime.now(timezone.utc)
    reporte = ReporteErrorDatoLaboral(
        id=uuid4(),
        trabajador_cedula=dto.trabajador_cedula.strip(),
        trabajador_nombre=(trabajador_nombre or '').strip(),
        dato=dato_enum,
        descripcion=dto.descripcion,
        estado=EstadoReporteError.PENDIENTE,
        creado_el=ahora,
        actualizado_el=ahora,
    )

    reporte_guardado = repo.guardar(reporte)

    if notificador_fn:
        etiquetas_dato = {
            DatoLaboralReportado.CARGO: "Cargo",
            DatoLaboralReportado.OFICINA: "Oficina / Gerencia",
            DatoLaboralReportado.FECHA_INGRESO: "Fecha de ingreso",
            DatoLaboralReportado.OTRO: "Otro dato laboral",
        }
        dato_legible = etiquetas_dato.get(dato_enum, dato_enum.value)
        nombre_display = trabajador_nombre.strip() or dto.trabajador_cedula.strip()

        solicitud = SolicitudNotificacion(
            modulo='personal',
            permiso_destino='personal.reportes_error_ver',
            tipo='reporte_error_laboral',
            titulo='Reporte de error en datos laborales',
            mensaje=(
                f"El trabajador {nombre_display} ({dto.trabajador_cedula.strip()}) "
                f"reportó una discrepancia en: {dato_legible}."
            ),
            enlace='/personal/reportes-error',
            ref_tipo='reporte_error_laboral',
            ref_id=str(reporte_guardado.id),
            clave=f"reporte_error_{reporte_guardado.id}",
        )
        try:
            notificador_fn(solicitud)
        except Exception:
            # Una falla en el sistema de notificación no debe anular la creación del reporte
            pass

    return reporte_guardado
