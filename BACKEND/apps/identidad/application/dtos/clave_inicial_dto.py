"""DTO de salida del vencimiento de claves iniciales antiguas (S2-02)."""
from dataclasses import dataclass


@dataclass(frozen=True)
class ResultadoVencimientoClaves:
    """Conteos de una pasada; sin cédulas (no se registran datos personales)."""

    revisadas: int
    ajustadas: int
    dias: int
    dry_run: bool = False
