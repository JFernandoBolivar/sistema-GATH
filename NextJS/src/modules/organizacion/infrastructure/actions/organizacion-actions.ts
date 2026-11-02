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
import {
  actualizarCoordinacion,
  actualizarDependencia,
  actualizarDireccionGeneral,
  actualizarDireccionLinea,
  actualizarOrganismoAdscrito,
  crearCoordinacion,
  crearDependencia,
  crearDireccionGeneral,
  crearDireccionLinea,
  crearOrganismoAdscrito,
  eliminarCoordinacion,
  eliminarDependencia,
  eliminarDireccionGeneral,
  eliminarDireccionLinea,
  eliminarOrganismoAdscrito,
} from "../../application/use-cases/gestionar-organizacion";
import { repoOrganizacionApi } from "../repositories/repo-organizacion-api";
import {
  coordinacionSchema,
  dependenciaSchema,
  direccionGeneralSchema,
  direccionLineaSchema,
  hierarchyDependencySchema,
  type HierarchyDependencyFormType,
  organismoAdscritoSchema,
  organizacionFilterSchema,
  organizacionIdSchema,
} from "../../ui/schema/schema-organizacion";

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

export async function crearDependenciaAction(input: { codigo: string; nombre: string }) {
  const validation = dependenciaSchema.safeParse(input);
  if (!validation.success) {
    return { error: "Datos de la dependencia inválidos. Revise los campos ingresados." };
  }

  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await crearDependencia(repoOrganizacionApi, validation.data);
    await logAudit({ traceId, action: "crearDependenciaAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "crearDependenciaAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    throw error;
  }
}

export async function actualizarDependenciaAction(id: number, input: { codigo: string; nombre: string }) {
  const idValido = organizacionIdSchema.safeParse({ id });
  const dataValida = dependenciaSchema.safeParse(input);
  if (!idValido.success || !dataValida.success) {
    return { error: "Datos de la dependencia inválidos. Revise los campos ingresados." };
  }

  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await actualizarDependencia(repoOrganizacionApi, idValido.data.id, dataValida.data);
    await logAudit({ traceId, action: "actualizarDependenciaAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "actualizarDependenciaAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    throw error;
  }
}

export async function eliminarDependenciaAction(id: number) {
  const validation = organizacionIdSchema.safeParse({ id });
  if (!validation.success) {
    return { error: "Dependencia inválida." };
  }

  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    await eliminarDependencia(repoOrganizacionApi, validation.data.id);
    await logAudit({ traceId, action: "eliminarDependenciaAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return { success: true as const };
  } catch (error) {
    await logAudit({ traceId, action: "eliminarDependenciaAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    throw error;
  }
}

export async function crearDireccionGeneralAction(input: { codigo: string; nombre: string; dependenciaId: number | null }) {
  const validation = direccionGeneralSchema.safeParse(input);
  if (!validation.success) {
    return { error: "Datos de la dirección general inválidos. Revise los campos ingresados." };
  }

  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await crearDireccionGeneral(repoOrganizacionApi, validation.data);
    await logAudit({ traceId, action: "crearDireccionGeneralAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "crearDireccionGeneralAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    throw error;
  }
}

export async function actualizarDireccionGeneralAction(id: number, input: { codigo: string; nombre: string; dependenciaId: number | null }) {
  const idValido = organizacionIdSchema.safeParse({ id });
  const dataValida = direccionGeneralSchema.safeParse(input);
  if (!idValido.success || !dataValida.success) {
    return { error: "Datos de la dirección general inválidos. Revise los campos ingresados." };
  }

  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await actualizarDireccionGeneral(repoOrganizacionApi, idValido.data.id, dataValida.data);
    await logAudit({ traceId, action: "actualizarDireccionGeneralAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "actualizarDireccionGeneralAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    throw error;
  }
}

export async function eliminarDireccionGeneralAction(id: number) {
  const validation = organizacionIdSchema.safeParse({ id });
  if (!validation.success) {
    return { error: "Dirección general inválida." };
  }

  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    await eliminarDireccionGeneral(repoOrganizacionApi, validation.data.id);
    await logAudit({ traceId, action: "eliminarDireccionGeneralAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return { success: true as const };
  } catch (error) {
    await logAudit({ traceId, action: "eliminarDireccionGeneralAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    throw error;
  }
}

export async function crearDireccionLineaAction(input: { codigo: string; nombre: string; direccionGeneralId: number | null }) {
  const validation = direccionLineaSchema.safeParse(input);
  if (!validation.success) {
    return { error: "Datos de la dirección de línea inválidos. Revise los campos ingresados." };
  }

  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await crearDireccionLinea(repoOrganizacionApi, validation.data);
    await logAudit({ traceId, action: "crearDireccionLineaAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "crearDireccionLineaAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    throw error;
  }
}

export async function actualizarDireccionLineaAction(id: number, input: { codigo: string; nombre: string; direccionGeneralId: number | null }) {
  const idValido = organizacionIdSchema.safeParse({ id });
  const dataValida = direccionLineaSchema.safeParse(input);
  if (!idValido.success || !dataValida.success) {
    return { error: "Datos de la dirección de línea inválidos. Revise los campos ingresados." };
  }

  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await actualizarDireccionLinea(repoOrganizacionApi, idValido.data.id, dataValida.data);
    await logAudit({ traceId, action: "actualizarDireccionLineaAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "actualizarDireccionLineaAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    throw error;
  }
}

export async function eliminarDireccionLineaAction(id: number) {
  const validation = organizacionIdSchema.safeParse({ id });
  if (!validation.success) {
    return { error: "Dirección de línea inválida." };
  }

  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    await eliminarDireccionLinea(repoOrganizacionApi, validation.data.id);
    await logAudit({ traceId, action: "eliminarDireccionLineaAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return { success: true as const };
  } catch (error) {
    await logAudit({ traceId, action: "eliminarDireccionLineaAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    throw error;
  }
}

export async function crearCoordinacionAction(input: { codigo: string; nombre: string; direccionLineaId: number | null }) {
  const validation = coordinacionSchema.safeParse(input);
  if (!validation.success) {
    return { error: "Datos de la coordinación inválidos. Revise los campos ingresados." };
  }

  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await crearCoordinacion(repoOrganizacionApi, validation.data);
    await logAudit({ traceId, action: "crearCoordinacionAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "crearCoordinacionAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    throw error;
  }
}

export async function actualizarCoordinacionAction(id: number, input: { codigo: string; nombre: string; direccionLineaId: number | null }) {
  const idValido = organizacionIdSchema.safeParse({ id });
  const dataValida = coordinacionSchema.safeParse(input);
  if (!idValido.success || !dataValida.success) {
    return { error: "Datos de la coordinación inválidos. Revise los campos ingresados." };
  }

  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await actualizarCoordinacion(repoOrganizacionApi, idValido.data.id, dataValida.data);
    await logAudit({ traceId, action: "actualizarCoordinacionAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "actualizarCoordinacionAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    throw error;
  }
}

export async function eliminarCoordinacionAction(id: number) {
  const validation = organizacionIdSchema.safeParse({ id });
  if (!validation.success) {
    return { error: "Coordinación inválida." };
  }

  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    await eliminarCoordinacion(repoOrganizacionApi, validation.data.id);
    await logAudit({ traceId, action: "eliminarCoordinacionAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return { success: true as const };
  } catch (error) {
    await logAudit({ traceId, action: "eliminarCoordinacionAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    throw error;
  }
}

export async function crearOrganismoAdscritoAction(input: { nombre: string; parentId: number | null }) {
  const validation = organismoAdscritoSchema.safeParse(input);
  if (!validation.success) {
    return { error: "Datos del organismo adscrito inválidos. Revise los campos ingresados." };
  }

  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await crearOrganismoAdscrito(repoOrganizacionApi, validation.data);
    await logAudit({ traceId, action: "crearOrganismoAdscritoAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "crearOrganismoAdscritoAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    throw error;
  }
}

export async function actualizarOrganismoAdscritoAction(id: number, input: { nombre: string; parentId: number | null }) {
  const idValido = organizacionIdSchema.safeParse({ id });
  const dataValida = organismoAdscritoSchema.safeParse(input);
  if (!idValido.success || !dataValida.success) {
    return { error: "Datos del organismo adscrito inválidos. Revise los campos ingresados." };
  }

  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await actualizarOrganismoAdscrito(repoOrganizacionApi, idValido.data.id, dataValida.data);
    await logAudit({ traceId, action: "actualizarOrganismoAdscritoAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "actualizarOrganismoAdscritoAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    throw error;
  }
}

export async function eliminarOrganismoAdscritoAction(id: number) {
  const validation = organizacionIdSchema.safeParse({ id });
  if (!validation.success) {
    return { error: "Organismo adscrito inválido." };
  }

  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    await eliminarOrganismoAdscrito(repoOrganizacionApi, validation.data.id);
    await logAudit({ traceId, action: "eliminarOrganismoAdscritoAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return { success: true as const };
  } catch (error) {
    await logAudit({ traceId, action: "eliminarOrganismoAdscritoAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    throw error;
  }
}

/**
 * Creación en cascada de una dependencia y opcionalmente sus niveles subordinados
 * (Dirección General, Dirección de Línea, Coordinación), con paridad al flujo legado.
 */
export async function crearJerarquiaDependenciaAction(input: HierarchyDependencyFormType) {
  const validation = hierarchyDependencySchema.safeParse(input);
  if (!validation.success) {
    return { error: "Datos del formulario inválidos. Revise los campos requeridos." };
  }

  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const {
      dependency,
      direction_general,
      direction_line,
      coordination,
      activeDirectionGeneral,
      activeDirectionLine,
      activeCoordination,
    } = validation.data;

    // 1. Crear dependencia raíz
    const depCreada = await crearDependencia(repoOrganizacionApi, {
      codigo: dependency.codigo,
      nombre: dependency.nombre,
    });

    // 2. Si se activó Dirección General
    if (activeDirectionGeneral && direction_general?.codigo && direction_general?.nombre) {
      const dgCreada = await crearDireccionGeneral(repoOrganizacionApi, {
        codigo: direction_general.codigo,
        nombre: direction_general.nombre,
        dependenciaId: depCreada.id,
      });

      // 3. Si se activó Dirección de Línea
      if (activeDirectionLine && direction_line?.codigo && direction_line?.nombre) {
        const dlCreada = await crearDireccionLinea(repoOrganizacionApi, {
          codigo: direction_line.codigo,
          nombre: direction_line.nombre,
          direccionGeneralId: dgCreada.id,
        });

        // 4. Si se activó Coordinación
        if (activeCoordination && coordination?.codigo && coordination?.nombre) {
          await crearCoordinacion(repoOrganizacionApi, {
            codigo: coordination.codigo,
            nombre: coordination.nombre,
            direccionLineaId: dlCreada.id,
          });
        }
      }
    }

    await logAudit({ traceId, action: "crearJerarquiaDependenciaAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return { success: true as const, message: "Dependencia creada exitosamente." };
  } catch (error) {
    await logAudit({ traceId, action: "crearJerarquiaDependenciaAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    throw error;
  }
}

