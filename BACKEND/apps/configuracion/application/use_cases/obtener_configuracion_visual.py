"""Caso de uso: obtener la configuración visual activa (Reglas B2, B4)."""
from apps.configuracion.domain.ports.repo_configuracion_visual import RepoConfiguracionVisual
from ..dtos.configuracion_visual_dto import ConfiguracionVisualDTO


def _a_dto(entidad) -> ConfiguracionVisualDTO:
    return ConfiguracionVisualDTO(
        id=entidad.id,
        tipo_cintillo=entidad.tipo_cintillo,
        nombre_empresa=entidad.nombre_empresa,
        logo_principal_clave=entidad.logo_principal_clave,
        logo_secundario_clave=entidad.logo_secundario_clave,
        cintillo_pie_clave=entidad.cintillo_pie_clave,
        color_fondo=entidad.color_fondo,
        actualizado_por_id=entidad.actualizado_por_id,
        actualizado_en=entidad.actualizado_en,
    )


def obtener_configuracion_visual(repo: RepoConfiguracionVisual) -> ConfiguracionVisualDTO:
    return _a_dto(repo.obtener())
