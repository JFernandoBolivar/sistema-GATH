"""
Puerto de la vigencia de la contraseña inicial (decisión F). `USER_cuenta` es legada, así que la
fecha de vencimiento vive en una tabla propia. Hay fila mientras la contraseña vigente es la inicial.
"""
from datetime import datetime
from typing import Protocol, Sequence

from apps.identidad.domain.value_objects.clave_inicial import CuentasConClaveInicial


class RepoPasswordInicial(Protocol):
    def emitir(self, cuenta_id: int, vence_en: datetime) -> None:
        """Registra (o renueva) la contraseña inicial de la cuenta con su vencimiento."""
        ...

    def vencimiento(self, cuenta_id: int) -> datetime | None:
        """Vencimiento de la contraseña inicial vigente; None si la cuenta ya no usa una inicial."""
        ...

    def limpiar(self, cuenta_id: int) -> None:
        """La cuenta cambió su contraseña: deja de haber una inicial pendiente."""
        ...

    def cuentas_activas_sin_vencimiento_con_clave_inicial(self) -> CuentasConClaveInicial:
        """Cuentas activas sin fila cuya clave vigente sigue siendo la cédula (S2-02).

        La comparación de hashes la hace la infraestructura: la capa de aplicación no
        conoce el framework de contraseñas (regla B4).
        """
        ...

    def emitir_varias(self, cuenta_ids: Sequence[int], vence_en: datetime) -> int:
        """Emite la fila de vencimiento para varias cuentas a la vez; devuelve cuántas emitió."""
        ...
