"""
Registra el último acceso de una cuenta (A2-12).

El login del portal emite JWT y no pasa por `django.contrib.auth.login`, así que
`last_login` no se actualiza solo. La vista delega aquí; el repositorio hace el
`UPDATE` puntual.
"""
from datetime import datetime

from apps.identidad.domain.ports.repo_cuentas import RepoCuentas


def registrar_ultimo_acceso(
    repo: RepoCuentas, cuenta_id: int, momento: datetime,
) -> None:
    repo.registrar_ultimo_acceso(cuenta_id, momento)
