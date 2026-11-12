/** Cliente HTTP del restablecimiento en bloque (U2), sobre /api/v1/identidad/usuarios/restablecer-acceso-bloque/. */
import { apiClient } from "@/shared/infrastructure/http/fetcher-api";
import type { ApiResponse } from "@/shared/types/api-response";

const BASE = "/api/v1/identidad/usuarios/restablecer-acceso-bloque/";

export interface SolicitudBloqueApi {
  clasificacion: string;
  alcance: string;
  enviar_correo: boolean;
  motivo: string;
}

export interface MuestraBloqueApi {
  cuenta_id: number;
  cedula: string;
  nombre: string;
  condicion: string;
  vence_en: string | null;
}

export interface VistaPreviaBloqueApi {
  total: number;
  activos: number;
  pasivos: number;
  omitidas_administrativas: number;
  revisadas: number;
  muestra: MuestraBloqueApi[];
  vence_en_nuevo: string | null;
}

export interface ResultadoBloqueApi {
  revisadas?: number;
  restablecidas?: number;
  omitidas_administrativas?: number;
  omitidas?: number;
  errores?: number;
  vence_en_nuevo?: string | null;
}

export interface EstadoBloqueApi {
  task_id?: string;
  estado: string;
  resultado?: ResultadoBloqueApi | null;
  mensaje?: string;
}

export const restablecimientoBloqueApi = {
  vistaPrevia: (cuerpo: SolicitudBloqueApi) =>
    apiClient.post<ApiResponse<VistaPreviaBloqueApi>>(
      `${BASE}preview/`,
      cuerpo as unknown as Record<string, unknown>,
    ),

  ejecutar: (cuerpo: SolicitudBloqueApi & { confirmacion: number }) =>
    apiClient.post<ApiResponse<EstadoBloqueApi>>(BASE, cuerpo as unknown as Record<string, unknown>),

  estado: (taskId: string) =>
    apiClient.get<ApiResponse<EstadoBloqueApi>>(`${BASE}${encodeURIComponent(taskId)}/`),

  excel: (clasificacion: string, alcance: string) =>
    apiClient.getBlob(
      `${BASE}preview/excel/?clasificacion=${encodeURIComponent(clasificacion)}&alcance=${encodeURIComponent(alcance)}`,
    ),
};
