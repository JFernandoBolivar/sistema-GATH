/**
 * Casos de uso de Autogestión y Censo (Reglas R2, R4).
 */
import type { MetricasCenso, PreguntaCenso, ReporteDependenciaCenso, RespuestaCenso } from "../../domain/entities/censo";
import type { RepoAutogestion } from "../../domain/ports/repo-autogestion";
import type {
  ItemRespuestaInputDTO,
  MetricasCensoDTO,
  PreguntaCensoDTO,
  ReporteDependenciaDTO,
  RespuestaCensoDTO,
} from "../dtos/censo-dto";

function aPreguntaDTO(p: PreguntaCenso): PreguntaCensoDTO {
  return {
    id: p.id,
    enunciado: p.enunciado,
    tipo: p.tipo,
    orden: p.orden,
    activo: p.activo,
    validacion: p.validacion,
    opciones: p.opciones,
  };
}

function aRespuestaDTO(r: RespuestaCenso): RespuestaCensoDTO {
  return {
    id: r.id,
    preguntaId: r.preguntaId,
    preguntaEnunciado: r.preguntaEnunciado,
    empleadoCedula: r.empleadoCedula,
    opcionId: r.opcionId,
    opcionTexto: r.opcionTexto,
    respuestaTexto: r.respuestaTexto,
  };
}

function aReporteDTO(r: ReporteDependenciaCenso): ReporteDependenciaDTO {
  return {
    dependenciaId: r.dependenciaId,
    dependencia: r.dependencia,
    totalEmpleados: r.totalEmpleados,
    empleadosCensados: r.empleadosCensados,
  };
}

export async function listarPreguntasCenso(repo: RepoAutogestion): Promise<PreguntaCensoDTO[]> {
  const entidades = await repo.listarPreguntas();
  return entidades.map(aPreguntaDTO);
}

export async function obtenerCensoDeEmpleado(
  repo: RepoAutogestion,
  cedula: string
): Promise<RespuestaCensoDTO[]> {
  const entidades = await repo.obtenerCensoDeEmpleado(cedula);
  return entidades.map(aRespuestaDTO);
}

export async function registrarRespuestasCenso(
  repo: RepoAutogestion,
  cedula: string,
  respuestas: ItemRespuestaInputDTO[]
): Promise<RespuestaCensoDTO[]> {
  const entidades = await repo.registrarRespuestasCenso(
    cedula,
    respuestas.map((r) => ({ preguntaId: r.preguntaId, opcionId: r.opcionId, respuesta: r.respuesta })),
  );
  return entidades.map(aRespuestaDTO);
}

export async function obtenerReporteDependenciasCenso(
  repo: RepoAutogestion
): Promise<ReporteDependenciaDTO[]> {
  const entidades = await repo.obtenerReporteDependencias();
  return entidades.map(aReporteDTO);
}

function aMetricasDTO(e: MetricasCenso): MetricasCensoDTO {
  return {
    totalEmpleadosCensados: e.totalEmpleadosCensados,
    totalRespuestas: e.totalRespuestas,
    porDependencia: e.porDependencia.map(aReporteDTO),
  };
}

export async function obtenerMetricasCenso(repo: RepoAutogestion): Promise<MetricasCensoDTO> {
  const entidad = await repo.obtenerMetricasCenso();
  return aMetricasDTO(entidad);
}

export async function descargarExcelCenso(repo: RepoAutogestion): Promise<Blob> {
  return repo.descargarExcelCenso();
}
