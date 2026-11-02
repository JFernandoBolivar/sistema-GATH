"""
Caso de uso `obtener_permisos_de_cuenta` (B3.1).

Consulta de los códigos efectivos de una cuenta identificada por cédula.
La cuenta llega como primitiva (`cedula: str`) — nunca importando el modelo
legado USER (regla B16); la resolución cédula → rol → permisos ocurre dentro
del repositorio. Puro: puerto por inyección (B4/B21), sin Django.

D4: el resultado combina rol + overrides allow/deny y aplica el motor IAM, de
modo que un deny explícito nunca aparece como permiso efectivo (ni en
`/auth/me`, ni en el detalle, ni en la sesión del frontend).
"""
from apps.identidad.application.dtos.permisos_dto import PermisosEfectivosDTO
from apps.identidad.domain.ports.repo_permisos import RepoPermisos
from apps.identidad.domain.services.evaluador_permisos import evaluar_permiso


def obtener_permisos_de_cuenta(
    repo: RepoPermisos, cedula: str
) -> PermisosEfectivosDTO:
    """
    Resuelve los códigos efectivos de la cuenta con la cédula indicada.

    Cuenta inexistente o sin rol devuelven un conjunto vacío (denegación por
    defecto, S2): no se distingue en la respuesta para no revelar si la cuenta
    existe.
    """
    usuario = repo.obtener_permisos_usuario(cedula)
    if usuario is not None:
        politica = usuario.politica_efectiva
        # B2: se expanden los comodines a los códigos concretos del catálogo y
        # se descartan los denegados, para que la sesión no lleve patrones que
        # el frontend no pueda cruzar con un deny concreto.
        catalogo = repo.listar()
        return PermisosEfectivosDTO(
            cedula=cedula,
            rol_id=usuario.rol_id,
            codigos=frozenset(
                permiso.codigo.valor
                for permiso in catalogo
                if evaluar_permiso(politica, permiso.codigo.valor)
            ),
        )

    rol = repo.rol_de_cuenta(cedula)
    if rol is None:
        return PermisosEfectivosDTO(cedula=cedula, rol_id=None, codigos=frozenset())
    return PermisosEfectivosDTO(
        cedula=cedula, rol_id=rol.identificador, codigos=rol.codigos()
    )
