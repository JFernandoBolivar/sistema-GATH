"""
Caso de uso `crear_rol` (alta en el catálogo, cierra parte de CRIT-12; O43).

El usuario escribe el nombre visible; el sistema genera UNA sola vez el código
interno (`nombre_rol`): mayúsculas, sin acentos, con guion bajo y único. Ese
código no vuelve a cambiar. Puro: recibe el puerto por inyección (B4/B21).
"""
import re
import unicodedata

from apps.identidad.application.dtos.rol_dto import CrearRolDTO
from apps.identidad.domain.entities.rol import Rol
from apps.identidad.domain.ports.repo_roles import RepoRoles
from core.domain.exceptions import ConflictError, ValidationError

MAX_CODIGO = 50
MAX_NOMBRE_VISIBLE = 100


def normalizar_nombre_visible(nombre: str) -> str:
    """Quita espacios sobrantes; conserva mayúsculas, acentos y ñ tal cual."""
    return ' '.join(str(nombre or '').strip().split())


def generar_codigo_rol(nombre_visible: str) -> str:
    """«Analista de Bienestar» -> `ANALISTA_DE_BIENESTAR` (sin acentos, A-Z0-9_)."""
    descompuesto = unicodedata.normalize('NFKD', str(nombre_visible or ''))
    sin_acentos = ''.join(c for c in descompuesto if not unicodedata.combining(c))
    codigo = re.sub(r'[^A-Za-z0-9]+', '_', sin_acentos).strip('_').upper()
    return codigo[:MAX_CODIGO].strip('_')


def _codigo_unico(repo: RepoRoles, base: str) -> str:
    candidato = base
    contador = 2
    while repo.existe_nombre(candidato):
        sufijo = f'_{contador}'
        candidato = f'{base[:MAX_CODIGO - len(sufijo)]}{sufijo}'
        contador += 1
    return candidato


def crear_rol(repo: RepoRoles, dto: CrearRolDTO) -> Rol:
    """Da de alta un rol nuevo. Rechaza nombres vacíos o ya existentes."""
    nombre_visible = normalizar_nombre_visible(dto.nombre_visible)
    if not nombre_visible:
        raise ValidationError('El nombre del rol es obligatorio.')
    if len(nombre_visible) > MAX_NOMBRE_VISIBLE:
        raise ValidationError(f'El nombre no puede exceder {MAX_NOMBRE_VISIBLE} caracteres.')
    codigo_base = generar_codigo_rol(nombre_visible)
    if not codigo_base:
        raise ValidationError('El nombre del rol debe contener letras o números.')
    if repo.existe_nombre_visible(nombre_visible):
        raise ConflictError(f"Ya existe un rol llamado '{nombre_visible}'.")

    return repo.crear(
        codigo=_codigo_unico(repo, codigo_base),
        nombre_visible=nombre_visible,
        descripcion=dto.descripcion or '',
    )
