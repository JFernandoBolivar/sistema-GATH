"use server";

/**
 * Server Actions del módulo identidad (paso 11 del checklist §II.8).
 * Zero-trust: los filtros que llegan del cliente se re-validan con el schema
 * Zod antes de invocar el caso de uso. Captura errores y llama
 * `handleSessionExpired` (R7); registra auditoría en
 * `logs/frontend/audit_frontend.txt` (D-04/C-5). S17: no se registran PII.
 */
import { generateTraceId } from "@/shared/infrastructure/logging/trace-context";
import { logAudit } from "@/shared/infrastructure/logging/logger-server";
import { handleSessionExpired } from "@/shared/infrastructure/http/errors";
import { repoUsuariosApi } from "../repositories/repo-usuarios-api";
import { listarUsuarios } from "../../application/use-cases/listar-usuarios";
import {
  usuariosFiltrosSchema,
  type UsuariosFiltrosType,
} from "../../ui/schema/schema-usuario";

/**
 * Lista usuarios para la pantalla `usuarios-page`. Lanza el error tras manejar
 * la sesión expirada; SWR lo refleja como estado de error en el cliente.
 */
export async function listarUsuariosAction(
  rawFiltros?: unknown,
): Promise<Awaited<ReturnType<typeof listarUsuarios>>> {
  const parsed = usuariosFiltrosSchema.safeParse(rawFiltros ?? {});
  const filtros: UsuariosFiltrosType = parsed.success ? parsed.data : {};

  const traceId = generateTraceId();
  const startedAt = Date.now();

  try {
    const usuarios = await listarUsuarios(repoUsuariosApi, filtros);
    await logAudit({
      traceId,
      action: "listarUsuariosAction",
      status: "SUCCESS",
      durationMs: Date.now() - startedAt,
    });
    return usuarios;
  } catch (error) {
    await logAudit({
      traceId,
      action: "listarUsuariosAction",
      status: "FAILED",
      durationMs: Date.now() - startedAt,
    });
    handleSessionExpired(error);
    throw error;
  }
}
