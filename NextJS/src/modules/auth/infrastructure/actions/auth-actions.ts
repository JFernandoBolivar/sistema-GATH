"use server";

/**
 * Server Actions del módulo auth (paso 11 del checklist §II.8).
 * F3.7: `loginAction` invoca `signIn("credentials")` — authorize() será el
 * único ejecutor HTTP y fijador de cookies dj_access/dj_refresh (ALTA-03, C-2).
 *
 * Zero-trust: revalida la entrada con el mismo schema del formulario antes de
 * tocar el caso de uso. Captura errores y llama `handleSessionExpired` (R7) y
 * registra la auditoría en `logs/frontend/audit_frontend.txt` (D-04/C-5).
 *
 * `cerrarSesionAction`/`cambiarPasswordAction`/`limpiarCookiesAuthAction`
 * cierran el hallazgo #1 de AUDITORIA_COMPLETITUD_ONION_2026-09-12.md: el
 * ciclo de vida completo de la sesión vivía en `NextJS/actions/auth-actions.ts`
 * (raíz, sin capas Onion) pese a que la arquitectura nueva (`app-nav.tsx`,
 * `inicio/page.tsx`, `error.tsx`/`global-error.tsx`) ya dependía de él.
 */
import { cookies } from "next/headers";
import { authCookieSecure } from "@/shared/commons/auth-cookies";
import { generateTraceId } from "@/shared/infrastructure/logging/trace-context";
import { logAudit } from "@/shared/infrastructure/logging/logger-server";
import { handleSessionExpired } from "@/shared/infrastructure/http/errors";
import { ensureValidAccessToken } from "@/lib/api-client";
import { signIn, signOut } from "#/auth";
import { AuthError } from "next-auth";
import { loginFormSchema, type LoginFormType } from "../../ui/schema/schema-login";
import {
  cambiarPasswordFormSchema,
  type CambiarPasswordFormType,
} from "../../ui/schema/schema-cambiar-password";
import {
  solicitarRecuperacionSchema,
  type SolicitarRecuperacionFormType,
  restablecerPasswordSchema,
  type RestablecerPasswordFormType,
} from "../../ui/schema/schema-recuperar-password";
import { cambiarPassword } from "../../application/use-cases/cambiar-password";
import { solicitarRecuperacion } from "../../application/use-cases/solicitar-recuperacion";
import { restablecerPassword } from "../../application/use-cases/restablecer-password";
import { cerrarSesion } from "../../application/use-cases/cerrar-sesion";
import { repoAutenticacionApi } from "../repositories/repo-auth-api";

const MENSAJE_PASSWORD_INICIAL_VENCIDA =
  "Su contraseña inicial venció. Use ¿Olvidó su contraseña? o pida a RRHH restablecer el acceso.";

export type LoginActionResult = { success: string } | { error: string };

export async function loginAction(rawData: LoginFormType): Promise<LoginActionResult> {
  const validation = loginFormSchema.safeParse(rawData);
  if (!validation.success) {
    return { error: "Credenciales inválidas. Revise los datos ingresados." };
  }

  const traceId = generateTraceId();
  const startedAt = Date.now();

  try {
    const result = await signIn("credentials", {
      email: validation.data.usuario,
      password: validation.data.password,
      redirect: false,
    });

    if (result?.error) {
      await logAudit({
        traceId,
        action: "loginAction",
        status: "FAILED",
        durationMs: Date.now() - startedAt,
      });
      if ((result as { code?: string }).code === "password_inicial_vencida") {
        return { error: MENSAJE_PASSWORD_INICIAL_VENCIDA };
      }
      return { error: "Credenciales inválidas o cuenta bloqueada." };
    }

    await logAudit({
      traceId,
      action: "loginAction",
      status: "SUCCESS",
      durationMs: Date.now() - startedAt,
    });
    return { success: "Inicio de sesión exitoso" };
  } catch (error) {
    await logAudit({
      traceId,
      action: "loginAction",
      status: "FAILED",
      durationMs: Date.now() - startedAt,
    });
    handleSessionExpired(error);

    if (error instanceof AuthError) {
      if ((error as { code?: string }).code === "password_inicial_vencida") {
        return { error: MENSAJE_PASSWORD_INICIAL_VENCIDA };
      }
      return { error: "Credenciales inválidas o cuenta bloqueada." };
    }
    return { error: "No fue posible iniciar sesión. Intente de nuevo." };
  }
}

/**
 * Nombres de cookies de sesión de NextAuth/Auth.js a limpiar junto con
 * `dj_access`/`dj_refresh` (mismos nombres que el legado que reemplaza:
 * `NextJS/actions/auth-actions.ts`, para no cambiar el contrato de cookies).
 */
const AUTH_COOKIE_PREFIXES = [
  "authjs.session-token",
  "__Secure-authjs.session-token",
  "next-auth.session-token",
  "__Secure-next-auth.session-token",
  "authjs.csrf-token",
  "__Secure-authjs.csrf-token",
  "authjs.callback-url",
  "__Secure-authjs.callback-url",
];

async function limpiarCookiesSesion(): Promise<void> {
  const cookieStore = await cookies();
  const secure = authCookieSecure();
  cookieStore.set("dj_access", "", {
    maxAge: 0,
    path: "/",
    secure,
    httpOnly: true,
    sameSite: "lax",
  });
  cookieStore.set("dj_refresh", "", {
    maxAge: 0,
    path: "/",
    secure,
    httpOnly: true,
    sameSite: "lax",
  });
  for (const c of cookieStore.getAll()) {
    if (AUTH_COOKIE_PREFIXES.some((prefix) => c.name.startsWith(prefix))) {
      cookieStore.set(c.name, "", {
        maxAge: 0,
        path: "/",
        secure: secure || c.name.startsWith("__Secure-"),
        httpOnly: true,
        sameSite: "lax",
      });
    }
  }
}

/**
 * Cierra la sesión: invalida el refresh en el backend (best-effort, ver
 * `repo-auth-api.ts`), limpia cookies `dj_*`/NextAuth y hace `signOut()`.
 * Nunca lanza — el logout local siempre debe completarse aunque el backend
 * no responda.
 */
export async function cerrarSesionAction(): Promise<{ success: true }> {
  const traceId = generateTraceId();
  const startedAt = Date.now();

  await cerrarSesion(repoAutenticacionApi);
  await limpiarCookiesSesion();
  await signOut({ redirect: false });

  await logAudit({
    traceId,
    action: "cerrarSesionAction",
    status: "SUCCESS",
    durationMs: Date.now() - startedAt,
  });
  return { success: true };
}

/**
 * Limpia únicamente las cookies de sesión, sin llamar al backend ni a
 * `signOut()`. Pensada para los error boundaries globales (`error.tsx`,
 * `global-error.tsx`): la app ya está en un estado inconsistente, así que se
 * evita cualquier llamada de red adicional.
 */
export async function limpiarCookiesAuthAction(): Promise<{ success: true }> {
  await limpiarCookiesSesion();
  return { success: true };
}

/**
 * Extiende la sesión activa revalidando y renovando el access token (C-2).
 * Invocada por AuthController cuando el usuario presiona 'Permanecer en la sesión'.
 */
export async function extenderSesionAction(): Promise<{ success: boolean }> {
  const ok = await ensureValidAccessToken();
  return { success: ok };
}

export const extendSessionAction = extenderSesionAction;

export type CambiarPasswordActionResult =
  { success: true; message: string } | { success: false; message: string };

export async function cambiarPasswordAction(
  rawData: CambiarPasswordFormType,
): Promise<CambiarPasswordActionResult> {
  const validation = cambiarPasswordFormSchema.safeParse(rawData);
  if (!validation.success) {
    return { success: false, message: "Datos inválidos. Revise los campos." };
  }

  const traceId = generateTraceId();
  const startedAt = Date.now();

  try {
    const message = await cambiarPassword(repoAutenticacionApi, {
      passwordActual: validation.data.current_password,
      passwordNuevo: validation.data.new_password,
    });
    await logAudit({
      traceId,
      action: "cambiarPasswordAction",
      status: "SUCCESS",
      durationMs: Date.now() - startedAt,
    });
    return { success: true, message };
  } catch (error) {
    await logAudit({
      traceId,
      action: "cambiarPasswordAction",
      status: "FAILED",
      durationMs: Date.now() - startedAt,
    });
    handleSessionExpired(error);
    const message =
      error instanceof Error ? error.message : "No fue posible cambiar la contraseña.";
    return { success: false, message };
  }
}

export type RecuperacionActionResult =
  { success: true; message: string } | { success: false; message: string };

/**
 * Solicita el envío de instrucciones para restablecer contraseña al correo institucional.
 */
export async function solicitarRecuperacionAction(
  rawData: SolicitarRecuperacionFormType,
): Promise<RecuperacionActionResult> {
  const validation = solicitarRecuperacionSchema.safeParse(rawData);
  if (!validation.success) {
    return {
      success: false,
      message: "Identificador inválido. Ingrese su cédula o correo institucional.",
    };
  }

  const traceId = generateTraceId();
  const startedAt = Date.now();

  try {
    const message = await solicitarRecuperacion(
      repoAutenticacionApi,
      validation.data.identificador,
    );
    await logAudit({
      traceId,
      action: "solicitarRecuperacionAction",
      status: "SUCCESS",
      durationMs: Date.now() - startedAt,
    });
    return { success: true, message };
  } catch (error) {
    await logAudit({
      traceId,
      action: "solicitarRecuperacionAction",
      status: "FAILED",
      durationMs: Date.now() - startedAt,
    });
    const message =
      error instanceof Error ? error.message : "No fue posible procesar la solicitud.";
    return { success: false, message };
  }
}

/**
 * Restablece la contraseña utilizando el token temporal recibido por correo institucional.
 */
export async function restablecerPasswordAction(
  rawData: RestablecerPasswordFormType,
): Promise<RecuperacionActionResult> {
  const validation = restablecerPasswordSchema.safeParse(rawData);
  if (!validation.success) {
    const errorMsg =
      validation.error.issues[0]?.message ?? "Datos inválidos para restablecer la contraseña.";
    return { success: false, message: errorMsg };
  }

  const traceId = generateTraceId();
  const startedAt = Date.now();

  try {
    const message = await restablecerPassword(repoAutenticacionApi, validation.data);
    await logAudit({
      traceId,
      action: "restablecerPasswordAction",
      status: "SUCCESS",
      durationMs: Date.now() - startedAt,
    });
    return { success: true, message };
  } catch (error) {
    await logAudit({
      traceId,
      action: "restablecerPasswordAction",
      status: "FAILED",
      durationMs: Date.now() - startedAt,
    });
    const message = error instanceof Error ? error.message : "El token es inválido o ha expirado.";
    return { success: false, message };
  }
}
