"""
Caso de uso `actualizar_rol` (edición en el catálogo, cierra parte de CRIT-12; O43).

Solo se editan el nombre visible y la descripción. El código interno
(`nombre_rol`) es inmutable: un intento de cambiarlo se rechaza. Puro: recibe
el puerto por inyección (B4/B21).
"""
from apps.identidad.application.dtos.rol_dto import ActualizarRolDTO
from apps.identidad.application.use_cases.crear_rol import (
    MAX_NOMBRE_VISIBLE,
    normalizar_nombre_visible,
)
from apps.identidad.domain.entities.rol import Rol
from apps.identidad.domain.ports.repo_roles import RepoRoles
from core.domain.exceptions import ConflictError, NotFoundError, ValidationError


def actualizar_rol(repo: RepoRoles, dto: ActualizarRolDTO) -> Rol:
    """Actualiza nombre visible y/o descripción de un rol existente."""
    actual = repo.obtener_por_id(dto.id)
    if actual is None:
        raise NotFoundError('El rol no existe.')

    if dto.codigo is not None and dto.codigo.strip().upper() != actual.nombre.strip().upper():
        raise ValidationError(
            'El código interno del rol no se puede modificar; edite el nombre visible.'
        )

    nombre_visible = None
    if dto.nombre_visible is not None:
        nombre_visible = normalizar_nombre_visible(dto.nombre_visible)
        if not nombre_visible:
            raise ValidationError('El nombre del rol es obligatorio.')
        if len(nombre_visible) > MAX_NOMBRE_VISIBLE:
            raise ValidationError(f'El nombre no puede exceder {MAX_NOMBRE_VISIBLE} caracteres.')
        if repo.existe_nombre_visible(nombre_visible, excluir_id=dto.id):
            raise ConflictError(f"Ya existe un rol llamado '{nombre_visible}'.")

    return repo.actualizar(dto.id, nombre_visible=nombre_visible, descripcion=dto.descripcion)
