"""
DTOs para la gestión de Reportes de Error en Datos Laborales (C-1 / Onion).
"""
from dataclasses import dataclass
from datetime import datetime
from uuid import UUID


@dataclass(frozen=True)
class CrearReporteErrorDTO:
    trabajador_cedula: str
    dato: str
    descripcion: str


@dataclass(frozen=True)
class AtenderReporteErrorDTO:
    reporte_id: UUID
    funcionario_id: int
    funcionario_cedula: str
    funcionario_nombre: str
    observacion: str = ''


@dataclass(frozen=True)
class ReporteErrorDTO:
    id: UUID
    trabajador_cedula: str
    trabajador_nombre: str
    dato: str
    descripcion: str
    estado: str
    creado_el: datetime
    actualizado_el: datetime
    atendido_por_id: int | None = None
    atendido_por_cedula: str = ''
    atendido_por_nombre: str = ''
    atendido_el: datetime | None = None
    observacion_atencion: str = ''
