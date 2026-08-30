"use server";

/**
 * Server Actions para Reportes (Regla R7).
 * Zero-trust: se revalida la entrada con el schema Zod antes de invocar el
 * caso de uso. Captura errores y llama `handleSessionExpired` (R7) y registra
 * la auditoría en `logs/frontend/audit_frontend.txt` (D-04/C-5).
 */
import { generateTraceId } from "@/shared/infrastructure/logging/trace-context";
import { logAudit } from "@/shared/infrastructure/logging/logger-server";
import { handleSessionExpired } from "@/shared/infrastructure/http/errors";
import {
  generarReportePasivos,
  generarReportePersonal,
  generarReporteVacantes,
} from "../../application/use-cases/generar-reportes";
import { repoReportesApi } from "../repositories/repo-reportes-api";
import { reporteFilterSchema, tipoReporteSchema } from "../../ui/schema/schema-reporte";

export async function getReportePersonalAction(filtros?: {
  dependenciaId?: number;
  tipoPersonalId?: number;
}) {
  const validation = reporteFilterSchema.safeParse(filtros ?? {});
  const validatedFiltros = validation.success ? validation.data : {};

  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await generarReportePersonal(repoReportesApi, validatedFiltros);
    await logAudit({ traceId, action: "getReportePersonalAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "getReportePersonalAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    throw error;
  }
}

export async function getReportePasivosAction(filtros?: { tipoPersonalId?: number }) {
  const validation = reporteFilterSchema.safeParse(filtros ?? {});
  const validatedFiltros = validation.success ? validation.data : {};

  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await generarReportePasivos(repoReportesApi, validatedFiltros);
    await logAudit({ traceId, action: "getReportePasivosAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "getReportePasivosAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    throw error;
  }
}

export async function getReporteVacantesAction(filtros?: { dependenciaId?: number }) {
  const validation = reporteFilterSchema.safeParse(filtros ?? {});
  const validatedFiltros = validation.success ? validation.data : {};

  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await generarReporteVacantes(repoReportesApi, validatedFiltros);
    await logAudit({ traceId, action: "getReporteVacantesAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "getReporteVacantesAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    throw error;
  }
}

export async function descargarReportePdfAction(tipo: string) {
  const validation = tipoReporteSchema.safeParse(tipo);
  if (!validation.success) {
    return { error: "Tipo de reporte inválido." };
  }

  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const resultado = await repoReportesApi.descargarPdf(validation.data);
    await logAudit({ traceId, action: "descargarReportePdfAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return resultado;
  } catch (error) {
    await logAudit({ traceId, action: "descargarReportePdfAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    throw error;
  }
}

export async function descargarReporteExcelAction(tipo: string) {
  const validation = tipoReporteSchema.safeParse(tipo);
  if (!validation.success) {
    return { error: "Tipo de reporte inválido." };
  }

  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const resultado = await repoReportesApi.descargarExcel(validation.data);
    await logAudit({ traceId, action: "descargarReporteExcelAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return resultado;
  } catch (error) {
    await logAudit({ traceId, action: "descargarReporteExcelAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    throw error;
  }
}
