/**
 * Cliente HTTP de notificaciones: `/api/v1/notificaciones/` (permiso `notificaciones.ver_propias`).
 * Respuestas en el sobre C-1 `{status, message, data}`. La cédula sale de la sesión, nunca de la URL.
 */
import { apiClient } from "@/shared/infrastructure/http/fetcher-api";
import { queryParams } from "@/shared/infrastructure/http/query-params";
import type { FiltrosNotificaciones } from "../../domain/ports/repo-notificaciones";
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
  modulo?: string;
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
  listar: (filtros: FiltrosNotificaciones) =>
    apiClient.get<ApiResponse<PaginaNotificacionesApi>>(
      `${BASE}/${queryParams({
        modulo: filtros.modulo,
        leida: filtros.leida === undefined ? undefined : filtros.leida ? "si" : "no",
        q: filtros.q?.trim(),
        tipo: filtros.tipo,
        desde: filtros.desde,
        hasta: filtros.hasta,
        limit: filtros.limite,
        offset: filtros.desplazamiento,
      })}`,
    ),
  contar: (modulo: string) =>
    apiClient.get<ApiResponse<{ no_leidas: number }>>(`${BASE}/conteo/${queryParams({ modulo })}`),
  marcarLeida: (id: string) =>
    apiClient.post<ApiResponse<{ id: string; leida: boolean }>>(`${BASE}/${id}/leer/`),
  marcarTodasLeidas: (modulo: string) =>
    apiClient.post<ApiResponse<{ marcadas: number }>>(
      `${BASE}/leer-todas/${queryParams({ modulo })}`,
    ),
};
