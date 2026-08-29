"""
Caso de uso `editar_usuario` (edición de departamento/rol/contraseña).

Puro: recibe el puerto por inyección (B4/B21).
"""
from apps.identidad.application.dtos.cuenta_dto import ActualizarCuentaDTO
from apps.identidad.domain.entities.cuenta import Cuenta
from apps.identidad.domain.ports.repo_cuentas import RepoCuentas
from core.domain.exceptions import NotFoundError


def editar_usuario(repo: RepoCuentas, dto: ActualizarCuentaDTO) -> Cuenta:
    """Actualiza departamento y/o rol de una cuenta existente."""
    cuenta = repo.obtener_por_id(dto.id)
    if cuenta is None:
        raise NotFoundError('El usuario no existe.')

    actualizada = cuenta.con_datos(
        departamento_id=dto.departamento_id if dto.tocar_departamento else ...,
        rol_id=dto.rol_id if dto.tocar_rol else ...,
    )
    guardada = repo.guardar(actualizada)

    if dto.password:
        repo.establecer_password(dto.id, dto.password)

    return guardada
