/**
 * Mappers para convertir datos de Autogestión a entidades de dominio.
 */
import type { PreguntaCenso, ReporteDependenciaCenso, RespuestaCenso } from "../../domain/entities/censo";
import type {
  PreguntaCensoApiItem,
  ReporteDependenciaApiItem,
  RespuestaCensoApiItem,
} from "../http/autogestion-api";

export function preguntaApiAEntidad(raw: PreguntaCensoApiItem): PreguntaCenso {
  return {
    id: raw.id,
    enunciado: raw.enunciado,
    tipo: raw.tipo,
    orden: raw.orden,
    activo: raw.activo,
    validacion: raw.validacion,
    opciones: raw.opciones.map((o) => ({ id: o.id, texto: o.texto, orden: o.orden })),
  };
}

export function respuestaApiAEntidad(raw: RespuestaCensoApiItem): RespuestaCenso {
  return {
    id: raw.id,
    preguntaId: raw.pregunta_id,
    preguntaEnunciado: raw.pregunta_enunciado,
    empleadoCedula: raw.empleado_cedula,
    opcionId: raw.opcion_id,
    opcionTexto: raw.opcion_texto,
    respuestaTexto: raw.respuesta_texto,
  };
}

export function reporteDependenciaApiAEntidad(raw: ReporteDependenciaApiItem): ReporteDependenciaCenso {
  return {
    dependenciaId: raw.dependencia_id,
    dependencia: raw.dependencia,
    totalEmpleados: raw.total_empleados,
    empleadosCensados: raw.empleados_censados,
  };
}
