import { appendFile, mkdir } from "fs/promises";
import path from "path";

/**
 * Logger de servidor (F2.15, D-04, C-5). Solo debe importarse desde Server Actions,
 * Server Components o Route Handlers (runtime Node) — nunca desde un Client Component.
 * El paquete `server-only` no está instalado todavía en NextJS/package.json; mientras
 * tanto esta restricción se sostiene por convención y por code review (R7/R10).
 *
 * Regla S17: jamás escribir aquí contraseñas, tokens JWT/refresh ni datos de salud (PII).
 * Los campos aceptados por `AuditLogEntry` son deliberadamente acotados para no tentar
 * a nadie a pasar el payload completo de una mutación.
 */

const LOG_DIR = path.join(process.cwd(), "logs", "frontend");

type LogChannel = "audit" | "errors" | "security";

function formatTimestamp(date: Date): string {
  return date.toISOString().replace("T", " ").replace("Z", "").slice(0, 23);
}

async function writeLine(channel: LogChannel, line: string): Promise<void> {
  try {
    await mkdir(LOG_DIR, { recursive: true });
    const file = path.join(LOG_DIR, `${channel}_frontend.txt`);
    await appendFile(file, `${line}\n`, "utf8");
  } catch {
    // El logging es best-effort: un fallo de disco nunca debe tumbar la Server Action.
  }
}

export interface AuditLogEntry {
  traceId: string;
  sessionId?: string | null;
  ip?: string | null;
  action: string;
  status: "SUCCESS" | "FAILED" | "DENIED";
  durationMs?: number;
}

/** Escribe en `logs/frontend/audit_frontend.txt` con el formato fijo de §II.4.8 del plan. */
export async function logAudit(entry: AuditLogEntry): Promise<void> {
  const ts = formatTimestamp(new Date());
  const duration = entry.durationMs != null ? `${entry.durationMs}ms` : "n/a";
  const line =
    `[${ts}] [TRACE:${entry.traceId}] [SESSION:${entry.sessionId ?? "anonymous"}] ` +
    `[IP:${entry.ip ?? "unknown"}] [ACTION:${entry.action}] [STATUS:${entry.status}] [DURATION:${duration}]`;
  await writeLine("audit", line);
}

/** Escribe en `logs/frontend/errors_frontend.txt`. Usado por el Route Handler de errores de cliente. */
export async function logError(traceId: string, message: string, stack?: string): Promise<void> {
  const ts = formatTimestamp(new Date());
  const line = `[${ts}] [TRACE:${traceId}] [ERROR:${message}]${stack ? ` [STACK:${stack}]` : ""}`;
  await writeLine("errors", line);
}

/** Escribe en `logs/frontend/security_frontend.txt`: sesiones expiradas, 403, accesos denegados. */
export async function logSecurity(traceId: string, event: string, detail?: string): Promise<void> {
  const ts = formatTimestamp(new Date());
  const line = `[${ts}] [TRACE:${traceId}] [EVENT:${event}]${detail ? ` [DETAIL:${detail}]` : ""}`;
  await writeLine("security", line);
}
