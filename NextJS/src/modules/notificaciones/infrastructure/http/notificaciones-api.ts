/**
 * Cliente HTTP de notificaciones: `/api/v1/notificaciones/` (permiso `notificaciones.ver_propias`).
 * Respuestas en el sobre C-1 `{status, message, data}`. La cédula sale de la sesión, nunca de la URL.
 */
import { apiClient } from "@/shared/infrastructure/http/fetcher-api";
import { queryParams } from "@/shared/infrastructure/http/query-params";
import type { ApiResponse } from "@/shared/types/api-response";

const BASE = "/api/v1/notificaciones";

export interface NotificacionApi {
  id: string;
  tipo: string;
  titulo: string;
  mensaje: string;
  enlace: string;
  ref_tipo: string;
  ref_id: string;
  leida: boolean;
  fecha_lectura: string | null;
  creada_en: string;
}

export interface PaginaNotificacionesApi {
  count: number;
  limit: number;
  offset: number;
  results: NotificacionApi[];
}

export const notificacionesApi = {
  listar: (filtros: { soloNoLeidas?: boolean; limite?: number; desplazamiento?: number }) =>
    apiClient.get<ApiResponse<PaginaNotificacionesApi>>(
      `${BASE}/${queryParams({
        no_leidas: filtros.soloNoLeidas ? "1" : undefined,
        limit: filtros.limite,
        offset: filtros.desplazamiento,
      })}`,
    ),
  contar: () => apiClient.get<ApiResponse<{ no_leidas: number }>>(`${BASE}/conteo/`),
  marcarLeida: (id: string) =>
    apiClient.post<ApiResponse<{ id: string; leida: boolean }>>(`${BASE}/${id}/leer/`),
  marcarTodasLeidas: () =>
    apiClient.post<ApiResponse<{ marcadas: number }>>(`${BASE}/leer-todas/`),
};
