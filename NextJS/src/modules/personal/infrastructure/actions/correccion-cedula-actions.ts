/**
 * Server Actions de la corrección de cédula. Zero-trust: se revalida con Zod; el permiso
 * (solo superadministrador) lo exige el backend. Devuelven `{ error, status }` para que la
 * UI distinga 403, 404 y 409.
 */
"use server";

import { unstable_rethrow } from "next/navigation";

import { generateTraceId } from "@/shared/infrastructure/logging/trace-context";
import { logAudit } from "@/shared/infrastructure/logging/logger-server";
import { ApiHttpError, handleSessionExpired } from "@/shared/infrastructure/http/errors";
import {
  ejecutarCorreccionCedula,
  verificarCorreccionCedula,
} from "../../application/use-cases/corregir-cedula";
import { repoCorreccionCedulaApi } from "../repositories/repo-correccion-cedula-api";
import {
  ejecutarCedulaSchema,
  solicitudCedulaSchema,
} from "../../ui/schema/schema-correccion-cedula";

export interface ErrorCorreccionCedula {
  error: string;
  status?: number;
}

async function conAuditoria<T>(
  accion: string,
  operacion: () => Promise<T>,
): Promise<T | ErrorCorreccionCedula> {
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
      return { error: error.message, status: error.status };
    }
    return {
      error:
        error instanceof Error && error.message
          ? error.message
          : "No fue posible completar la operación.",
    };
  }
}

export async function verificarCorreccionCedulaAction(entrada: unknown) {
  const valida = solicitudCedulaSchema.safeParse(entrada);
  if (!valida.success) {
    return {
      error: valida.error.issues[0]?.message ?? "Datos no válidos.",
      status: 400,
    } as ErrorCorreccionCedula;
  }
  return conAuditoria("verificarCorreccionCedulaAction", () =>
    verificarCorreccionCedula(repoCorreccionCedulaApi, valida.data),
  );
}

export async function ejecutarCorreccionCedulaAction(entrada: unknown) {
  const valida = ejecutarCedulaSchema.safeParse(entrada);
  if (!valida.success) {
    return {
      error: valida.error.issues[0]?.message ?? "Datos no válidos.",
      status: 400,
    } as ErrorCorreccionCedula;
  }
  return conAuditoria("ejecutarCorreccionCedulaAction", () =>
    ejecutarCorreccionCedula(repoCorreccionCedulaApi, valida.data),
  );
}
