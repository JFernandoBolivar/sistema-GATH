/**
 * Llamadas HTTP del módulo auth (paso 9 del checklist §II.8). Único punto donde
 * se define la ruta del login — ninguna otra capa hardcodea endpoints.
 *
 * F3.7: `authorize()` en `auth.config.ts` es el único ejecutor HTTP de login.
 * Este módulo se mantiene para consumo directo desde la capa de infraestructura
 * (repo-auth-api) cuando se necesite llamar al login sin pasar por NextAuth.
 */
import { apiClient } from "@/shared/infrastructure/http/fetcher-api";
import type { ApiResponse } from "@/shared/types/api-response";
import type { SesionBackendPayload } from "../mappers/mapper-sesion";

export const AUTH_LOGIN_PATH = "api/v1/identidad/auth/login/";

/** POST al endpoint de autenticación; devuelve el `data` del sobre C-1. */
export async function postLogin(
  credenciales: { usuario: string; password: string },
): Promise<SesionBackendPayload> {
  const envelope = await apiClient.post<ApiResponse<SesionBackendPayload>>(AUTH_LOGIN_PATH, {
    correo: credenciales.usuario,
    password: credenciales.password,
  });
  return envelope.data;
}
