import { redirect } from "next/navigation";
import { AuthSessionExpiredError } from "@/lib/auth-errors";

/**
 * Alias canónico de F2.11. Extiende el error legado (`@/lib/auth-errors`) en vez de
 * duplicarlo: `instanceof AuthSessionExpiredError` sigue funcionando en el código que
 * ya lo usa (p.ej. `@/lib/action-utils`) mientras el resto del código migra a este módulo.
 */
export class SessionExpiredError extends AuthSessionExpiredError {}

/**
 * Toda Server Action que use `apiClient` debe capturar el error y llamar a esta función (R7).
 * `redirect()` lanza internamente (`NEXT_REDIRECT`); dejar que la excepción se propague.
 */
export function handleSessionExpired(error: unknown): void {
  if (error instanceof AuthSessionExpiredError) {
    redirect("/login");
  }
}
