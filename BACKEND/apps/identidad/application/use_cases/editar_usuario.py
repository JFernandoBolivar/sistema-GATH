"""
Caso de uso `editar_usuario` (edición de rol).

Puro: recibe el puerto por inyección (B4/B21). D3: sin departamento. M2: sin
contraseña; ese cambio solo ocurre por «Restablecer acceso» o por el flujo de
cambio de contraseña propio.

La regla de dominio que impide que una persona se cambie su propio rol vive en
`domain/services/reglas_administracion.py` y se aplica en la capa de
aplicación/presentación con el actor de la petición, no aquí (este caso de uso
solo conoce el objetivo).
"""
from apps.identidad.application.dtos.cuenta_dto import ActualizarCuentaDTO
from apps.identidad.domain.entities.cuenta import Cuenta
from apps.identidad.domain.ports.repo_cuentas import RepoCuentas
from core.domain.exceptions import NotFoundError


def editar_usuario(repo: RepoCuentas, dto: ActualizarCuentaDTO) -> Cuenta:
    """Actualiza el rol de una cuenta existente."""
    cuenta = repo.obtener_por_id(dto.id)
    if cuenta is None:
        raise NotFoundError('El usuario no existe.')

    actualizada = cuenta.con_datos(
        rol_id=dto.rol_id if dto.tocar_rol else ...,
    )
    return repo.guardar(actualizada)
