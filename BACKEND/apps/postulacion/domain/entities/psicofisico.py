"""Resultado del test psicofísico (C-6): solo el resultado y el informe; no se guardan las respuestas. Sin Django."""
from dataclasses import dataclass
from datetime import date, datetime

APTO = 'APTO'
NO_APTO = 'NO_APTO'
RESULTADOS_PSICOFISICO = (APTO, NO_APTO)


@dataclass(frozen=True)
class ResultadoPsicofisico:
    """Uno por expediente. `informe_clave` es la clave opaca del PDF en el almacén (vacía = sin informe)."""

    expediente_id: str
    resultado: str
    fecha_aplicacion: date
    observaciones: str = ''
    informe_clave: str = ''
    informe_sha256: str = ''
    informe_tamano: int = 0
    registrado_por: str = ''
    registrado_el: datetime | None = None

    @property
    def tiene_informe(self) -> bool:
        return bool(self.informe_clave)

    @property
    def sugiere_rechazo(self) -> bool:
        return self.resultado == NO_APTO
