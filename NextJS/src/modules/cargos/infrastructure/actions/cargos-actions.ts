"use server";

/**
 * Server Actions para Cargos (Regla R7).
 * Zero-trust: se revalida la entrada con el schema Zod antes de invocar el
 * caso de uso. Captura errores y llama `handleSessionExpired` (R7) y registra
 * la auditoría en `logs/frontend/audit_frontend.txt` (D-04/C-5).
 */
import { generateTraceId } from "@/shared/infrastructure/logging/trace-context";
import { logAudit } from "@/shared/infrastructure/logging/logger-server";
import { handleSessionExpired } from "@/shared/infrastructure/http/errors";
import { asignarCargo, desasignarCargo } from "../../application/use-cases/asignar-cargo";
import { listarCargos, listarDenominaciones } from "../../application/use-cases/listar-cargos";
import { repoCargosApi } from "../repositories/repo-cargos-api";
import { asignarCargoSchema, cargosFiltroSchema, desasignarCargoSchema } from "../../ui/schema/schema-asignar-cargo";

export async function getCargosAction(filtros?: { dependenciaId?: number; soloVacantes?: boolean }) {
  const validated = cargosFiltroSchema.safeParse(filtros ?? {});
  const filtrosValidos = validated.success ? validated.data : {};

  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await listarCargos(repoCargosApi, {
      dependenciaId: filtrosValidos.dependenciaId ?? undefined,
      soloVacantes: filtrosValidos.soloVacantes,
    });
    await logAudit({ traceId, action: "getCargosAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "getCargosAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    throw error;
  }
}

export async function getDenominacionesAction() {
  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await listarDenominaciones(repoCargosApi);
    await logAudit({ traceId, action: "getDenominacionesAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "getDenominacionesAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    throw error;
  }
}

export async function asignarCargoAction(cargoId: number, empleadoCedula: string) {
  const validation = asignarCargoSchema.safeParse({ cargoId, empleadoCedula });
  if (!validation.success) {
    return { error: "Datos de asignación inválidos. Revise los campos ingresados." };
  }

  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await asignarCargo(repoCargosApi, validation.data.cargoId, validation.data.empleadoCedula);
    await logAudit({ traceId, action: "asignarCargoAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "asignarCargoAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    throw error;
  }
}

export async function desasignarCargoAction(cargoId: number) {
  const validation = desasignarCargoSchema.safeParse({ cargoId });
  if (!validation.success) {
    return { error: "Debe seleccionar un cargo válido." };
  }

  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await desasignarCargo(repoCargosApi, validation.data.cargoId);
    await logAudit({ traceId, action: "desasignarCargoAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "desasignarCargoAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    throw error;
  }
}
