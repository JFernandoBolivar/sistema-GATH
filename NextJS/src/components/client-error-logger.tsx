"use client";
import { useEffect } from "react";
import { reportFrontendError } from "@/lib/audit-log";

/**
 * Captura errores que no llegan al error boundary de Next.js (errores en
 * event handlers, promesas rechazadas sin catch) y los manda al mismo
 * registro de auditoria que global-error.tsx.
 */
export function ClientErrorLogger() {
  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      reportFrontendError(
        event.message,
        event.error?.stack,
        window.location.href,
      );
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const message =
        reason instanceof Error ? reason.message : String(reason);
      const stack = reason instanceof Error ? reason.stack : undefined;
      reportFrontendError(message, stack, window.location.href);
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}
