"use server";

/**
 * Server Actions para Carnetización (Regla R7).
 * Zero-trust: se revalida la entrada con el schema Zod antes de invocar el
 * caso de uso. Captura errores y llama `handleSessionExpired` (R7) y registra
 * la auditoría en `logs/frontend/audit_frontend.txt` (D-04/C-5).
 */
import { generateTraceId } from "@/shared/infrastructure/logging/trace-context";
import { logAudit } from "@/shared/infrastructure/logging/logger-server";
import { handleSessionExpired } from "@/shared/infrastructure/http/errors";
import {
  activarPlantillaCarnet,
  emitirCarnet,
  listarCarnets,
  listarPlantillasCarnet,
  revocarCarnet,
} from "../../application/use-cases/emitir-carnet";
import { obtenerEstadisticas } from "../../application/use-cases/obtener-estadisticas";
import { validarCarnetPorHash, validarCarnetPorId } from "../../application/use-cases/validar-qr";
import { repoCarnetizacionApi } from "../repositories/repo-carnetizacion-api";
import { carnetIdSchema, emitirCarnetSchema, plantillaIdSchema, validarHashSchema } from "../../ui/schema/schema-carnet";

export async function getCarnetsAction(cedula?: string) {
  const cedulaValida = cedula ? cedula.trim() : undefined;

  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await listarCarnets(repoCarnetizacionApi, cedulaValida);
    await logAudit({ traceId, action: "getCarnetsAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "getCarnetsAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    throw error;
  }
}

export async function emitirCarnetAction(empleadoCedula: string, motivoId: number, observaciones?: string) {
  const validation = emitirCarnetSchema.safeParse({ empleadoCedula, motivoId, observaciones });
  if (!validation.success) {
    return { error: "Datos de emisión inválidos. Revise los campos ingresados." };
  }

  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await emitirCarnet(repoCarnetizacionApi, validation.data.empleadoCedula, validation.data.motivoId, validation.data.observaciones);
    await logAudit({ traceId, action: "emitirCarnetAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "emitirCarnetAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    throw error;
  }
}

export async function validarCarnetPorHashAction(securityHash: string) {
  const validation = validarHashSchema.safeParse({ securityHash });
  if (!validation.success) {
    return { error: "Hash de seguridad inválido." };
  }

  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await validarCarnetPorHash(repoCarnetizacionApi, validation.data.securityHash);
    await logAudit({ traceId, action: "validarCarnetPorHashAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "validarCarnetPorHashAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    throw error;
  }
}

export async function validarCarnetPorIdAction(carnetId: number) {
  const validation = carnetIdSchema.safeParse({ carnetId });
  if (!validation.success) {
    return { error: "Carnet inválido." };
  }

  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await validarCarnetPorId(repoCarnetizacionApi, validation.data.carnetId);
    await logAudit({ traceId, action: "validarCarnetPorIdAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "validarCarnetPorIdAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    throw error;
  }
}

export async function getPlantillasCarnetAction() {
  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await listarPlantillasCarnet(repoCarnetizacionApi);
    await logAudit({ traceId, action: "getPlantillasCarnetAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "getPlantillasCarnetAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    throw error;
  }
}

export async function activarPlantillaCarnetAction(plantillaId: number) {
  const validation = plantillaIdSchema.safeParse({ plantillaId });
  if (!validation.success) {
    return { error: "Plantilla inválida." };
  }

  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await activarPlantillaCarnet(repoCarnetizacionApi, validation.data.plantillaId);
    await logAudit({ traceId, action: "activarPlantillaCarnetAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "activarPlantillaCarnetAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    throw error;
  }
}

export async function descargarPdfCarnetAction(carnetId: number) {
  const validation = carnetIdSchema.safeParse({ carnetId });
  if (!validation.success) {
    return { error: "Carnet inválido." };
  }

  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await repoCarnetizacionApi.descargarPdf(validation.data.carnetId);
    await logAudit({ traceId, action: "descargarPdfCarnetAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "descargarPdfCarnetAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    throw error;
  }
}

export async function revocarCarnetAction(carnetId: number) {
  const validation = carnetIdSchema.safeParse({ carnetId });
  if (!validation.success) {
    return { error: "Carnet inválido." };
  }

  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await revocarCarnet(repoCarnetizacionApi, validation.data.carnetId);
    await logAudit({ traceId, action: "revocarCarnetAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "revocarCarnetAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    throw error;
  }
}

export async function getEstadisticasCarnetsAction() {
  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await obtenerEstadisticas(repoCarnetizacionApi);
    await logAudit({ traceId, action: "getEstadisticasCarnetsAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "getEstadisticasCarnetsAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    throw error;
  }
}
