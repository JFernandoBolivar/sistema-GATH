"""
Caso de uso `resolver_permisos` (B3.2).

Dado un actor de sesión, devuelve el conjunto de códigos `[modulo].[accion]`
efectivos desde el repositorio. Es la única vía por la que
`core/presentation/permissions.py` autoriza (puerto
`core.domain.ports.ResolutorPermisos`): confina el intercambio de B9 a este
punto. Puro: recibe el puerto por inyección (B4/B21), sin Django.
"""
from apps.identidad.application.dtos.permisos_dto import ActorSesionDTO
from apps.identidad.domain.entities.politica_acceso import PoliticaAcceso
from apps.identidad.domain.ports.repo_permisos import RepoPermisos
from apps.identidad.domain.services.evaluador_permisos import evaluar_permiso


def resolver_politica_actor(repo: RepoPermisos, actor: ActorSesionDTO) -> PoliticaAcceso:
    """Calcula la política efectiva de acceso (allow/deny) del actor."""
    if actor.cedula:
        usuario_perm = repo.obtener_permisos_usuario(actor.cedula)
        if usuario_perm:
            return usuario_perm.politica_efectiva

    if actor.rol_id is not None:
        return repo.politica_del_rol(actor.rol_id)

    return PoliticaAcceso()


def resolver_permisos(repo: RepoPermisos, actor: ActorSesionDTO) -> frozenset[str]:
    """Códigos o patrones efectivos concedidos al actor."""
    politica = resolver_politica_actor(repo, actor)
    return politica.allow


def tiene_permiso(
    repo: RepoPermisos, actor: ActorSesionDTO, codigo: str
) -> bool:
    """Evalúa si el actor tiene concedido el código de permiso según el motor IAM (AWS)."""
    politica = resolver_politica_actor(repo, actor)
    return evaluar_permiso(politica, codigo)

