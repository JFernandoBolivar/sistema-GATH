/**
 * Implementación del repositorio de Reportes usando la API REST.
 */
import type { RepoReportes } from "../../domain/ports/repo-reportes";
import { reportesApi } from "../http/reportes-api";
import {
  reportePasivoApiAEntidad,
  reportePersonalApiAEntidad,
  reporteVacanteApiAEntidad,
} from "../mappers/mapper-reportes";

export const repoReportesApi: RepoReportes = {
  async generarReportePersonal(filtros) {
    const params: any = {};
    if (filtros?.dependenciaId) params.dependencia_id = filtros.dependenciaId;
    if (filtros?.tipoPersonalId) params.tipo_personal_id = filtros.tipoPersonalId;
    const raw = await reportesApi.getReportePersonal(params);
    return raw.map(reportePersonalApiAEntidad);
  },

  async generarReportePasivos(filtros) {
    const params: any = {};
    if (filtros?.tipoPersonalId) params.tipo_personal_id = filtros.tipoPersonalId;
    const raw = await reportesApi.getReportePasivos(params);
    return raw.map(reportePasivoApiAEntidad);
  },

  async generarReporteVacantes(filtros) {
    const params: any = {};
    if (filtros?.dependenciaId) params.dependencia_id = filtros.dependenciaId;
    const raw = await reportesApi.getReporteVacantes(params);
    return raw.map(reporteVacanteApiAEntidad);
  },

  async descargarPdf(tipo) {
    return reportesApi.getPdf(tipo);
  },

  async descargarExcel(tipo) {
    return reportesApi.getExcel(tipo);
  },
};
