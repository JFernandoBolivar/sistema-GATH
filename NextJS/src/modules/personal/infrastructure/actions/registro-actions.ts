"use server";

/**
 * Server Actions de soporte del wizard de registro (`/personal/registrar`)
 * (Regla R7). Zero-trust: se revalidan tipo y padre con Zod antes de invocar
 * el caso de uso; auditoría y `handleSessionExpired` igual que
 * `personal-actions.ts`.
 */
import { z } from "zod";

import { generateTraceId } from "@/shared/infrastructure/logging/trace-context";
import { logAudit } from "@/shared/infrastructure/logging/logger-server";
import { handleSessionExpired } from "@/shared/infrastructure/http/errors";
import { listarCatalogoDependiente } from "../../application/use-cases/listar-catalogo-dependiente";
import { repoCatalogosDependientesApi } from "../repositories/repo-catalogos-dependientes-api";
import { resolverAltasInline } from "../../application/use-cases/resolver-altas-inline";
import { repoCatalogosAltaInlineApi } from "../repositories/repo-catalogos-alta-inline-api";

const catalogoDependienteSchema = z.object({
  tipo: z.enum(["municipios", "parroquias", "codigosPostales", "carreras", "menciones", "tallas"]),
  padreId: z.number().int().positive(),
});

export async function getCatalogoDependienteAction(
  tipo: z.infer<typeof catalogoDependienteSchema>["tipo"],
  padreId: number,
) {
  const validation = catalogoDependienteSchema.safeParse({ tipo, padreId });
  if (!validation.success) return [];

  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await listarCatalogoDependiente(
      repoCatalogosDependientesApi,
      validation.data.tipo,
      validation.data.padreId,
    );
    await logAudit({ traceId, action: "getCatalogoDependienteAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return result;
  } catch (error) {
    await logAudit({ traceId, action: "getCatalogoDependienteAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    throw error;
  }
}

const altasInlineSchema = z
  .array(
    z.object({
      tipo: z.enum(["carreras", "menciones", "instituciones", "capacitaciones"]),
      nombre: z.string().trim().min(1).max(200),
      padreId: z.number().int().positive().nullable().optional(),
    }),
  )
  .max(50);

/**
 * Resuelve las opciones "Otra X" (alta inline de carrera, mención,
 * institución o capacitación): devuelve, en el mismo orden, el registro
 * existente con ese nombre o el recién creado. Errores de negocio o del
 * backend se devuelven como `{ error }` para mostrarlos en un toast.
 */
export async function resolverAltasInlineAction(solicitudes: z.infer<typeof altasInlineSchema>) {
  const validation = altasInlineSchema.safeParse(solicitudes);
  if (!validation.success) {
    return { error: "Revise los nombres escritos en las opciones \"Otra\"." };
  }
  if (validation.data.length === 0) return { ok: [] };

  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await resolverAltasInline(repoCatalogosAltaInlineApi, validation.data);
    await logAudit({ traceId, action: "resolverAltasInlineAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return { ok: result };
  } catch (error) {
    await logAudit({ traceId, action: "resolverAltasInlineAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);
    return { error: error instanceof Error && error.message ? error.message : "No fue posible registrar la opción \"Otra\"." };
  }
}
