/**
 * Server Actions de la bitácora (D10). Solo lectura; validan los filtros con
 * Zod antes de consultar y dejan traza de auditoría de frontend.
 */
"use server";

import { generateTraceId } from "@/shared/infrastructure/logging/trace-context";
import { logAudit } from "@/shared/infrastructure/logging/logger-server";
import { handleSessionExpired } from "@/shared/infrastructure/http/errors";
import { repoAuditoriaApi } from "../repositories/repo-auditoria-api";
import { filtrosAuditoriaSchema, aFiltros } from "../../ui/schema/schema-auditoria";
import type { FiltrosAuditoria } from "../../application/dtos/auditoria-dto";

async function conAuditoria<T>(
  accion: string,
  operacion: () => Promise<T>,
): Promise<T | { error: string }> {
  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const resultado = await operacion();
    await logAudit({
      traceId,
      action: accion,
      status: "SUCCESS",
      durationMs: Date.now() - startedAt,
    });
    return resultado;
  } catch (error) {
    await logAudit({
      traceId,
      action: accion,
      status: "FAILED",
      durationMs: Date.now() - startedAt,
    });
    handleSessionExpired(error);
    return {
      error:
        error instanceof Error && error.message
          ? error.message
          : "No fue posible consultar la bitácora.",
    };
  }
}

function validarFiltros(filtros: FiltrosAuditoria) {
  return filtrosAuditoriaSchema.safeParse({
    usuario: filtros.usuario ?? "",
    accion: filtros.accion ?? "",
    modulo: filtros.modulo ?? "",
    recurso: filtros.recurso ?? "",
    ip: filtros.ip ?? "",
    desde: filtros.desde ?? "",
    hasta: filtros.hasta ?? "",
    resultado: filtros.resultado ?? "",
  });
}

export async function consultarAuditoriaAction(
  filtros: FiltrosAuditoria,
  pagina = 1,
  tamano = 10,
) {
  const validacion = validarFiltros(filtros);
  if (!validacion.success) {
    return { error: validacion.error.issues[0]?.message ?? "Filtros no válidos." };
  }
  return conAuditoria("consultarAuditoriaAction", () =>
    repoAuditoriaApi.listar(aFiltros(validacion.data), pagina, tamano),
  );
}

export async function obtenerDetalleAuditoriaAction(id: string) {
  return conAuditoria("obtenerDetalleAuditoriaAction", () => repoAuditoriaApi.detalle(id));
}

export async function getOpcionesAuditoriaAction() {
  return conAuditoria("getOpcionesAuditoriaAction", () => repoAuditoriaApi.opciones());
}

export async function consultarIncidentesAction(
  filtros: FiltrosAuditoria,
  pagina = 1,
  tamano = 10,
) {
  const validacion = validarFiltros(filtros);
  if (!validacion.success) {
    return { error: validacion.error.issues[0]?.message ?? "Filtros no válidos." };
  }
  return conAuditoria("consultarIncidentesAction", () =>
    repoAuditoriaApi.incidentes(aFiltros(validacion.data), pagina, tamano),
  );
}
