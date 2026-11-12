"""Puerto de lectura de cuentas activas y de cuentas con clave inicial (U2). Sin Django."""
from datetime import datetime
from typing import Protocol, Sequence

from apps.identidad.domain.entities.restablecimiento_bloque import CuentaClaveInicial


class RepoCuentasClaveInicial(Protocol):
    def activas(self) -> Sequence[CuentaClaveInicial]:
        """Cuentas activas (para el alcance TODOS)."""
        ...

    def con_clave_inicial(self) -> Sequence[CuentaClaveInicial]:
        """Cuentas activas cuya contraseña vigente sigue siendo la cédula.

        La comparación de hashes vive en el adaptador (la capa de aplicación no
        conoce el framework de contraseñas, regla B4).
        """
        ...

    def vencidas(self, ahora: datetime) -> Sequence[CuentaClaveInicial]:
        """Cuentas activas con fila de contraseña inicial y `vence_en <= ahora`."""
        ...
