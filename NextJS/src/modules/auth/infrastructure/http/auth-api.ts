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
export const AUTH_LOGOUT_PATH = "api/v1/identidad/auth/logout/";
export const AUTH_CAMBIAR_PASSWORD_PATH = "api/v1/identidad/auth/cambiar-password/";
export const AUTH_SOLICITAR_RECUPERACION_PATH = "api/v1/identidad/auth/solicitar-recuperacion/";
export const AUTH_RESTABLECER_PASSWORD_PATH = "api/v1/identidad/auth/restablecer-password/";

/** POST al endpoint de autenticación; devuelve el `data` del sobre C-1. */
export async function postLogin(credenciales: {
  usuario: string;
  password: string;
}): Promise<SesionBackendPayload> {
  const envelope = await apiClient.post<ApiResponse<SesionBackendPayload>>(AUTH_LOGIN_PATH, {
    usuario: credenciales.usuario.trim(),
    correo: credenciales.usuario.trim(),
    cedula: credenciales.usuario.trim(),
    password: credenciales.password,
  });
  return envelope.data;
}

/**
 * POST al endpoint de logout. El backend blacklistea el refresh token leído
 * de la cookie `dj_refresh` de la petición; como esta llamada viaja
 * autenticada por `Authorization: Bearer` (patrón de `apiClient`, igual que
 * el resto de la app) y no reenvía esa cookie, el backend simplemente no
 * blacklistea un token puntual (`cerrar_sesion(None)`, documentado como
 * best-effort) — la sesión igual queda cerrada porque quien llama borra sus
 * propias cookies `dj_access`/`dj_refresh` y hace `signOut()` de inmediato.
 */
export async function postLogout(): Promise<void> {
  await apiClient.post<ApiResponse<null>>(AUTH_LOGOUT_PATH, {});
}

/** POST al endpoint de cambio de contraseña; devuelve el mensaje del backend. */
export async function postCambiarPassword(input: {
  passwordActual: string;
  passwordNuevo: string;
}): Promise<string> {
  const envelope = await apiClient.post<ApiResponse<null>>(AUTH_CAMBIAR_PASSWORD_PATH, {
    password_actual: input.passwordActual,
    password_nuevo: input.passwordNuevo,
  });
  return envelope.message;
}

/** POST al endpoint de solicitud de recuperación de contraseña (público, con skipAuth). */
export async function postSolicitarRecuperacion(identificador: string): Promise<string> {
  const frontendUrl =
    typeof window !== "undefined" ? window.location.origin : process.env.NEXTAUTH_URL;
  if (!frontendUrl) {
    throw new Error("Falta NEXTAUTH_URL: no se puede construir el enlace de recuperación.");
  }

  const envelope = await apiClient.post<ApiResponse<null>>(
    AUTH_SOLICITAR_RECUPERACION_PATH,
    { identificador, frontend_url: frontendUrl },
    { skipAuth: true },
  );
  return envelope.message;
}

/** POST al endpoint de restablecimiento de contraseña (público, con skipAuth). */
export async function postRestablecerPassword(input: {
  token: string;
  passwordNuevo: string;
  passwordConfirmacion: string;
}): Promise<string> {
  const envelope = await apiClient.post<ApiResponse<null>>(
    AUTH_RESTABLECER_PASSWORD_PATH,
    {
      token: input.token,
      password_nuevo: input.passwordNuevo,
      password_confirmacion: input.passwordConfirmacion,
    },
    { skipAuth: true },
  );
  return envelope.message;
}
