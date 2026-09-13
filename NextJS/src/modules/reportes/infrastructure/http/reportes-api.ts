/**
 * Cliente HTTP para Reportes conectado a las APIs canónicas /api/v1/reportes/
 *
 * Las vistas de `apps.reportes` (backend) responden siempre con el sobre C-1
 * (`ok()` → `{status, message, data}`) y `data` es el objeto
 * `ResultadoReporte` (`{titulo, columnas, filas, total_registros,
 * metadatos}`), nunca un arreglo plano — bug corregido en esta tarea: las
 * llamadas de personal/pasivos/vacantes tipaban la respuesta como
 * `Item[]` directamente y nunca desenvolvían ni el sobre C-1 ni `.filas`, por
 * lo que el listado en pantalla siempre fallaba en tiempo de ejecución.
 */
import { apiClient } from "@/shared/infrastructure/http/fetcher-api";
import type { ApiResponse } from "@/shared/types/api-response";
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
  familiares: "/api/v1/reportes/familiares/pdf/",
  codigos: "/api/v1/reportes/codigos/pdf/",
  tendencias: "/api/v1/reportes/tendencias/pdf/",
  "distribucion-nomina": "/api/v1/reportes/distribucion-nomina/pdf/",
};

const RUTA_EXCEL_REPORTE: Record<TipoReportePersonal, string> = {
  "personal-activo": "/api/v1/reportes/personal-activo/excel/",
  "personal-pasivo": "/api/v1/reportes/pasivos/excel/",
  vacantes: "/api/v1/reportes/cargos-vacantes/excel/",
  familiares: "/api/v1/reportes/familiares/excel/",
  codigos: "/api/v1/reportes/codigos/excel/",
  tendencias: "/api/v1/reportes/tendencias/excel/",
  "distribucion-nomina": "/api/v1/reportes/distribucion-nomina/excel/",
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

export interface ReporteFamiliarApiItem {
  cedula_familiar: string;
  nombres: string;
  apellidos: string;
  parentesco: string;
  sexo: string;
  fecha_nacimiento: string;
  cedula_empleado: string;
}

export interface ReporteCodigoApiItem {
  codigo: string;
  cargo: string;
  cargo_especifico: string;
  tipo_nomina: string;
  dependencia: string;
  direccion_general: string;
  estatus: string;
}

export interface TendenciaApiItem {
  periodo: string;
  ingresos: number;
  egresos: number;
}

export interface DistribucionNominaApiItem {
  tipo_nomina: string;
  total: number;
}

interface ResultadoReporteApi<T> {
  titulo: string;
  columnas: string[];
  filas: T[];
  total_registros: number;
  metadatos: Record<string, unknown>;
}

export type FiltrosReporteApi = Record<string, string | number | boolean | undefined | null>;

async function getFilas<T>(path: string, filtros?: FiltrosReporteApi): Promise<T[]> {
  const envelope = await apiClient.get<ApiResponse<ResultadoReporteApi<T>>>(path, { params: filtros });
  return envelope.data.filas;
}

export const reportesApi = {
  getReportePersonal: (filtros?: FiltrosReporteApi) =>
    getFilas<ReportePersonalApiItem>("/api/v1/reportes/personal-activo/", filtros),

  getReportePasivos: (filtros?: FiltrosReporteApi) =>
    getFilas<ReportePasivoApiItem>("/api/v1/reportes/pasivos/", filtros),

  getReporteVacantes: (filtros?: FiltrosReporteApi) =>
    getFilas<ReporteVacanteApiItem>("/api/v1/reportes/cargos-vacantes/", filtros),

  getReporteFamiliares: (filtros?: FiltrosReporteApi) =>
    getFilas<ReporteFamiliarApiItem>("/api/v1/reportes/familiares/", filtros),

  getReporteCodigos: (filtros?: FiltrosReporteApi) =>
    getFilas<ReporteCodigoApiItem>("/api/v1/reportes/codigos/", filtros),

  getTendencias: () => getFilas<TendenciaApiItem>("/api/v1/reportes/tendencias/"),

  getDistribucionNomina: () =>
    getFilas<DistribucionNominaApiItem>("/api/v1/reportes/distribucion-nomina/"),

  getPdf: (tipo: TipoReportePersonal) => apiClient.getBlob(RUTA_PDF_REPORTE[tipo]),

  getExcel: (tipo: TipoReportePersonal) => apiClient.getBlob(RUTA_EXCEL_REPORTE[tipo]),
};
