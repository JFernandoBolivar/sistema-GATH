/**
 * Genera un identificador de traza para correlacionar una operación de UI con los
 * logs de auditoría de frontend (`audit_frontend.txt`) y backend (`audit_backend.txt`)
 * vía el header `X-Trace-Id` (C-5). No es un UUIDv7 estricto (requeriría una librería
 * dedicada para el componente temporal monotónico): usa `crypto.randomUUID()`, que ya
 * cumple el contrato de "identificador único por flujo" que exige C-5.
 */
export function generateTraceId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Fallback defensivo para runtimes sin `crypto.randomUUID` (no debería ocurrir en Node 18+/Edge).
  return `xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx`.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** Reutiliza el `trace_id` recibido de un header entrante o genera uno nuevo. */
export function getOrCreateTraceId(headerValue?: string | null): string {
  return headerValue && headerValue.trim().length > 0 ? headerValue : generateTraceId();
}
