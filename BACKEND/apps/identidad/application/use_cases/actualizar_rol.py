"""
Caso de uso `actualizar_rol` (edición en el catálogo, cierra parte de CRIT-12).

Puro: recibe el puerto por inyección (B4/B21).
"""
from apps.identidad.application.use_cases.crear_rol import normalizar_nombre_rol
from apps.identidad.application.dtos.rol_dto import ActualizarRolDTO
from apps.identidad.domain.entities.rol import Rol
from apps.identidad.domain.ports.repo_roles import RepoRoles
from core.domain.exceptions import ConflictError, NotFoundError, ValidationError


def actualizar_rol(repo: RepoRoles, dto: ActualizarRolDTO) -> Rol:
    """Actualiza nombre y/o descripción de un rol existente."""
    actual = repo.obtener_por_id(dto.id)
    if actual is None:
        raise NotFoundError('El rol no existe.')

    nombre_normalizado = None
    if dto.nombre is not None:
        nombre_normalizado = normalizar_nombre_rol(dto.nombre)
        if not nombre_normalizado:
            raise ValidationError('El nombre del rol es obligatorio.')
        if len(nombre_normalizado) > 50:
            raise ValidationError('El nombre no puede exceder 50 caracteres.')
        if repo.existe_nombre(nombre_normalizado, excluir_id=dto.id):
            raise ConflictError(f"Ya existe un rol llamado '{nombre_normalizado}'.")

    return repo.actualizar(dto.id, nombre=nombre_normalizado, descripcion=dto.descripcion)
