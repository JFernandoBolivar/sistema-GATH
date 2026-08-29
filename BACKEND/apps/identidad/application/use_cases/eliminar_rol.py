"""
Caso de uso `eliminar_rol` (baja en el catálogo, cierra CRIT-12).

El legado ya corrigió este endpoint para responder 409 si el rol está en uso
(en vez de dejar cuentas huérfanas o fallar con `ProtectedError` crudo); este
caso de uso porta esa misma regla de negocio a `apps/identidad`. Puro: recibe
el puerto por inyección (B4/B21).
"""
from apps.identidad.domain.ports.repo_roles import RepoRoles
from core.domain.exceptions import ConflictError, NotFoundError


def eliminar_rol(repo: RepoRoles, id: int) -> None:
    """Elimina un rol. Rechaza con 409 si hay cuentas asignadas (CRIT-12)."""
    rol = repo.obtener_por_id(id)
    if rol is None:
        raise NotFoundError('El rol no existe.')

    en_uso = repo.contar_cuentas_con_rol(id)
    if en_uso:
        raise ConflictError(
            f"No se puede eliminar: el rol '{rol.nombre}' está asignado a "
            f"{en_uso} cuenta(s). Reasígnelas primero."
        )

    repo.eliminar(id)
