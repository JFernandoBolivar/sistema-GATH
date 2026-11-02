/**
 * Implementación del repositorio de Reportes usando la API REST.
 */
import type { RepoReportes } from "../../domain/ports/repo-reportes";
import type { FiltrosReporteApi } from "../http/reportes-api";
import { reportesApi } from "../http/reportes-api";
import {
  distribucionNominaApiAEntidad,
  reporteCodigoApiAEntidad,
  reporteFamiliarApiAEntidad,
  reportePasivoApiAEntidad,
  reportePersonalApiAEntidad,
  reporteVacanteApiAEntidad,
  tendenciaApiAEntidad,
} from "../mappers/mapper-reportes";

export const repoReportesApi: RepoReportes = {
  async generarReportePersonal(filtros) {
    const params: FiltrosReporteApi = {};
    if (filtros?.dependenciaId) params.dependencia_id = filtros.dependenciaId;
    if (filtros?.tipoPersonalId) params.tipo_personal_id = filtros.tipoPersonalId;
    const raw = await reportesApi.getReportePersonal(params);
    return raw.map(reportePersonalApiAEntidad);
  },

  async generarReportePasivos(filtros) {
    const params: FiltrosReporteApi = {};
    if (filtros?.tipoPersonalId) params.tipo_personal_id = filtros.tipoPersonalId;
    if (filtros?.fechaEgresoDesde) params.fecha_egreso_Desde = filtros.fechaEgresoDesde;
    if (filtros?.fechaEgresoHasta) params.fecha_egreso_Hasta = filtros.fechaEgresoHasta;
    const raw = await reportesApi.getReportePasivos(params);
    return raw.map(reportePasivoApiAEntidad);
  },

  async generarReporteVacantes(filtros) {
    const params: FiltrosReporteApi = {};
    if (filtros?.dependenciaId) params.dependencia_id = filtros.dependenciaId;
    const raw = await reportesApi.getReporteVacantes(params);
    return raw.map(reporteVacanteApiAEntidad);
  },

  async generarReporteFamiliares(filtros) {
    const params: FiltrosReporteApi = {};
    if (filtros?.parentescoId) params.parentesco_id = filtros.parentescoId;
    if (filtros?.sexoId) params.sexo_id = filtros.sexoId;
    const raw = await reportesApi.getReporteFamiliares(params);
    return raw.map(reporteFamiliarApiAEntidad);
  },

  async generarReporteCodigos(filtros) {
    const params: FiltrosReporteApi = {};
    if (filtros?.dependenciaId) params.dependencia_id = filtros.dependenciaId;
    if (filtros?.nominaId) params.nomina_id = filtros.nominaId;
    const raw = await reportesApi.getReporteCodigos(params);
    return raw.map(reporteCodigoApiAEntidad);
  },

  async obtenerTendenciasPersonal() {
    const raw = await reportesApi.getTendencias();
    return raw.map(tendenciaApiAEntidad);
  },

  async obtenerDistribucionNomina() {
    const raw = await reportesApi.getDistribucionNomina();
    return raw.map(distribucionNominaApiAEntidad);
  },

  async descargarPdf(tipo) {
    return reportesApi.getPdf(tipo);
  },

  async descargarExcel(tipo) {
    return reportesApi.getExcel(tipo);
  },
};
