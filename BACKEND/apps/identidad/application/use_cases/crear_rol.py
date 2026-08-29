"""
Caso de uso `crear_rol` (alta en el catálogo, cierra parte de CRIT-12).

Normaliza el nombre igual que el legado (`RolEscrituraSerializer`, mayúsculas
sin espacios repetidos) y valida unicidad insensible a mayúsculas — pero como
regla de negocio en `application/`, no dentro del serializer (B8). Puro:
recibe el puerto por inyección (B4/B21).
"""
from apps.identidad.application.dtos.rol_dto import CrearRolDTO
from apps.identidad.domain.entities.rol import Rol
from apps.identidad.domain.ports.repo_roles import RepoRoles
from core.domain.exceptions import ConflictError, ValidationError


def normalizar_nombre_rol(nombre: str) -> str:
    """Mayúsculas y sin espacios repetidos (mismo criterio que el legado)."""
    return ' '.join(str(nombre or '').strip().upper().split())


def crear_rol(repo: RepoRoles, dto: CrearRolDTO) -> Rol:
    """Da de alta un rol nuevo. Rechaza nombres vacíos o ya existentes."""
    nombre = normalizar_nombre_rol(dto.nombre)
    if not nombre:
        raise ValidationError('El nombre del rol es obligatorio.')
    if len(nombre) > 50:
        raise ValidationError('El nombre no puede exceder 50 caracteres.')
    if repo.existe_nombre(nombre):
        raise ConflictError(f"Ya existe un rol llamado '{nombre}'.")

    return repo.crear(nombre=nombre, descripcion=dto.descripcion or '')
