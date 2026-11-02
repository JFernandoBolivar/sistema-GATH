"""Mapper ORM ↔ entidad de parámetros del sistema."""
from apps.configuracion.domain.entities.parametro import ParametroSistema
from apps.configuracion.infrastructure.models.parametro_model import ParametroSistemaModel


def parametro_a_entidad(modelo: ParametroSistemaModel) -> ParametroSistema:
    return ParametroSistema(
        clave=modelo.clave,
        etiqueta=modelo.etiqueta,
        descripcion=modelo.descripcion,
        grupo=modelo.grupo,
        tipo=modelo.tipo,
        valor=modelo.valor,
        defecto='',
        minimo=modelo.valor_min,
        maximo=modelo.valor_max,
        actualizado_por_id=modelo.actualizado_por_id,
        actualizado_en=modelo.updated_at.isoformat() if modelo.updated_at else None,
    )
