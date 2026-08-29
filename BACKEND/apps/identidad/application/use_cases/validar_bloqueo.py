"""
Caso de uso `validar_bloqueo` (B3.12).

Consulta el estado de bloqueo de una cuenta antes de validar credenciales.
La regla "¿sigue vigente?" vive aquí (capa application); el repositorio solo
expone el instante almacenado. Puro: recibe el puerto por inyección (B4/B21).
"""
from datetime import datetime, timezone

from apps.identidad.domain.ports.repo_bloqueos import RepoBloqueos


def validar_bloqueo(
    repo: RepoBloqueos,
    cedula: str,
    ahora: datetime | None = None,
) -> datetime | None:
    """`bloqueada_hasta` si el bloqueo sigue vigente; None si puede intentar."""
    ahora = ahora or datetime.now(timezone.utc)
    vencimiento = repo.esta_bloqueada(cedula)
    if vencimiento is not None and vencimiento > ahora:
        return vencimiento
    return None
