"use server";

import { auth } from "#/auth";
import { generateTraceId } from "@/shared/infrastructure/logging/trace-context";
import { logAudit } from "@/shared/infrastructure/logging/logger-server";
import { handleSessionExpired } from "@/shared/infrastructure/http/errors";
import type { Pregunta } from "@/app/types/types";
import {
  autogestionApi,
  type DatosViviendaPayload,
  type FiltrosExportCenso,
  type OpcionCensoCompat,
  type SubmitPayload,
} from "../http/autogestion-api";
import type { ItemRespuestaInputDTO } from "../../application/dtos/censo-dto";
import type { MiExpedienteDTO } from "../../application/dtos/mi-expediente-dto";
import { censoCedulaSchema, registrarCensoSchema } from "../../ui/schema/schema-censo";

export async function getSessionCedulaAction(): Promise<string | null> {
  const session = await auth();
  return session?.user?.cedula ?? null;
}

export async function getPreguntasAction() {
  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const res = await autogestionApi.getPreguntas();
    await logAudit({
      traceId,
      action: "getPreguntasAction",
      status: "SUCCESS",
      durationMs: Date.now() - startedAt,
    });
    return res;
  } catch (error) {
    await logAudit({
      traceId,
      action: "getPreguntasAction",
      status: "FAILED",
      durationMs: Date.now() - startedAt,
    });
    handleSessionExpired(error);
    throw error;
  }
}

export async function consultarCensoEmpleadoAction(cedula?: string) {
  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const res = await autogestionApi.consultarCensoEmpleado(cedula);
    await logAudit({
      traceId,
      action: "consultarCensoEmpleadoAction",
      status: "SUCCESS",
      durationMs: Date.now() - startedAt,
    });
    return res;
  } catch (error) {
    await logAudit({
      traceId,
      action: "consultarCensoEmpleadoAction",
      status: "FAILED",
      durationMs: Date.now() - startedAt,
    });
    handleSessionExpired(error);
    throw error;
  }
}

export async function enviarAutogestionAction(
  carnetPatria: string,
  datosVivienda: DatosViviendaPayload | undefined,
  respuestas: { pregunta: number; opcion: number | null; respuesta: string }[],
) {
  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const session = await auth();
    const cedula = session?.user?.cedula;
    if (!cedula) {
      return {
        success: false,
        message: "No tienes permiso para realizar esta acción. Inicia sesión.",
      };
    }

    const payload: SubmitPayload = {
      carnet_patria: carnetPatria,
      datos_vivienda: datosVivienda,
      respuestas,
    };

    const res = await autogestionApi.submitCensoVivienda(cedula, payload);
    await logAudit({
      traceId,
      action: "enviarAutogestionAction",
      status: "SUCCESS",
      durationMs: Date.now() - startedAt,
    });

    return {
      // apiClient lanza ante respuestas no exitosas: llegar aquí es éxito.
      success: true,
      message: res?.message || "Formulario enviado exitosamente.",
    };
  } catch (error) {
    await logAudit({
      traceId,
      action: "enviarAutogestionAction",
      status: "FAILED",
      durationMs: Date.now() - startedAt,
    });
    handleSessionExpired(error);
    return {
      success: false,
      message: "Ocurrió un error al enviar el formulario.",
    };
  }
}

export async function getReporteCensoDependenciasAction(searchParams?: string) {
  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const res = await autogestionApi.getReporteCensoDependencias(searchParams);
    await logAudit({
      traceId,
      action: "getReporteCensoDependenciasAction",
      status: "SUCCESS",
      durationMs: Date.now() - startedAt,
    });
    return res;
  } catch (error) {
    await logAudit({
      traceId,
      action: "getReporteCensoDependenciasAction",
      status: "FAILED",
      durationMs: Date.now() - startedAt,
    });
    handleSessionExpired(error);
    throw error;
  }
}

export async function exportarCensoExcelAction(filtros?: FiltrosExportCenso) {
  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const blob = await autogestionApi.exportarCensoExcel(filtros);
    const arrayBuffer = await blob.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    await logAudit({
      traceId,
      action: "exportarCensoExcelAction",
      status: "SUCCESS",
      durationMs: Date.now() - startedAt,
    });
    return { success: true as const, data: base64 };
  } catch (error) {
    await logAudit({
      traceId,
      action: "exportarCensoExcelAction",
      status: "FAILED",
      durationMs: Date.now() - startedAt,
    });
    handleSessionExpired(error);
    return { success: false as const, error: "Error al generar el archivo Excel" };
  }
}

// Catálogos
export async function getStatesAction() {
  return autogestionApi.getStates();
}

export async function getMunicipalitysAction(estadoId: string | number) {
  return autogestionApi.getMunicipalitys(estadoId);
}

export async function getParishAction(municipioId: string | number) {
  return autogestionApi.getParish(municipioId);
}

export async function getConditionDwellingAction() {
  return autogestionApi.getConditionDwelling();
}

export async function getCodigosPostalesAction(estadoId: string | number) {
  return autogestionApi.getCodigosPostales(estadoId);
}

export async function getDependencyAction() {
  return autogestionApi.getDependency();
}

export async function getDirectionGeneralAction(dependenciaId: string | number) {
  return autogestionApi.getDirectionGeneralById(dependenciaId);
}

export async function getDirectionLineAction(dgId: string | number) {
  return autogestionApi.getDirectionLine(dgId);
}

export async function getCoordinationAction(dlId: string | number) {
  return autogestionApi.getCoordination(dlId);
}

export async function getNominaGeneralAction() {
  return autogestionApi.getNominaGeneral();
}

// Aliases for compatibility
export const getPreguntasCensoAction = async () => {
  const res = await getPreguntasAction();
  const preguntas = (res.data || []) as (Pregunta & { orden?: number; activo?: boolean })[];
  return preguntas.map((p) => ({
    id: p.id,
    enunciado: p.enunciado,
    tipo: p.tipo?.nombre ?? "",
    orden: p.orden ?? 0,
    activo: p.activo ?? true,
    validacion: p.validacion,
    opciones: (p.opciones || []).map((o: OpcionCensoCompat) => ({
      id: o.id,
      texto: o.tipo_opcion || o.texto || "",
      orden: o.orden ?? 0,
    })),
  }));
};

export const getMiCensoAction = async () => {
  const session = await auth();
  const cedula = session?.user?.cedula;
  if (!cedula) return [];
  const res = await consultarCensoEmpleadoAction(cedula);
  const censo = res.data?.[0];
  if (!censo) return [];
  return (censo.preguntas || []).map((p) => ({
    id: p.id,
    preguntaId: p.id,
    preguntaEnunciado: p.pregunta,
    empleadoCedula: censo.cedula,
    opcionId: p.opcion?.id ?? null,
    opcionTexto: p.opcion?.opcion ?? null,
    respuestaTexto: p.respuesta,
  }));
};

export const guardarMiCensoAction = async (respuestas: ItemRespuestaInputDTO[]) => {
  const formatted = respuestas.map((r) => ({
    pregunta: r.preguntaId,
    opcion: r.opcionId ?? null,
    respuesta: r.respuesta ?? "",
  }));
  return enviarAutogestionAction("", undefined, formatted);
};

export const getReporteDependenciasCensoAction = async () => {
  const res = await getReporteCensoDependenciasAction();
  return (res.data?.bar_chart || []).map((b, idx) => ({
    dependenciaId: idx + 1,
    dependencia: b.key,
    totalEmpleados: b.total,
    empleadosCensados: b.respondidos,
  }));
};

export const obtenerCensoPorCedulaAction = async (cedula: string) => {
  const res = await consultarCensoEmpleadoAction(cedula);
  const censo = res.data?.[0];
  if (!censo) return [];
  return (censo.preguntas || []).map((p) => ({
    id: p.id,
    preguntaId: p.id,
    preguntaEnunciado: p.pregunta,
    empleadoCedula: censo.cedula,
    opcionId: p.opcion?.id ?? null,
    opcionTexto: p.opcion?.opcion ?? null,
    respuestaTexto: p.respuesta,
  }));
};

export const getMetricasCensoAction = async () => {
  const res = await autogestionApi.getMetricas();
  const d = res.data;
  return {
    totalEmpleadosCensados: d?.total_empleados_censados || 0,
    totalRespuestas: d?.total_respuestas || 0,
    porDependencia: (d?.bar_chart || []).map((b, idx) => ({
      dependenciaId: idx + 1,
      dependencia: b.key,
      totalEmpleados: b.total,
      empleadosCensados: b.respondidos,
    })),
  };
};

export const descargarExcelCensoAction = async (): Promise<Blob> => {
  return autogestionApi.exportarCensoExcel();
};

export const getMiExpedienteAction = async (): Promise<MiExpedienteDTO | null> => {
  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const res = await autogestionApi.getMiExpediente();
    await logAudit({
      traceId,
      action: "getMiExpedienteAction",
      status: "SUCCESS",
      durationMs: Date.now() - startedAt,
    });
    return res.data;
  } catch (error) {
    await logAudit({
      traceId,
      action: "getMiExpedienteAction",
      status: "FAILED",
      durationMs: Date.now() - startedAt,
    });
    handleSessionExpired(error);
    return null;
  }
};

export const solicitarCarnetAction = async (payload: {
  motivo_id?: number;
  observaciones?: string;
}) => {
  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const res = await autogestionApi.solicitarCarnet(payload);
    await logAudit({
      traceId,
      action: "solicitarCarnetAction",
      status: "SUCCESS",
      durationMs: Date.now() - startedAt,
    });
    return {
      success: true,
      message: res.message || "Carnet institucional solicitado exitosamente.",
      data: res.data,
    };
  } catch (error: unknown) {
    await logAudit({
      traceId,
      action: "solicitarCarnetAction",
      status: "FAILED",
      durationMs: Date.now() - startedAt,
    });
    handleSessionExpired(error);
    const message =
      error instanceof Error ? error.message : "Error al solicitar el carnet institucional.";
    return {
      success: false,
      message,
    };
  }
};

export const descargarMiCarnetPdfAction = async (): Promise<Blob> => {
  return autogestionApi.descargarMiCarnetPdf();
};
