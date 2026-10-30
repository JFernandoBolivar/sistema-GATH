"""Filtros de los listados paginados de fe de vida. Sin Django."""
from dataclasses import dataclass
from datetime import date


@dataclass(frozen=True)
class FiltroBandeja:
    proceso_id: str | None = None
    estado: str | None = None
    texto: str | None = None        # cédula o parte del nombre
    desde: date | None = None       # fecha de envío (inclusive)
    hasta: date | None = None


@dataclass(frozen=True)
class FiltroCobertura:
    texto: str | None = None        # cédula o parte del nombre
    tipo_nomina_id: int | None = None
    sin_correo: bool = False
    sin_cuenta: bool = False
