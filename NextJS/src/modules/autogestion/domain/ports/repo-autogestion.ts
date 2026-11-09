/**
 * Puerto del Repositorio de Autogestión (Reglas R1, R4).
 */
import type {
  ItemRespuestaCenso,
  MetricasCenso,
  PreguntaCenso,
  ReporteDependenciaCenso,
  RespuestaCenso,
} from "../entities/censo";

export interface RepoAutogestion {
  listarPreguntas(): Promise<PreguntaCenso[]>;
  obtenerCensoDeEmpleado(cedula: string): Promise<RespuestaCenso[]>;
  registrarRespuestasCenso(
    cedula: string,
    respuestas: ItemRespuestaCenso[],
  ): Promise<RespuestaCenso[]>;
  obtenerReporteDependencias(): Promise<ReporteDependenciaCenso[]>;
  obtenerMetricasCenso(): Promise<MetricasCenso>;
  descargarExcelCenso(): Promise<Blob>;
}
