/**
 * Cliente HTTP de Configuración Visual conectado a /api/v1/configuracion/
 */
import { apiClient } from "@/shared/infrastructure/http/fetcher-api";
import type { ApiResponse } from "@/shared/types/api-response";

export interface ConfiguracionVisualApiItem {
  id: number;
  tipo_cintillo: "GENERICO" | "FIJO";
  nombre_empresa: string | null;
  logo_principal_clave: string | null;
  logo_principal_url?: string | null;
  logo_secundario_clave: string | null;
  logo_secundario_url?: string | null;
  cintillo_pie_clave: string | null;
  cintillo_pie_url?: string | null;
  color_fondo: string | null;
  actualizado_por_id: number | null;
  actualizado_en: string | null;
}

const SLUG_POR_CAMPO = {
  logo_principal_clave: "logo-principal",
  logo_secundario_clave: "logo-secundario",
  cintillo_pie_clave: "cintillo-pie",
} as const;

export const configuracionApi = {
  obtener: () => apiClient.get<ApiResponse<ConfiguracionVisualApiItem>>("/api/v1/configuracion/visual/"),

  actualizar: (payload: Record<string, unknown>) =>
    apiClient.put<ApiResponse<ConfiguracionVisualApiItem>>("/api/v1/configuracion/visual/", payload),

  subirLogo: (campo: keyof typeof SLUG_POR_CAMPO, formData: FormData) =>
    apiClient.postForm<ApiResponse<ConfiguracionVisualApiItem>>(
      `/api/v1/configuracion/visual/logo/${SLUG_POR_CAMPO[campo]}/`,
      formData,
    ),
};
