/**
 * Mapper para convertir datos de Configuración Visual a entidad de dominio.
 */
import type { ConfiguracionVisual, VersionImagenCintillo } from "../../domain/entities/configuracion-visual";
import type { ConfiguracionVisualApiItem, VersionImagenCintilloApiItem } from "../http/configuracion-api";

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

export function versionImagenApiAEntidad(raw: VersionImagenCintilloApiItem): VersionImagenCintillo {
  return {
    id: raw.id,
    campo: raw.campo,
    mime: raw.mime,
    tamano: raw.tamano,
    subidoEn: raw.subido_en,
    subidoPorCedula: raw.subido_por_cedula,
    subidoPorNombre: raw.subido_por_nombre,
    esVigente: raw.es_vigente,
    url: raw.url,
  };
}
