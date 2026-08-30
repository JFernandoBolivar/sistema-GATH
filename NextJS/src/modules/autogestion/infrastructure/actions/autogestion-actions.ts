"use server";

/**
 * Server Actions para Autogestión (Regla R7).
 * Zero-trust: se revalida la entrada con el schema Zod antes de invocar el
 * caso de uso. Captura errores y llama `handleSessionExpired` (R7) y registra
 * la auditoría en `logs/frontend/audit_frontend.txt` (D-04/C-5).
 *
 * El censo se identifica por cédula (`/api/v1/autogestion/censo/<cedula>/`,
 * ALTA-07): "mi censo" resuelve la cédula del titular de la sesión activa,
 * nunca acepta una cédula arbitraria del cliente.
 */
import { auth } from "#/auth";
import { generateTraceId } from "@/shared/infrastructure/logging/trace-context";
import { logAudit } from "@/shared/infrastructure/logging/logger-server";
import { handleSessionExpired } from "@/shared/infrastructure/http/errors";
import type { ItemRespuestaInputDTO } from "../../application/dtos/censo-dto";
import {
  listarPreguntasCenso,
  obtenerCensoDeEmpleado,
  obtenerReporteDependenciasCenso,
  registrarRespuestasCenso,
} from "../../application/use-cases/gestionar-censo";
import { repoAutogestionApi } from "../repositories/repo-autogestion-api";
import { censoCedulaSchema, registrarCensoSchema } from "../../ui/schema/schema-censo";

async function cedulaDeLaSesion(): Promise<string> {
  const session = await auth();
  const cedula = session?.user?.cedula;
  if (!cedula) throw new Error("No se pudo determinar la cédula del usuario autenticado.");
  return cedula;
}

export async function getPreguntasCensoAction() {
  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await listarPreguntasCenso(repoAutogestionApi);
    await logAudit({ traceId, action: "getPreguntasCensoAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "getPreguntasCensoAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    throw error;
  }
}

export async function getMiCensoAction() {
  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const cedula = await cedulaDeLaSesion();
    const result = await obtenerCensoDeEmpleado(repoAutogestionApi, cedula);
    await logAudit({ traceId, action: "getMiCensoAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "getMiCensoAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    throw error;
  }
}

export async function guardarMiCensoAction(respuestas: ItemRespuestaInputDTO[]) {
  const validation = registrarCensoSchema.safeParse({ respuestas });
  if (!validation.success) {
    return { error: "Datos del censo inválidos. Revise las respuestas ingresadas." };
  }

  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const cedula = await cedulaDeLaSesion();
    const result = await registrarRespuestasCenso(repoAutogestionApi, cedula, validation.data.respuestas);
    await logAudit({ traceId, action: "guardarMiCensoAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "guardarMiCensoAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    throw error;
  }
}

export async function getReporteDependenciasCensoAction() {
  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await obtenerReporteDependenciasCenso(repoAutogestionApi);
    await logAudit({ traceId, action: "getReporteDependenciasCensoAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "getReporteDependenciasCensoAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    throw error;
  }
}

export async function obtenerCensoPorCedulaAction(cedula: string) {
  const validation = censoCedulaSchema.safeParse({ cedula });
  if (!validation.success) {
    return { error: "Cédula inválida. Revise el formato ingresado." };
  }

  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await obtenerCensoDeEmpleado(repoAutogestionApi, validation.data.cedula);
    await logAudit({ traceId, action: "obtenerCensoPorCedulaAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "obtenerCensoPorCedulaAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    throw error;
  }
}
