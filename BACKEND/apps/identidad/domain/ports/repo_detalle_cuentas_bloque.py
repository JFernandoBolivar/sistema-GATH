"""Puerto de lectura de nombre, correo de acceso y vencimiento de las cuentas de un lote. Sin Django."""
from typing import Protocol, Sequence

from apps.identidad.domain.entities.restablecimiento_bloque import DetalleCuentaBloque


class RepoDetalleCuentasBloque(Protocol):
    def detalle(self, cuenta_ids: Sequence[int]) -> Sequence[DetalleCuentaBloque]:
        """Detalle de las cuentas pedidas, resuelto en bloque (sin consultas por cuenta)."""
        ...
