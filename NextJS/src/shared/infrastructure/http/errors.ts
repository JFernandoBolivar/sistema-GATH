import { redirect } from "next/navigation";
import { AuthSessionExpiredError } from "@/lib/auth-errors";

/**
 * Alias canónico de F2.11. Extiende el error legado (`@/lib/auth-errors`) en vez de
 * duplicarlo: `instanceof AuthSessionExpiredError` sigue funcionando en el código que
 * ya lo usa (p.ej. `@/lib/action-utils`) mientras el resto del código migra a este módulo.
 */
export class SessionExpiredError extends AuthSessionExpiredError {}

/**
 * Error HTTP con el código de estado del backend. `apiClient` lo lanza en vez de
 * un `Error` plano para que quien lo consuma (p. ej. el proxy de reportes)
 * pueda distinguir un 403 de permiso de un fallo del servidor y trasladar el
 * mensaje real al usuario en lugar de tragárselo.
 */
export class ApiHttpError extends Error {
  readonly status: number;
  /** Errores por campo del backend (`data.errores`): `{ "cedula": ["..."], "contactos.0.telefono": ["..."] }`. */
  readonly errores?: Record<string, string[]>;

  constructor(message: string, status: number, errores?: Record<string, string[]>) {
    super(message);
    this.name = "ApiHttpError";
    this.status = status;
    this.errores = errores;
  }
}

/**
 * Resultado de error de una Server Action: el mensaje y, si el backend los dio,
 * los errores por campo para marcarlos en el formulario con `aplicarErroresServidor`.
 */
export interface ErrorDeAccion {
  error: string;
  errores?: Record<string, string[]>;
}

export function errorDeAccion(e: unknown, porDefecto: string): ErrorDeAccion {
  if (e instanceof ApiHttpError) {
    return e.errores ? { error: e.message, errores: e.errores } : { error: e.message };
  }
  return { error: e instanceof Error && e.message ? e.message : porDefecto };
}

/**
 * Toda Server Action que use `apiClient` debe capturar el error y llamar a esta función (R7).
 * `redirect()` lanza internamente (`NEXT_REDIRECT`); dejar que la excepción se propague.
 */
export function handleSessionExpired(error: unknown): void {
  if (error instanceof AuthSessionExpiredError) {
    redirect("/login");
  }
}
