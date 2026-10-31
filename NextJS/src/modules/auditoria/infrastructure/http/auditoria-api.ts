/** Cliente HTTP de la bitácora de auditoría (D10). */
import { apiClient } from "@/shared/infrastructure/http/fetcher-api";
import type { ApiResponse } from "@/shared/types/api-response";
import type { FiltrosAuditoria } from "../../application/dtos/auditoria-dto";

export interface RegistroAuditoriaApiItem {
  id: string;
  fecha_hora: string;
  actor_cedula: string;
  actor_nombre: string;
  actor_rol: string;
  modulo: string;
  accion: string;
  recurso_tipo: string;
  recurso_id: string;
  ip: string;
  user_agent: string;
  resultado: string;
}

export interface DiferenciaAuditoriaApiItem {
  campo: string;
  antes: unknown;
  despues: unknown;
}

export interface DetalleAuditoriaApiItem extends RegistroAuditoriaApiItem {
  estado_previo: Record<string, unknown> | null;
  estado_nuevo: Record<string, unknown> | null;
  diferencias: DiferenciaAuditoriaApiItem[];
}

export interface IncidenteSeguridadApiItem {
  id: string;
  fecha_hora: string;
  cedula: string;
  nombre: string;
  ip: string;
  resultado: string;
}

export interface PaginaAuditoriaApi {
  resultados: RegistroAuditoriaApiItem[];
  total: number;
  pagina: number;
  tamano: number;
  total_paginas: number;
}

export interface PaginaIncidentesApi {
  resultados: IncidenteSeguridadApiItem[];
  total: number;
  pagina: number;
  tamano: number;
  total_paginas: number;
}

export interface OpcionesAuditoriaApi {
  acciones: string[];
  modulos: string[];
  resultados: string[];
}

export function filtrosAQuery(filtros: FiltrosAuditoria): Record<string, string | number> {
  const params: Record<string, string | number> = {};
  for (const [clave, valor] of Object.entries(filtros)) {
    if (valor !== undefined && valor !== null && String(valor).trim() !== "") {
      params[clave] = String(valor).trim();
    }
  }
  return params;
}

export const auditoriaApi = {
  listar: (filtros: FiltrosAuditoria, pagina: number, tamano: number) =>
    apiClient.get<ApiResponse<PaginaAuditoriaApi>>("/api/v1/auditoria/", {
      params: { ...filtrosAQuery(filtros), pagina, page_size: tamano },
    }),

  detalle: (id: string) =>
    apiClient.get<ApiResponse<DetalleAuditoriaApiItem>>(`/api/v1/auditoria/${id}/`),

  opciones: () => apiClient.get<ApiResponse<OpcionesAuditoriaApi>>("/api/v1/auditoria/opciones/"),

  incidentes: (filtros: FiltrosAuditoria, pagina: number, tamano: number) =>
    apiClient.get<ApiResponse<PaginaIncidentesApi>>("/api/v1/auditoria/incidentes/", {
      params: { ...filtrosAQuery(filtros), pagina, page_size: tamano },
    }),
};
