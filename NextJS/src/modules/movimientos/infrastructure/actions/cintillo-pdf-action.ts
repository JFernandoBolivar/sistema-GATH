"use server";

/**
 * Lectura de solo lectura de la Configuración Visual del cintillo (HU 0009)
 * para alimentar el PDF de este módulo (@react-pdf/renderer). Se duplica en
 * cada módulo consumidor (no se importa `modules/configuracion`) para
 * respetar el aislamiento Feature-Based — mismo criterio que
 * `catalogo-familiar-select.tsx`. Leniente: si la petición falla, devuelve
 * `null` y el PDF cae a sus imágenes estáticas de respaldo.
 */
import { apiClient } from "@/shared/infrastructure/http/fetcher-api";
import type { ApiResponse } from "@/shared/types/api-response";

export interface CintilloConfigPdf {
  tipoCintillo: "GENERICO" | "FIJO";
  logoPrincipalUrl: string | null;
  logoSecundarioUrl: string | null;
  cintilloPieUrl: string | null;
}

interface ConfiguracionVisualApiItem {
  tipo_cintillo: "GENERICO" | "FIJO";
  logo_principal_url?: string | null;
  logo_secundario_url?: string | null;
  cintillo_pie_url?: string | null;
}

export async function getCintilloConfigPdfAction(): Promise<CintilloConfigPdf | null> {
  try {
    const envelope = await apiClient.get<ApiResponse<ConfiguracionVisualApiItem>>("/api/v1/configuracion/visual/");
    return {
      tipoCintillo: envelope.data.tipo_cintillo,
      logoPrincipalUrl: envelope.data.logo_principal_url ?? null,
      logoSecundarioUrl: envelope.data.logo_secundario_url ?? null,
      cintilloPieUrl: envelope.data.cintillo_pie_url ?? null,
    };
  } catch {
    return null;
  }
}
