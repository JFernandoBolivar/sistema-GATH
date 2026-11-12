/**
 * Server Actions del restablecimiento de contraseñas en bloque (U2). Zero-trust: se
 * revalida con Zod; el permiso (solo superadministrador) lo exige el backend. Devuelven
 * `{ error, status }` para que la UI distinga 403 (sin permiso) y 409 (el número cambió).
 */
"use server";

import { unstable_rethrow } from "next/navigation";
import { generateTraceId } from "@/shared/infrastructure/logging/trace-context";
import { logAudit } from "@/shared/infrastructure/logging/logger-server";
import { ApiHttpError, handleSessionExpired } from "@/shared/infrastructure/http/errors";
import {
  calcularRestablecimientoBloque,
  consultarRestablecimientoBloque,
  descargarExcelRestablecimientoBloque,
  ejecutarRestablecimientoBloque,
} from "../../application/use-cases/restablecer-acceso-bloque";
import { repoRestablecimientoBloqueApi } from "../repositories/repo-restablecimiento-bloque-api";
import {
  ejecutarBloqueSchema,
  solicitudBloqueSchema,
} from "../../ui/schema/schema-restablecimiento-bloque";

export interface ErrorBloque {
  error: string;
  status?: number;
  errores?: Record<string, string[]>;
}

async function conAuditoria<T>(
  accion: string,
  operacion: () => Promise<T>,
): Promise<T | ErrorBloque> {
  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const resultado = await operacion();
    await logAudit({ traceId, action: accion, status: "SUCCESS", durationMs: Date.now() - startedAt });
    return resultado;
  } catch (error) {
    unstable_rethrow(error);
    await logAudit({ traceId, action: accion, status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    if (error instanceof ApiHttpError) {
      return { error: error.message, status: error.status, errores: error.errores };
    }
    return {
      error:
        error instanceof Error && error.message
          ? error.message
          : "No fue posible completar la operación.",
    };
  }
}

export async function calcularRestablecimientoBloqueAction(entrada: unknown) {
  const valida = solicitudBloqueSchema.safeParse(entrada);
  if (!valida.success) {
    return { error: valida.error.issues[0]?.message ?? "Datos no válidos.", status: 400 } as ErrorBloque;
  }
  return conAuditoria("calcularRestablecimientoBloqueAction", () =>
    calcularRestablecimientoBloque(repoRestablecimientoBloqueApi, valida.data),
  );
}

export async function ejecutarRestablecimientoBloqueAction(entrada: unknown) {
  const valida = ejecutarBloqueSchema.safeParse(entrada);
  if (!valida.success) {
    return { error: valida.error.issues[0]?.message ?? "Datos no válidos.", status: 400 } as ErrorBloque;
  }
  const { confirmacion, ...solicitud } = valida.data;
  return conAuditoria("ejecutarRestablecimientoBloqueAction", () =>
    ejecutarRestablecimientoBloque(repoRestablecimientoBloqueApi, solicitud, confirmacion),
  );
}

export async function descargarExcelRestablecimientoBloqueAction(entrada: unknown) {
  const valida = solicitudBloqueSchema.safeParse(entrada);
  if (!valida.success) {
    return { error: valida.error.issues[0]?.message ?? "Datos no válidos.", status: 400 } as ErrorBloque;
  }
  return conAuditoria("descargarExcelRestablecimientoBloqueAction", () =>
    descargarExcelRestablecimientoBloque(repoRestablecimientoBloqueApi, valida.data),
  );
}

export async function estadoRestablecimientoBloqueAction(taskId: string) {
  if (typeof taskId !== "string" || taskId.length === 0 || taskId.length > 100) {
    return { error: "Identificador de tarea no válido.", status: 400 } as ErrorBloque;
  }
  return conAuditoria("estadoRestablecimientoBloqueAction", () =>
    consultarRestablecimientoBloque(repoRestablecimientoBloqueApi, taskId),
  );
}
