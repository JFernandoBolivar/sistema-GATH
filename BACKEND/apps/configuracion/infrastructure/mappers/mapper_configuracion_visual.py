"""Mapper ORM <-> Entidad de Configuración Visual."""
from apps.configuracion.domain.entities.configuracion_visual import ConfiguracionVisual


def a_entidad(modelo) -> ConfiguracionVisual:
    return ConfiguracionVisual(
        id=modelo.pk,
        tipo_cintillo=modelo.tipo_cintillo,
        nombre_empresa=modelo.nombre_empresa,
        logo_principal_clave=modelo.logo_principal_clave,
        logo_secundario_clave=modelo.logo_secundario_clave,
        cintillo_pie_clave=modelo.cintillo_pie_clave,
        color_fondo=modelo.color_fondo,
        actualizado_por_id=modelo.actualizado_por_id,
        actualizado_en=modelo.updated_at.isoformat() if modelo.updated_at else None,
    )
