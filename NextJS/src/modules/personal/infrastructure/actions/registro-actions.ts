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
