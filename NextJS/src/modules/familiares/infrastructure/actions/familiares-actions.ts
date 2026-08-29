"use server";

/**
 * Server Actions para Familiares (Regla R7).
 * Zero-trust: se revalida la entrada con el schema Zod antes de invocar el
 * caso de uso. Captura errores y llama `handleSessionExpired` (R7) y registra
 * la auditoría en `logs/frontend/audit_frontend.txt` (D-04/C-5).
 */
import { generateTraceId } from "@/shared/infrastructure/logging/trace-context";
import { logAudit } from "@/shared/infrastructure/logging/logger-server";
import { handleSessionExpired } from "@/shared/infrastructure/http/errors";
import type { GuardarFamiliarInputDTO } from "../../application/dtos/familiar-dto";
import {
  actualizarFamiliar,
  crearFamiliar,
  eliminarFamiliar,
} from "../../application/use-cases/gestionar-familiar";
import {
  listarDocumentosFamiliar,
  listarFamiliaresPorEmpleado,
} from "../../application/use-cases/listar-familiares";
import { repoFamiliaresApi } from "../repositories/repo-familiares-api";
import { familiaresPorEmpleadoSchema, familiarIdSchema, familiarSchema } from "../../ui/schema/schema-familiar";

export async function getFamiliaresPorEmpleadoAction(cedula: string) {
  const validation = familiaresPorEmpleadoSchema.safeParse({ cedula });
  if (!validation.success) {
    return { error: "Cédula del empleado inválida." };
  }

  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await listarFamiliaresPorEmpleado(repoFamiliaresApi, validation.data.cedula);
    await logAudit({ traceId, action: "getFamiliaresPorEmpleadoAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "getFamiliaresPorEmpleadoAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    throw error;
  }
}

export async function crearFamiliarAction(input: GuardarFamiliarInputDTO) {
  const validation = familiarSchema.safeParse(input);
  if (!validation.success) {
    return { error: "Datos del familiar inválidos. Revise los campos ingresados." };
  }

  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await crearFamiliar(repoFamiliaresApi, validation.data);
    await logAudit({ traceId, action: "crearFamiliarAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "crearFamiliarAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    throw error;
  }
}

export async function actualizarFamiliarAction(
  id: number,
  data: Partial<GuardarFamiliarInputDTO>
) {
  const idValido = familiarIdSchema.safeParse({ familiarId: id });
  const dataValida = familiarSchema.partial().safeParse(data);
  if (!idValido.success || !dataValida.success) {
    return { error: "Datos del familiar inválidos. Revise los campos ingresados." };
  }

  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await actualizarFamiliar(repoFamiliaresApi, idValido.data.familiarId, dataValida.data);
    await logAudit({ traceId, action: "actualizarFamiliarAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "actualizarFamiliarAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    throw error;
  }
}

export async function eliminarFamiliarAction(id: number) {
  const validation = familiarIdSchema.safeParse({ familiarId: id });
  if (!validation.success) {
    return { error: "Familiar inválido." };
  }

  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    await eliminarFamiliar(repoFamiliaresApi, validation.data.familiarId);
    await logAudit({ traceId, action: "eliminarFamiliarAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return { success: true };
  } catch (error) {
    await logAudit({ traceId, action: "eliminarFamiliarAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    throw error;
  }
}

export async function getDocumentosFamiliarAction(familiarId: number) {
  const validation = familiarIdSchema.safeParse({ familiarId });
  if (!validation.success) {
    return { error: "Familiar inválido." };
  }

  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await listarDocumentosFamiliar(repoFamiliaresApi, validation.data.familiarId);
    await logAudit({ traceId, action: "getDocumentosFamiliarAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "getDocumentosFamiliarAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    throw error;
  }
}
