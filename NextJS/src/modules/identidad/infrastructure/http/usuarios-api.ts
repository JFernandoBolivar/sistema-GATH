/**
 * Llamadas HTTP del módulo identidad (paso 9 del checklist §II.8). Único punto
 * que define la ruta del listado de usuarios.
 *
 * TODO(B3/F3): el backend aún no publica /api/v1/identidad/usuarios/; la ruta
 * canónica queda definida aquí para reapuntar con un solo cambio cuando el
 * módulo B3 (Identidad) esté desplegado (hito H-2).
 */
import { apiClient } from "@/shared/infrastructure/http/fetcher-api";
import { queryParams } from "@/shared/infrastructure/http/query-params";
import type { ApiResponse } from "@/shared/types/api-response";
import type { UsuariosFiltros } from "../../domain/ports/repo-usuarios";
import type { UsuarioBackendPayload } from "../mappers/mapper-usuario";

export const USUARIOS_PATH = "api/v1/identidad/usuarios/";

/** GET del listado de usuarios; devuelve las filas crudas del sobre C-1. */
export async function getUsuarios(filtros?: UsuariosFiltros): Promise<UsuarioBackendPayload[]> {
  const qs = queryParams({ busqueda: filtros?.busqueda });
  const envelope = await apiClient.get<ApiResponse<UsuarioBackendPayload[]>>(`${USUARIOS_PATH}${qs}`);
  return envelope.data;
}
