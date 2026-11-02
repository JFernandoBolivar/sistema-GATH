"use server";

/**
 * Server Actions para Familiares (Regla R7).
 * Zero-trust: se revalida la entrada con el schema Zod antes de invocar el
 * caso de uso. Captura errores y llama `handleSessionExpired` (R7) y registra
 * la auditoría en `logs/frontend/audit_frontend.txt` (D-04/C-5).
 */
import { z } from "zod";

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
  subirDocumentoFamiliar,
} from "../../application/use-cases/listar-familiares";
import { listarCatalogosFamiliar } from "../../application/use-cases/listar-catalogos-familiar";
import { listarCatalogoDependienteFamiliar } from "../../application/use-cases/listar-catalogo-dependiente-familiar";
import { resolverAltasInlineFamiliar } from "../../application/use-cases/resolver-altas-inline-familiar";
import { repoFamiliaresApi } from "../repositories/repo-familiares-api";
import { repoCatalogosDependientesFamiliarApi } from "../repositories/repo-catalogos-dependientes-familiar-api";
import { repoCatalogosAltaInlineFamiliarApi } from "../repositories/repo-catalogos-alta-inline-familiar-api";
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

export async function getCatalogosFamiliarAction() {
  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await listarCatalogosFamiliar(repoFamiliaresApi);
    await logAudit({ traceId, action: "getCatalogosFamiliarAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "getCatalogosFamiliarAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    throw error;
  }
}

const catalogoDependienteFamiliarSchema = z.object({
  tipo: z.enum(["carreras", "menciones"]),
  padreId: z.number().int().positive(),
});

/** Cascada de catálogos académicos del mini-expediente del familiar (Nivel -> Carrera -> Mención). */
export async function getCatalogoDependienteFamiliarAction(
  tipo: z.infer<typeof catalogoDependienteFamiliarSchema>["tipo"],
  padreId: number,
) {
  const validation = catalogoDependienteFamiliarSchema.safeParse({ tipo, padreId });
  if (!validation.success) return [];

  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await listarCatalogoDependienteFamiliar(
      repoCatalogosDependientesFamiliarApi,
      validation.data.tipo,
      validation.data.padreId,
    );
    await logAudit({ traceId, action: "getCatalogoDependienteFamiliarAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "getCatalogoDependienteFamiliarAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    throw error;
  }
}

const altasInlineFamiliarSchema = z
  .array(
    z.object({
      tipo: z.enum(["carreras", "menciones", "instituciones"]),
      nombre: z.string().trim().min(1).max(200),
      padreId: z.number().int().positive().nullable().optional(),
    }),
  )
  .max(20);

/**
 * Resuelve las opciones "Otra X" del mini-expediente del familiar (carrera,
 * mención o institución nueva): devuelve, en el mismo orden, el registro
 * existente con ese nombre o el recién creado.
 */
export async function resolverAltasInlineFamiliarAction(solicitudes: z.infer<typeof altasInlineFamiliarSchema>) {
  const validation = altasInlineFamiliarSchema.safeParse(solicitudes);
  if (!validation.success) {
    return { error: "Revise los nombres escritos en las opciones \"Otra\"." };
  }
  if (validation.data.length === 0) return { ok: [] };

  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await resolverAltasInlineFamiliar(repoCatalogosAltaInlineFamiliarApi, validation.data);
    await logAudit({ traceId, action: "resolverAltasInlineFamiliarAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return { ok: result };
  } catch (error) {
    await logAudit({ traceId, action: "resolverAltasInlineFamiliarAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    return { error: error instanceof Error && error.message ? error.message : "No fue posible registrar la opción \"Otra\"." };
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

const TAMANO_MAXIMO_DOCUMENTO_BYTES = 5 * 1024 * 1024; // 5MB, mismo límite que la foto del empleado en Personal.

const subirDocumentoFamiliarSchema = z.object({
  familiarId: z.number().int().positive({ message: "Familiar inválido" }),
  tipoDocumento: z.enum(["cedula", "partida_nacimiento"]),
});

/** Sube el documento de cédula o partida de nacimiento de un familiar (multipart). */
export async function subirDocumentoFamiliarAction(familiarId: number, tipoDocumento: "cedula" | "partida_nacimiento", archivo: File) {
  const validation = subirDocumentoFamiliarSchema.safeParse({ familiarId, tipoDocumento });
  if (!validation.success) {
    return { error: "Familiar o tipo de documento inválido." };
  }
  if (!(archivo instanceof File) || archivo.size === 0) {
    return { error: "Seleccione un archivo válido." };
  }
  if (archivo.size > TAMANO_MAXIMO_DOCUMENTO_BYTES) {
    return { error: "El tamaño máximo del archivo es 5MB." };
  }

  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await subirDocumentoFamiliar(repoFamiliaresApi, validation.data.familiarId, validation.data.tipoDocumento, archivo);
    await logAudit({ traceId, action: "subirDocumentoFamiliarAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "subirDocumentoFamiliarAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    return { error: error instanceof Error && error.message ? error.message : "No fue posible subir el documento." };
  }
}
