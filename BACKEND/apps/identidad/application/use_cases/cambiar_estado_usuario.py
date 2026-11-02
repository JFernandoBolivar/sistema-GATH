"""
Caso de uso `cambiar_estado_usuario` (activar/desactivar cuenta).

Puro: recibe el puerto por inyección (B4/B21).
"""
from apps.identidad.application.dtos.cuenta_dto import CambiarEstadoCuentaDTO
from apps.identidad.domain.entities.cuenta import Cuenta
from apps.identidad.domain.ports.repo_cuentas import RepoCuentas
from core.domain.exceptions import NotFoundError


def cambiar_estado_usuario(repo: RepoCuentas, dto: CambiarEstadoCuentaDTO) -> Cuenta:
    """Activa, desactiva o alterna (`is_active=None`) el estado de una cuenta."""
    cuenta = repo.obtener_por_id(dto.id)
    if cuenta is None:
        raise NotFoundError('El usuario no existe.')

    nuevo_estado = dto.is_active if dto.is_active is not None else not cuenta.is_active
    return repo.guardar(cuenta.con_estado(nuevo_estado))
