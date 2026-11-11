"""Generación del código de asignación para cargos pasivos (compartido)."""
from apps.cargos.domain.services.generacion_codigo import (
    generar_prefijo_nomina,
    siguiente_codigo_especial,
)
from apps.cargos.infrastructure.models.cargo_models import AsigTrabajoModel
from apps.catalogos.infrastructure.models.catalogo_models import TipoNominaModel
from core.domain.exceptions import ConflictError


def generar_codigo_pasivo(tipo_nomina: TipoNominaModel) -> str:
    try:
        prefijo = generar_prefijo_nomina(tipo_nomina.nomina)
    except ValueError as exc:
        # L2-15: un nombre de nómina vacío producía un 500 al generar el prefijo.
        raise ConflictError(
            f'No se puede generar el código del pasivo: {exc}'
        ) from exc
    ultimo = (
        AsigTrabajoModel.objects.filter(codigo__startswith=prefijo)
        .order_by('-codigo')
        .values_list('codigo', flat=True)
        .first()
    )
    codigo = siguiente_codigo_especial(prefijo, ultimo)
    if AsigTrabajoModel.objects.filter(codigo=codigo).exists():
        raise ConflictError(f"El código generado {codigo} ya está en uso.")
    return codigo
