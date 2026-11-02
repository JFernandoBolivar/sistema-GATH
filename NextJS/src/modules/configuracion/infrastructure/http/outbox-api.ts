/** Cliente HTTP del correo saliente (E3). */
import { apiClient } from "@/shared/infrastructure/http/fetcher-api";
import type { ApiResponse } from "@/shared/types/api-response";

export interface OutboxFallidoApi {
  id: string;
  tipo: string;
  destinatario: string;
  intentos: number;
  error: string;
  creado_en: string;
}

export interface OutboxFallidosApi {
  total: number;
  ultimos: OutboxFallidoApi[];
}

export const outboxApi = {
  fallidos: () =>
    apiClient.get<ApiResponse<OutboxFallidosApi>>(
      "/api/v1/notificaciones/outbox/fallidos/",
    ),
};
