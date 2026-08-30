/**
 * Cliente HTTP para Reportes conectado a las APIs canónicas /api/v1/reportes/
 */
import { apiClient } from "@/shared/infrastructure/http/fetcher-api";
import type { TipoReportePersonal } from "../../domain/value-objects/tipo-reporte-vo";

/**
 * Rutas canónicas de descarga del backend (verificadas en
 * `BACKEND/apps/reportes/presentation/urls.py`): cada reporte resuelve su
 * variante /pdf/ y /excel/ según el tipo.
 */
const RUTA_PDF_REPORTE: Record<TipoReportePersonal, string> = {
  "personal-activo": "/api/v1/reportes/personal-activo/pdf/",
  "personal-pasivo": "/api/v1/reportes/pasivos/pdf/",
  vacantes: "/api/v1/reportes/cargos-vacantes/pdf/",
};

const RUTA_EXCEL_REPORTE: Record<TipoReportePersonal, string> = {
  "personal-activo": "/api/v1/reportes/personal-activo/excel/",
  "personal-pasivo": "/api/v1/reportes/pasivos/excel/",
  vacantes: "/api/v1/reportes/cargos-vacantes/excel/",
};

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

  getPdf: (tipo: TipoReportePersonal) => apiClient.getBlob(RUTA_PDF_REPORTE[tipo]),

  getExcel: (tipo: TipoReportePersonal) => apiClient.getBlob(RUTA_EXCEL_REPORTE[tipo]),
};
