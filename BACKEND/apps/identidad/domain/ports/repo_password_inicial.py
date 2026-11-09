"""
Puerto de la vigencia de la contraseña inicial (decisión F). `USER_cuenta` es legada, así que la
fecha de vencimiento vive en una tabla propia. Hay fila mientras la contraseña vigente es la inicial.
"""
from datetime import datetime
from typing import Protocol


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
