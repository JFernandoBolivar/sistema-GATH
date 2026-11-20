"""Vista previa de una plantilla con el MISMO motor PDF que emite (seguimiento B-1).

El diseñador dibuja en el navegador con Konva; esto muestra cómo saldrá de verdad, con las
dos caras, incluso para un borrador o para cambios todavía sin guardar.
"""
from typing import Any

from apps.carnetizacion.domain.ports.repo_carnetizacion import RepoCarnetizacion
from core.domain.exceptions import ValidationError


def vista_previa_plantilla_uc(
    repo: RepoCarnetizacion, plantilla_id: str, definicion: Any = None, cedula: Any = None,
) -> dict:
    if definicion is not None and not isinstance(definicion, dict):
        raise ValidationError('La definición de la plantilla no es válida.', campo='definicion')
    cedula_limpia = str(cedula).strip() if cedula else None
    return repo.vista_previa_plantilla(plantilla_id, definicion=definicion, cedula=cedula_limpia or None)
