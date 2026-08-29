"use server";

/**
 * Server Actions para Organización (Regla R7).
 * Zero-trust: se revalida la entrada con el schema Zod antes de invocar el
 * caso de uso. Captura errores y llama `handleSessionExpired` (R7) y registra
 * la auditoría en `logs/frontend/audit_frontend.txt` (D-04/C-5).
 */
import { generateTraceId } from "@/shared/infrastructure/logging/trace-context";
import { logAudit } from "@/shared/infrastructure/logging/logger-server";
import { handleSessionExpired } from "@/shared/infrastructure/http/errors";
import {
  listarCoordinaciones,
  listarDependencias,
  listarDireccionesGenerales,
  listarDireccionesLinea,
  listarOrganismosAdscritos,
} from "../../application/use-cases/listar-organizacion";
import { repoOrganizacionApi } from "../repositories/repo-organizacion-api";
import { organizacionFilterSchema } from "../../ui/schema/schema-organizacion";

export async function getDependenciasAction() {
  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await listarDependencias(repoOrganizacionApi);
    await logAudit({ traceId, action: "getDependenciasAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "getDependenciasAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    throw error;
  }
}

export async function getDireccionesGeneralesAction(dependenciaId?: number) {
  const validated = organizacionFilterSchema.safeParse({ dependenciaId });
  const id = validated.success ? validated.data.dependenciaId ?? undefined : undefined;

  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await listarDireccionesGenerales(repoOrganizacionApi, id);
    await logAudit({ traceId, action: "getDireccionesGeneralesAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "getDireccionesGeneralesAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    throw error;
  }
}

export async function getDireccionesLineaAction(direccionGeneralId?: number) {
  const validated = organizacionFilterSchema.safeParse({ direccionGeneralId });
  const id = validated.success ? validated.data.direccionGeneralId ?? undefined : undefined;

  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await listarDireccionesLinea(repoOrganizacionApi, id);
    await logAudit({ traceId, action: "getDireccionesLineaAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "getDireccionesLineaAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    throw error;
  }
}

export async function getCoordinacionesAction(direccionLineaId?: number) {
  const validated = organizacionFilterSchema.safeParse({ direccionLineaId });
  const id = validated.success ? validated.data.direccionLineaId ?? undefined : undefined;

  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await listarCoordinaciones(repoOrganizacionApi, id);
    await logAudit({ traceId, action: "getCoordinacionesAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "getCoordinacionesAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    throw error;
  }
}

export async function getOrganismosAdscritosAction() {
  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await listarOrganismosAdscritos(repoOrganizacionApi);
    await logAudit({ traceId, action: "getOrganismosAdscritosAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "getOrganismosAdscritosAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    throw error;
  }
}
