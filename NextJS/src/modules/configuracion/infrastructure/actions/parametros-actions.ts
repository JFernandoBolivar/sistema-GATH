/**
 * Server Actions de parámetros del sistema (D9). Zero-trust: se revalida la
 * entrada con Zod antes de invocar el caso de uso; los errores de sesión pasan
 * por `handleSessionExpired` y cada llamada deja traza de auditoría de frontend.
 */
"use server";

import { generateTraceId } from "@/shared/infrastructure/logging/trace-context";
import { logAudit } from "@/shared/infrastructure/logging/logger-server";
import { handleSessionExpired } from "@/shared/infrastructure/http/errors";
import {
  actualizarParametro,
  diasRecordatorioFeDeVida,
  historialParametro,
  listarParametros,
} from "../../application/use-cases/gestionar-parametros";
import { repoParametrosApi } from "../repositories/repo-parametros-api";
import { valorParametroSchema } from "../../ui/schema/schema-parametros";

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
          : "No fue posible completar la operación de configuración.",
    };
  }
}

export async function listarParametrosAction() {
  return conAuditoria("listarParametrosAction", () =>
    listarParametros(repoParametrosApi),
  );
}

export async function actualizarParametroAction(clave: string, valor: string) {
  const validacion = valorParametroSchema.safeParse({ valor });
  if (!validacion.success) {
    return { error: "El valor del parámetro no es válido." };
  }
  return conAuditoria("actualizarParametroAction", () =>
    actualizarParametro(repoParametrosApi, clave, validacion.data.valor),
  );
}

export async function historialParametroAction(
  clave: string,
  pagina?: number,
  tamano?: number,
) {
  return conAuditoria("historialParametroAction", () =>
    historialParametro(repoParametrosApi, clave, pagina, tamano),
  );
}

export async function getDiasRecordatorioSugeridosAction() {
  return conAuditoria("getDiasRecordatorioSugeridosAction", () =>
    diasRecordatorioFeDeVida(repoParametrosApi),
  );
}
