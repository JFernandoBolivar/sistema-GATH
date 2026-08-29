"""
Entidad de Dominio `PrestamoCargo` (encargaduría — Fase 2.5 del plan de
reparación). Réplica funcional de `RAC/models/historial_personal_models.py::PrestamoCargo`.
"""
from dataclasses import dataclass


@dataclass(frozen=True)
class PrestamoCargo:
    id: int
    empleado_encargado_cedula: str
    empleado_encargado_nombre: str
    cargo_encargado_id: int
    cargo_encargado_codigo: str
    titular_cedula: str | None
    titular_nombre: str | None
    motivo_id: int
    motivo_nombre: str
    estatus_id: int
    estatus_nombre: str
    fecha_inicio: str
    fecha_fin: str
    ejecutado_por_id: int

    @property
    def esta_finalizada(self) -> bool:
        return self.estatus_nombre.upper() == 'FINALIZADA'
