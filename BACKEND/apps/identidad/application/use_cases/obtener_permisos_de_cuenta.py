"""
Caso de uso `obtener_permisos_de_cuenta` (B3.1).

Consulta de los códigos efectivos de una cuenta identificada por cédula.
La cuenta llega como primitiva (`cedula: str`) — nunca importando el modelo
legado USER (regla B16); la resolución cédula → rol → permisos ocurre dentro
del repositorio. Puro: puerto por inyección (B4/B21), sin Django.
"""
from apps.identidad.application.dtos.permisos_dto import PermisosEfectivosDTO
from apps.identidad.domain.ports.repo_permisos import RepoPermisos


def obtener_permisos_de_cuenta(
    repo: RepoPermisos, cedula: str
) -> PermisosEfectivosDTO:
    """
    Resuelve los códigos efectivos de la cuenta con la cédula indicada.

    Cuenta inexistente o sin rol devuelven un conjunto vacío (denegación por
    defecto, S2): no se distingue en la respuesta para no revelar si la cuenta
    existe.
    """
    rol = repo.rol_de_cuenta(cedula)
    if rol is None:
        return PermisosEfectivosDTO(cedula=cedula, rol_id=None, codigos=frozenset())
    return PermisosEfectivosDTO(
        cedula=cedula, rol_id=rol.identificador, codigos=rol.codigos()
    )
