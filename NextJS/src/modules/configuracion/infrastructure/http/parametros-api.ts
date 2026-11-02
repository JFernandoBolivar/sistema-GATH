/**
 * Cliente HTTP de parámetros del sistema (D9), sobre /api/v1/configuracion/parametros/.
 */
import { apiClient } from "@/shared/infrastructure/http/fetcher-api";
import type { ApiResponse } from "@/shared/types/api-response";

export interface ParametroApiItem {
  clave: string;
  etiqueta: string;
  descripcion: string;
  grupo: string;
  tipo: "booleano" | "entero" | "texto";
  valor: string;
  defecto: string;
  minimo: number | null;
  maximo: number | null;
  actualizado_por_id: number | null;
  actualizado_en: string | null;
}

export interface CambioParametroApiItem {
  fecha: string;
  actor_cedula: string;
  valor_previo: string;
  valor_nuevo: string;
  resultado: string;
}

export interface PaginaCambiosApi {
  resultados: CambioParametroApiItem[];
  total: number;
  pagina: number;
  tamano: number;
  total_paginas: number;
}

export const parametrosApi = {
  listar: () =>
    apiClient.get<ApiResponse<ParametroApiItem[]>>("/api/v1/configuracion/parametros/"),

  actualizar: (clave: string, valor: string) =>
    apiClient.put<ApiResponse<ParametroApiItem>>(
      `/api/v1/configuracion/parametros/${encodeURIComponent(clave)}/`,
      { valor },
    ),

  historial: (clave: string, pagina: number, tamano: number) =>
    apiClient.get<ApiResponse<PaginaCambiosApi>>(
      `/api/v1/configuracion/parametros/${encodeURIComponent(clave)}/historial/`,
      { params: { pagina, page_size: tamano } },
    ),

  diasRecordatorioFeDeVida: () =>
    apiClient.get<ApiResponse<{ dias: number[] }>>(
      "/api/v1/configuracion/parametros/recordatorios-fe-de-vida/",
    ),
};
