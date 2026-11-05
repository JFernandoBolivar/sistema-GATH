"""
Caso de uso para registrar nuevos parentescos (Regla A4).
"""
from core.domain.exceptions import ValidationError
from apps.catalogos.application.dtos.catalogos_dtos import CatalogoItemDTO
from apps.catalogos.domain.ports.repo_catalogos import RepoCatalogos


def crear_parentesco(
    repo: RepoCatalogos, descripcion: str, uso: str = 'contacto'
) -> CatalogoItemDTO:
    desc = (descripcion or '').strip()
    if len(desc) < 2 or len(desc) > 60:
        raise ValidationError(
            'La descripción del parentesco debe tener entre 2 y 60 caracteres.',
            campo='descripcion',
        )
    if uso != 'contacto':
        raise ValidationError(
            "El uso indicado debe ser 'contacto'.",
            campo='uso',
        )
    if repo.existe_parentesco(desc):
        raise ValidationError(
            'Ya existe un parentesco con esa descripción.',
            campo='descripcion',
        )
    entidad = repo.crear_parentesco(descripcion=desc, aplica_familiar=False)
    return CatalogoItemDTO(
        id=entidad.id,
        nombre=entidad.nombre,
        codigo=entidad.codigo,
        extra=entidad.extra,
    )
