"use server";

/**
 * Server Actions para Movimientos (Regla R7).
 * Zero-trust: se revalida la entrada antes de invocar el caso de uso; se
 * capturan errores con `handleSessionExpired` (R7) y se registra la auditoría
 * en `logs/frontend/audit_frontend.txt` (D-04/C-5).
 */
import { generateTraceId } from "@/shared/infrastructure/logging/trace-context";
import { logAudit } from "@/shared/infrastructure/logging/logger-server";
import { handleSessionExpired } from "@/shared/infrastructure/http/errors";
import {
  listarHistorialPorCargo,
  listarHistorialPorEmpleado,
} from "../../application/use-cases/listar-movimientos";
import { repoMovimientosApi } from "../repositories/repo-movimientos-api";
import { historialCargoSchema, historialEmpleadoSchema } from "../../ui/schema/schema-historial";

export async function getHistorialPorEmpleadoAction(cedula: string) {
  const validation = historialEmpleadoSchema.safeParse({ empleadoCedula: cedula });
  if (!validation.success) {
    return { error: "Cédula inválida. Revise el formato ingresado." };
  }

  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await listarHistorialPorEmpleado(repoMovimientosApi, validation.data.empleadoCedula);
    await logAudit({ traceId, action: "getHistorialPorEmpleadoAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "getHistorialPorEmpleadoAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    throw error;
  }
}

export async function getHistorialPorCargoAction(codigoPuesto: string) {
  const validation = historialCargoSchema.safeParse({ codigoPuesto });
  if (!validation.success) {
    return { error: "Código de puesto inválido. Revise el formato ingresado." };
  }

  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    crearCodigoPuestoVO(validation.data.codigoPuesto);
    const result = await listarHistorialPorCargo(repoMovimientosApi, validation.data.codigoPuesto);
    await logAudit({ traceId, action: "getHistorialPorCargoAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "getHistorialPorCargoAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    throw error;
  }
}
