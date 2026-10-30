/**
 * Cliente HTTP para Movimientos conectado a las APIs canónicas /api/v1/movimientos/.
 *
 * Las descargas (PDF/Excel) viven en `movimientos-descargas-api`: se piden al
 * handler del mismo origen `/api/movimientos/{formato}`, que es quien conserva
 * la sesión y expone las cabeceras de truncado al navegador.
 */
import { apiClient } from "@/shared/infrastructure/http/fetcher-api";

export interface MovimientoApiItem {
  id: number;
  empleado_cedula: string;
  codigo_puesto: string;
  tipo_movimiento: string;
  motivo_id: number | null;
  motivo_nombre: string | null;
  denominacion_nombre: string;
  especifica_nombre: string;
  grado_nombre: string | null;
  tipo_nomina_nombre: string;
  estatus_nombre: string;
  tipo_personal_nombre: string | null;
  dependencia_nombre: string | null;
  direccion_general_nombre: string | null;
  direccion_linea_nombre: string | null;
  coordinacion_nombre: string | null;
  fecha_movimiento: string;
  ejecutado_por_id: number;
  ejecutado_por_nombre: string;
}

export interface PaginaMovimientosApi {
  resultados: MovimientoApiItem[];
  total: number;
  pagina: number;
  tamano: number;
  total_paginas: number;
}

export interface FiltrosMovimientosApi {
  cedula?: string;
  codigo_puesto?: string;
  categoria?: string;
  tipo_movimiento?: string;
  fecha_inicio?: string;
  fecha_fin?: string;
  gerencia?: string;
  estatus?: string;
}

export interface CatalogoTiposMovimientoApi {
  categorias: string[];
  motivos_por_categoria: Record<string, string[]>;
}

export const movimientosApi = {
  getHistorial: (filtros?: FiltrosMovimientosApi, pagina?: number, tamano?: number) =>
    apiClient.get<unknown>("/api/v1/movimientos/", {
      params: {
        ...(filtros as Record<string, string | number | boolean | undefined | null>),
        pagina,
        page_size: tamano,
      },
    }),

  getTiposDisponibles: () => apiClient.get<unknown>("/api/v1/movimientos/tipos/"),

  getHistorialPorEmpleado: (cedula: string) =>
    apiClient.get<unknown>(`/api/v1/movimientos/empleado/${cedula}/`),

  getHistorialPorCargo: (codigoPuesto: string) =>
    apiClient.get<unknown>(`/api/v1/movimientos/cargo/${codigoPuesto}/`),
};
