"""
Helper reutilizable para que otros módulos armen el `config` que consumen
`core/infrastructure/pdf/pdf_components.py` / `report_pdf.py` (HU 0009).

Vive en `apps.configuracion` (dueña del concepto) y lo importan otros
módulos de negocio (`apps.reportes`, `apps.puntocuenta`) directamente —
mismo patrón ya establecido para catálogos de referencia
(`apps.organizacion`/`apps.catalogos` importados por `apps.cargos`), no
viola B16 porque `core/` nunca importa de aquí.

Leniente por diseño: si SeaweedFS no está disponible para descargar una
imagen puntual, esa imagen queda en `None` en el dict resultante y
`pdf_components.py` cae de vuelta al asset hardcodeado correspondiente —
nunca se bloquea la generación de un reporte por una imagen que no se pudo
descargar.
"""
import logging

from core.domain.exceptions import AlmacenamientoNoDisponible
from core.infrastructure.storage.seaweedfs_storage import SeaweedFSStorage

from apps.configuracion.application.use_cases.obtener_configuracion_visual import obtener_configuracion_visual
from apps.configuracion.infrastructure.repositories.repo_configuracion_visual_orm import RepoConfiguracionVisualORM

logger = logging.getLogger('gath.configuracion')


def _descargar_o_none(clave: str | None) -> bytes | None:
    if not clave:
        return None
    try:
        return SeaweedFSStorage().descargar(clave)
    except AlmacenamientoNoDisponible:
        logger.warning("No fue posible descargar la imagen %s del cintillo (almacenamiento no disponible).", clave)
        return None


def construir_config_pdf() -> dict:
    """Dict plano de primitivas listo para pasar como `config=` a
    `create_header()`/`draw_footer()`/`generar_reporte_pdf()`."""
    dto = obtener_configuracion_visual(RepoConfiguracionVisualORM())

    if dto.tipo_cintillo == 'GENERICO':
        return {'tipo_cintillo': 'GENERICO'}

    return {
        'tipo_cintillo': 'FIJO',
        'nombre_empresa': dto.nombre_empresa,
        'logo_principal_bytes': _descargar_o_none(dto.logo_principal_clave),
        'logo_secundario_bytes': _descargar_o_none(dto.logo_secundario_clave),
        'cintillo_pie_bytes': _descargar_o_none(dto.cintillo_pie_clave),
    }
