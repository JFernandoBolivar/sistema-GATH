"""El último acceso se registra por el caso de uso y el puerto, no desde la vista."""
from datetime import datetime, timezone

from apps.identidad.application.use_cases.registrar_ultimo_acceso import (
    registrar_ultimo_acceso,
)


class RepoCuentasFalso:
    def __init__(self):
        self.llamadas = []

    def registrar_ultimo_acceso(self, id: int, momento) -> None:
        self.llamadas.append((id, momento))


def test_registrar_ultimo_acceso_delega_en_el_repositorio():
    repo = RepoCuentasFalso()
    momento = datetime(2026, 11, 12, 9, 30, tzinfo=timezone.utc)

    registrar_ultimo_acceso(repo, 42, momento)

    assert repo.llamadas == [(42, momento)]
