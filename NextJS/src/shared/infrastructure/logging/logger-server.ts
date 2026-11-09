import { appendFile, mkdir, rename, stat, unlink } from "fs/promises";
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
 *
 * Rendimiento (Fase 5, punto 1): las Server Actions NO esperan al disco. La escritura
 * se encola en segundo plano por archivo, el `mkdir` se hace una sola vez por proceso
 * y el archivo rota al superar `MAX_BYTES`. El formato y todos los campos se conservan.
 */

const LOG_DIR = path.join(process.cwd(), "logs", "frontend");
const MAX_BYTES = 5 * 1024 * 1024;
const MAX_ROTACIONES = 3;

type LogChannel = "audit" | "errors" | "security";

/** `mkdir` se resuelve una sola vez por proceso; si falla, se reintenta en la próxima escritura. */
let directorioListo: Promise<void> | null = null;

/** Una cola por archivo: evita que dos rotaciones concurrentes se pisen. */
const colas = new Map<string, Promise<void>>();

/** Tamaño conocido por archivo; se inicializa con `stat` una sola vez. */
const tamanos = new Map<string, number>();

function asegurarDirectorio(): Promise<void> {
  if (!directorioListo) {
    directorioListo = mkdir(LOG_DIR, { recursive: true })
      .then(() => undefined)
      .catch(() => {
        directorioListo = null;
      });
  }
  return directorioListo;
}

function formatTimestamp(date: Date): string {
  return date.toISOString().replace("T", " ").replace("Z", "").slice(0, 23);
}

async function rotarArchivo(file: string): Promise<void> {
  try {
    await unlink(`${file}.${MAX_ROTACIONES}`);
  } catch {
    // Todavía no existe la rotación más antigua.
  }
  for (let i = MAX_ROTACIONES - 1; i >= 1; i--) {
    try {
      await rename(`${file}.${i}`, `${file}.${i + 1}`);
    } catch {
      // Es normal que falten rotaciones intermedias.
    }
  }
  try {
    await rename(file, `${file}.1`);
  } catch {
    // El archivo pudo no existir todavía.
  }
}

async function escribir(file: string, line: string): Promise<void> {
  await asegurarDirectorio();

  if (!tamanos.has(file)) {
    try {
      tamanos.set(file, (await stat(file)).size);
    } catch {
      tamanos.set(file, 0);
    }
  }

  let tamano = tamanos.get(file) ?? 0;
  const bytes = Buffer.byteLength(line, "utf8") + 1;
  if (tamano + bytes > MAX_BYTES) {
    await rotarArchivo(file);
    tamano = 0;
  }

  await appendFile(file, `${line}\n`, "utf8");
  tamanos.set(file, tamano + bytes);
}

/**
 * Encola la línea y regresa de inmediato: la Server Action no espera al disco.
 * Cualquier fallo de escritura se captura aquí y nunca se propaga.
 */
function writeLine(channel: LogChannel, line: string): void {
  const file = path.join(LOG_DIR, `${channel}_frontend.txt`);
  const anterior = colas.get(file) ?? Promise.resolve();
  const siguiente = anterior
    .then(() => escribir(file, line))
    .catch(() => undefined)
    .finally(() => {
      if (colas.get(file) === siguiente) colas.delete(file);
    });
  colas.set(file, siguiente);
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
  writeLine("audit", line);
}

/** Escribe en `logs/frontend/errors_frontend.txt`. Usado por el Route Handler de errores de cliente. */
export async function logError(traceId: string, message: string, stack?: string): Promise<void> {
  const ts = formatTimestamp(new Date());
  const line = `[${ts}] [TRACE:${traceId}] [ERROR:${message}]${stack ? ` [STACK:${stack}]` : ""}`;
  writeLine("errors", line);
}

/** Escribe en `logs/frontend/security_frontend.txt`: sesiones expiradas, 403, accesos denegados. */
export async function logSecurity(traceId: string, event: string, detail?: string): Promise<void> {
  const ts = formatTimestamp(new Date());
  const line = `[${ts}] [TRACE:${traceId}] [EVENT:${event}]${detail ? ` [DETAIL:${detail}]` : ""}`;
  writeLine("security", line);
}
