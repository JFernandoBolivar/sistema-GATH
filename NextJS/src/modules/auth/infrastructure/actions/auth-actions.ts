"use server";

/**
 * Server Actions del módulo auth (paso 11 del checklist §II.8).
 * F3.7: `loginAction` invoca `signIn("credentials")` — authorize() será el
 * único ejecutor HTTP y fijador de cookies dj_access/dj_refresh (ALTA-03, C-2).
 *
 * Zero-trust: revalida la entrada con el mismo schema del formulario antes de
 * tocar el caso de uso. Captura errores y llama `handleSessionExpired` (R7) y
 * registra la auditoría en `logs/frontend/audit_frontend.txt` (D-04/C-5).
 */
import { generateTraceId } from "@/shared/infrastructure/logging/trace-context";
import { logAudit } from "@/shared/infrastructure/logging/logger-server";
import { handleSessionExpired } from "@/shared/infrastructure/http/errors";
import { signIn } from "#/auth";
import { AuthError } from "next-auth";
import { loginFormSchema, type LoginFormType } from "../../ui/schema/schema-login";

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
      await logAudit({ traceId, action: "loginAction", status: "FAILED", durationMs: Date.now() - startedAt });
      return { error: "Credenciales inválidas o cuenta bloqueada." };
    }

    await logAudit({ traceId, action: "loginAction", status: "SUCCESS", durationMs: Date.now() - startedAt });
    return { success: "Inicio de sesión exitoso" };
  } catch (error) {
    await logAudit({ traceId, action: "loginAction", status: "FAILED", durationMs: Date.now() - startedAt });
    handleSessionExpired(error);

    if (error instanceof AuthError) {
      return { error: "Credenciales inválidas o cuenta bloqueada." };
    }
    return { error: "No fue posible iniciar sesión. Intente de nuevo." };
  }
}
