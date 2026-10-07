/**
 * Mapper para convertir datos de Configuración Visual a entidad de dominio.
 */
import type { ConfiguracionVisual } from "../../domain/entities/configuracion-visual";
import type { ConfiguracionVisualApiItem } from "../http/configuracion-api";

export function configuracionVisualApiAEntidad(raw: ConfiguracionVisualApiItem): ConfiguracionVisual {
  return {
    id: raw.id,
    tipoCintillo: raw.tipo_cintillo,
    nombreEmpresa: raw.nombre_empresa,
    logoPrincipalClave: raw.logo_principal_clave,
    logoPrincipalUrl: raw.logo_principal_url ?? null,
    logoSecundarioClave: raw.logo_secundario_clave,
    logoSecundarioUrl: raw.logo_secundario_url ?? null,
    cintilloPieClave: raw.cintillo_pie_clave,
    cintilloPieUrl: raw.cintillo_pie_url ?? null,
    colorFondo: raw.color_fondo,
    actualizadoPorId: raw.actualizado_por_id,
    actualizadoEn: raw.actualizado_en,
  };
}
