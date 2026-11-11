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

export interface VistaPreviaBloqueApi {
  revisadas: number;
  activos: number;
  pasivos: number;
  total: number;
  omitidas_administrativas: number;
  restablecidas?: number;
  errores?: number;
}

export interface EstadoBloqueApi {
  task_id: string;
  estado: string;
  resultado?: (Partial<VistaPreviaBloqueApi> & { omitidas?: number }) | null;
  mensaje?: string;
}

export const restablecimientoBloqueApi = {
  vistaPrevia: (cuerpo: SolicitudBloqueApi) =>
    apiClient.post<ApiResponse<EstadoBloqueApi>>(
      `${BASE}preview/`,
      cuerpo as unknown as Record<string, unknown>,
    ),

  ejecutar: (cuerpo: SolicitudBloqueApi & { confirmacion: number }) =>
    apiClient.post<ApiResponse<EstadoBloqueApi>>(BASE, cuerpo as unknown as Record<string, unknown>),

  estado: (taskId: string) =>
    apiClient.get<ApiResponse<EstadoBloqueApi>>(`${BASE}${encodeURIComponent(taskId)}/`),
};
