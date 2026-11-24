"""Constancia presupuestaria: el resultado de la gestión externa de disponibilidad (E-3, C-2). Sin Django."""
from dataclasses import dataclass
from datetime import datetime


@dataclass(frozen=True)
class ConstanciaPresupuestaria:
    """Una por expediente; declarar de nuevo CORRIGE la anterior. El sistema NO calcula la disponibilidad."""

    expediente_id: str
    declarado_por_cedula: str
    declarado_por_nombre: str
    referencia: str                  # número de partida u oficio
    fecha: datetime
    observaciones: str = ''
    adjunto_clave: str = ''
    adjunto_sha256: str = ''
    adjunto_tamano: int = 0

    @property
    def tiene_adjunto(self) -> bool:
        return bool(self.adjunto_clave)
