/**
 * Cliente HTTP para Autogestión conectado a la API canónica /api/v1/autogestion/
 * (verificado contra `BACKEND/apps/autogestion/presentation/urls.py` +
 * `autogestion_serializers.py` — Fase 1 del plan de reparación). El censo es
 * un cuestionario dinámico identificado por cédula, no un formulario fijo.
 */
import { apiClient } from "@/shared/infrastructure/http/fetcher-api";
import type { ApiResponse } from "@/shared/types/api-response";

export interface OpcionPreguntaApiItem {
  id: number;
  texto: string;
  orden: number;
}

export interface PreguntaCensoApiItem {
  id: number;
  enunciado: string;
  tipo: string;
  orden: number;
  activo: boolean;
  validacion: string | null;
  opciones: OpcionPreguntaApiItem[];
}

export interface RespuestaCensoApiItem {
  id: number;
  pregunta_id: number;
  pregunta_enunciado: string;
  empleado_cedula: string;
  opcion_id: number | null;
  opcion_texto: string | null;
  respuesta_texto: string;
}

export interface ReporteDependenciaApiItem {
  dependencia_id: number;
  dependencia: string;
  total_empleados: number;
  empleados_censados: number;
}

export interface MetricasCensoApiItem {
  total_empleados_censados: number;
  total_respuestas: number;
  por_dependencia: ReporteDependenciaApiItem[];
}

export const autogestionApi = {
  getPreguntas: () =>
    apiClient.get<PreguntaCensoApiItem[]>("/api/v1/autogestion/preguntas/"),

  getCensoDeEmpleado: (cedula: string) =>
    apiClient.get<RespuestaCensoApiItem[]>(`/api/v1/autogestion/censo/${cedula}/`),

  registrarRespuestas: (cedula: string, respuestas: Array<Record<string, unknown>>) =>
    apiClient.post<RespuestaCensoApiItem[]>(`/api/v1/autogestion/censo/${cedula}/`, { respuestas }),

  getReporteDependencias: () =>
    apiClient.get<ReporteDependenciaApiItem[]>("/api/v1/autogestion/censo/reporte-dependencias/"),

  getExcelCenso: () =>
    apiClient.getBlob("/api/v1/autogestion/censo/export/excel/"),

  getMetricas: async () => {
    const envelope = await apiClient.get<ApiResponse<MetricasCensoApiItem>>("/api/v1/autogestion/censo/metricas/");
    return envelope.data;
  },
};
