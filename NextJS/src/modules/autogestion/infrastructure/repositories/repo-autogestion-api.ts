/**
 * Implementación del repositorio de Autogestión usando la API REST.
 */
import type { RepoAutogestion } from "../../domain/ports/repo-autogestion";
import {
  autogestionApi,
  type PreguntaCensoApiItem,
  type MetricasCensoApiItem,
} from "../http/autogestion-api";
import {
  metricasApiAEntidad,
  preguntaApiAEntidad,
  reporteDependenciaApiAEntidad,
  respuestaApiAEntidad,
} from "../mappers/mapper-autogestion";

export const repoAutogestionApi: RepoAutogestion = {
  async listarPreguntas() {
    const raw = await autogestionApi.getPreguntas();
    return ((raw.data as unknown as PreguntaCensoApiItem[]) || []).map(preguntaApiAEntidad);
  },

  async obtenerCensoDeEmpleado(cedula) {
    const raw = await autogestionApi.getCensoDeEmpleado(cedula);
    return raw.map(respuestaApiAEntidad);
  },

  async registrarRespuestasCenso(cedula, respuestas) {
    const raw = await autogestionApi.registrarRespuestas(
      cedula,
      respuestas.map((r) => ({
        pregunta_id: r.preguntaId,
        opcion_id: r.opcionId ?? null,
        respuesta: r.respuesta ?? "",
      })),
    );
    return raw.map(respuestaApiAEntidad);
  },

  async obtenerReporteDependencias() {
    const raw = await autogestionApi.getReporteDependencias();
    return raw.map(reporteDependenciaApiAEntidad);
  },

  async obtenerMetricasCenso() {
    const m = await autogestionApi.getMetricas();
    return metricasApiAEntidad((m.data as unknown as MetricasCensoApiItem) || {});
  },

  async descargarExcelCenso() {
    return autogestionApi.getExcelCenso();
  },
};
