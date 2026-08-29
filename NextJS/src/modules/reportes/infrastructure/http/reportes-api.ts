/**
 * Cliente HTTP para Reportes conectado a las APIs canónicas /api/v1/reportes/
 */
import { apiClient } from "@/shared/infrastructure/http/fetcher-api";

export interface ReportePersonalApiItem {
  cedula: string;
  nombre_completo: string;
  dependencia: string;
  cargo: string;
  tipo_personal: string;
  fecha_ingreso: string;
  total_anos_apn: number;
}

export interface ReportePasivoApiItem {
  cedula: string;
  nombre_completo: string;
  tipo_personal: string;
  fecha_egreso: string;
  motivo_egreso: string;
}

export interface ReporteVacanteApiItem {
  id: number;
  codigo_nomina: string | null;
  denominacion_cargo: string;
  dependencia: string;
  direccion_general: string;
}

export const reportesApi = {
  getReportePersonal: (filtros?: any) =>
    apiClient.get<ReportePersonalApiItem[]>("/api/v1/reportes/personal/", { params: filtros }),

  getReportePasivos: (filtros?: any) =>
    apiClient.get<ReportePasivoApiItem[]>("/api/v1/reportes/pasivos/", { params: filtros }),

  getReporteVacantes: (filtros?: any) =>
    apiClient.get<ReporteVacanteApiItem[]>("/api/v1/reportes/vacantes/", { params: filtros }),
};
