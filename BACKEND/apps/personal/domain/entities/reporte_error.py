"""
Entidad de dominio: Reporte de error en datos laborales (D20 / Tarea A11).

Permite que el trabajador notifique formalmente a Talento Humano una discrepancia
en sus datos laborales (cargo, oficina, fecha de ingreso u otro dato) sin mutar
directamente su expediente ni alterar la estructura organizativa.
"""
from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from uuid import UUID

from core.domain.exceptions import ValidationError


class DatoLaboralReportado(str, Enum):
    CARGO = 'cargo'
    OFICINA = 'oficina'
    FECHA_INGRESO = 'fecha_ingreso'
    OTRO = 'otro'


class EstadoReporteError(str, Enum):
    PENDIENTE = 'PENDIENTE'
    ATENDIDO = 'ATENDIDO'


LONGITUD_MINIMA_DESCRIPCION = 10
LONGITUD_MAXIMA_DESCRIPCION = 500


@dataclass
class ReporteErrorDatoLaboral:
    id: UUID
    trabajador_cedula: str
    trabajador_nombre: str
    dato: DatoLaboralReportado
    descripcion: str
    estado: EstadoReporteError
    creado_el: datetime
    actualizado_el: datetime
    atendido_por_id: int | None = None
    atendido_por_cedula: str = ''
    atendido_por_nombre: str = ''
    atendido_el: datetime | None = None
    observacion_atencion: str = ''

    def __post_init__(self):
        if not self.trabajador_cedula or not self.trabajador_cedula.strip():
            raise ValidationError("La cédula del trabajador es requerida.")

        desc = (self.descripcion or '').strip()
        if len(desc) < LONGITUD_MINIMA_DESCRIPCION or len(desc) > LONGITUD_MAXIMA_DESCRIPCION:
            raise ValidationError(
                f"La descripción debe tener entre {LONGITUD_MINIMA_DESCRIPCION} "
                f"y {LONGITUD_MAXIMA_DESCRIPCION} caracteres."
            )

    @property
    def esta_pendiente(self) -> bool:
        return self.estado == EstadoReporteError.PENDIENTE

    def marcar_atendido(
        self,
        *,
        funcionario_id: int,
        funcionario_cedula: str,
        funcionario_nombre: str,
        fecha_atencion: datetime,
        observacion: str = '',
    ) -> None:
        """Marca el reporte como atendido por el funcionario de Talento Humano."""
        if not self.esta_pendiente:
            raise ValidationError("El reporte ya se encuentra atendido.")

        self.estado = EstadoReporteError.ATENDIDO
        self.atendido_por_id = funcionario_id
        self.atendido_por_cedula = funcionario_cedula.strip()
        self.atendido_por_nombre = funcionario_nombre.strip()
        self.atendido_el = fecha_atencion
        self.observacion_atencion = (observacion or '').strip()
        self.actualizado_el = fecha_atencion
