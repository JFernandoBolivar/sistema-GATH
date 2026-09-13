"use server";

/**
 * Server Actions para Pasivos (Regla R7).
 * Zero-trust: se revalida la entrada con el schema Zod antes de invocar el
 * caso de uso. Captura errores y llama `handleSessionExpired` (R7) y registra
 * la auditoría en `logs/frontend/audit_frontend.txt` (D-04/C-5).
 */
import { generateTraceId } from "@/shared/infrastructure/logging/trace-context";
import { logAudit } from "@/shared/infrastructure/logging/logger-server";
import { handleSessionExpired } from "@/shared/infrastructure/http/errors";
import {
  listarPasivos,
  obtenerPasivoPorCedula,
  procesarEgreso,
} from "../../application/use-cases/gestionar-pasivos";
import {
  listarMotivosEgreso,
  listarTiposNomina,
} from "../../application/use-cases/listar-catalogo-egreso";
import { listarCatalogosExpedientePasivo } from "../../application/use-cases/listar-catalogos-expediente";
import { repoPasivosApi } from "../repositories/repo-pasivos-api";
import {
  listadoPasivosSchema,
  pasivoCedulaSchema,
  procesarEgresoSchema,
} from "../../ui/schema/schema-pasivo";

export async function getPasivosAction(busqueda?: string) {
  const validated = listadoPasivosSchema.safeParse({ busqueda });
  const busquedaValida = validated.success ? validated.data.busqueda : undefined;

  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await listarPasivos(repoPasivosApi, busquedaValida);
    await logAudit({ traceId, action: "getPasivosAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "getPasivosAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    throw error;
  }
}

export async function getPasivoPorCedulaAction(cedula: string) {
  const validation = pasivoCedulaSchema.safeParse({ cedula });
  if (!validation.success) {
    return { error: "Cédula inválida. Revise el formato ingresado." };
  }

  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await obtenerPasivoPorCedula(repoPasivosApi, validation.data.cedula);
    await logAudit({ traceId, action: "getPasivoPorCedulaAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "getPasivoPorCedulaAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    throw error;
  }
}

export async function procesarEgresoAction(input: {
  cedula: string;
  motivoMovimientoId: number;
  tipoNominaId: number;
  liberarActivos: boolean;
}) {
  const validation = procesarEgresoSchema.safeParse(input);
  if (!validation.success) {
    return { error: "Datos de la transición inválidos. Revise los campos ingresados." };
  }

  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await procesarEgreso(repoPasivosApi, validation.data);
    await logAudit({ traceId, action: "procesarEgresoAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "procesarEgresoAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    throw error;
  }
}

export async function getMotivosEgresoAction() {
  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await listarMotivosEgreso(repoPasivosApi);
    await logAudit({ traceId, action: "getMotivosEgresoAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "getMotivosEgresoAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    throw error;
  }
}

export async function getTiposNominaAction() {
  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await listarTiposNomina(repoPasivosApi);
    await logAudit({ traceId, action: "getTiposNominaAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "getTiposNominaAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    throw error;
  }
}

export async function getCatalogosExpedientePasivoAction() {
  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await listarCatalogosExpedientePasivo(repoPasivosApi);
    await logAudit({ traceId, action: "getCatalogosExpedientePasivoAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "getCatalogosExpedientePasivoAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    throw error;
  }
}
