import { redirect } from "next/navigation";
import { AuthSessionExpiredError } from "./auth-errors";

function isNextRedirectError(error: unknown): boolean {
  return (
    error instanceof Error &&
    typeof (error as Error & { digest?: string }).digest === "string" &&
    (error as Error & { digest?: string }).digest!.startsWith("NEXT_REDIRECT")
  );
}

export function safeAction<T extends (...args: unknown[]) => Promise<Record<string, unknown>>>(
  action: T,
): T {
  return (async (...args: unknown[]) => {
    try {
      return await action(...args);
    } catch (error) {
      if (error instanceof AuthSessionExpiredError) {
        redirect("/login");
      }
      if (isNextRedirectError(error)) {
        throw error;
      }
      return { success: false, message: "Ocurrio un error inesperado" };
    }
  }) as T;
}
