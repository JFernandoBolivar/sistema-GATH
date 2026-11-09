"""
Caso de uso `registrar_usuario` (alta de cuenta, CRIT-05).

Puro: recibe los puertos por inyección (B4/B21). D3: sin departamento.
"""
from typing import Callable

from apps.identidad.application.dtos.cuenta_dto import RegistrarCuentaDTO
from apps.identidad.domain.entities.cuenta import Cuenta
from apps.identidad.domain.ports.repo_cuentas import RepoCuentas
from core.domain.exceptions import ConflictError


def registrar_usuario(
    repo: RepoCuentas,
    dto: RegistrarCuentaDTO,
    validar_fortaleza: Callable[[str], None] | None = None,
) -> Cuenta:
    """Da de alta la cuenta de una cédula que aún no tiene acceso."""
    if repo.existe_cuenta_para_cedula(dto.cedula):
        raise ConflictError('La cédula ya tiene una cuenta de acceso.', campo='cedula')

    if validar_fortaleza is not None:
        validar_fortaleza(dto.password)

    return repo.crear(dto.cedula, dto.password, dto.rol_id)
