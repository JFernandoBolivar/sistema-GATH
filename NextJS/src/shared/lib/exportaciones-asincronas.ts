/**
 * Cliente de las exportaciones asíncronas (PDF/Excel grandes generados por Celery).
 *
 * Flujo: el handler del mismo origen pide la exportación a Django y responde 202
 * con el trabajo; aquí se consulta su estado con espera creciente (backoff) hasta
 * que está LISTO y entonces se descarga el archivo (autenticado, solo el dueño).
 * Las respuestas que ya traen el archivo (reportes que siguen siendo síncronos)
 * pasan sin esperar.
 *
 * Vive en `shared/` porque lo usan tres módulos (reportes, movimientos, auditoría)
 * y ninguno debe importar a otro.
 */
import { metadatosDeTruncado, type MetadatosDeTruncado } from "./encabezados-reporte";

export type EstadoExportacion = "PENDIENTE" | "EN_PROCESO" | "LISTO" | "ERROR" | "EXPIRADO";

export interface TrabajoExportacion {
  id: string;
  estado: EstadoExportacion;
  progreso: number;
  nombre_archivo: string;
  error: string;
}

export interface ProgresoExportacion {
  estado: EstadoExportacion;
  /** 0-100. */
  progreso: number;
}

export interface OpcionesExportacion {
  /** Se cancela al salir de la página: detiene la consulta de estado. */
  signal?: AbortSignal;
  onProgreso?: (progreso: ProgresoExportacion) => void;
  /** Esperas entre consultas (ms); la última se repite. */
  retrasosMs?: readonly number[];
  /** Tiempo máximo total de espera (ms). */
  maximoMs?: number;
  /** Inyectable para pruebas. */
  esperar?: (ms: number, signal?: AbortSignal) => Promise<void>;
}

export interface ArchivoExportado extends MetadatosDeTruncado {
  blob: Blob;
}

export const RETRASOS_POR_DEFECTO_MS: readonly number[] = [1000, 1500, 2000, 3000, 5000];
export const MAXIMO_ESPERA_MS = 20 * 60 * 1000;

const MENSAJE_TIEMPO = "La exportación está tardando demasiado. Intente de nuevo más tarde.";
const MENSAJE_EXPIRADA = "El archivo ya expiró. Genere la exportación de nuevo.";
const MENSAJE_GENERICO = "No fue posible generar el archivo. Intente de nuevo.";

export class ExportacionCancelada extends Error {
  constructor() {
    super("Exportación cancelada.");
    this.name = "AbortError";
  }
}

export function esperarMs(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolver, rechazar) => {
    if (signal?.aborted) {
      rechazar(new ExportacionCancelada());
      return;
    }
    const temporizador = setTimeout(() => {
      signal?.removeEventListener("abort", alAbortar);
      resolver();
    }, ms);
    const alAbortar = () => {
      clearTimeout(temporizador);
      rechazar(new ExportacionCancelada());
    };
    signal?.addEventListener("abort", alAbortar, { once: true });
  });
}

async function mensajeDeError(respuesta: Response, porDefecto: string): Promise<string> {
  const cuerpo = (await respuesta.json().catch(() => null)) as {
    error?: string;
    message?: string;
  } | null;
  return cuerpo?.error?.trim() || cuerpo?.message?.trim() || porDefecto;
}

function esTrabajo(valor: unknown): valor is { data: TrabajoExportacion } {
  const datos = (valor as { data?: { id?: unknown } } | null)?.data;
  return typeof datos?.id === "string";
}

/** Espera a que el trabajo termine y devuelve el archivo con sus metadatos de truncado. */
export async function esperarYDescargarExportacion(
  trabajoId: string,
  opciones: OpcionesExportacion = {},
): Promise<ArchivoExportado> {
  const {
    signal,
    onProgreso,
    retrasosMs = RETRASOS_POR_DEFECTO_MS,
    maximoMs = MAXIMO_ESPERA_MS,
    esperar = esperarMs,
  } = opciones;
  const id = encodeURIComponent(trabajoId);
  let esperado = 0;
  let intento = 0;

  for (;;) {
    if (signal?.aborted) throw new ExportacionCancelada();
    const respuesta = await fetch(`/api/exportaciones/${id}`, { signal, cache: "no-store" });
    if (!respuesta.ok) throw new Error(await mensajeDeError(respuesta, MENSAJE_GENERICO));
    const cuerpo = await respuesta.json();
    if (!esTrabajo(cuerpo)) throw new Error(MENSAJE_GENERICO);
    const trabajo = cuerpo.data;
    onProgreso?.({ estado: trabajo.estado, progreso: trabajo.progreso });

    if (trabajo.estado === "LISTO") break;
    if (trabajo.estado === "ERROR") throw new Error(trabajo.error?.trim() || MENSAJE_GENERICO);
    if (trabajo.estado === "EXPIRADO") throw new Error(MENSAJE_EXPIRADA);

    const retraso = retrasosMs[Math.min(intento, retrasosMs.length - 1)] ?? 5000;
    esperado += retraso;
    if (esperado > maximoMs) throw new Error(MENSAJE_TIEMPO);
    intento += 1;
    await esperar(retraso, signal);
  }

  const descarga = await fetch(`/api/exportaciones/${id}/descargar`, { signal, cache: "no-store" });
  if (!descarga.ok) throw new Error(await mensajeDeError(descarga, MENSAJE_GENERICO));
  return { blob: await descarga.blob(), ...metadatosDeTruncado(descarga.headers) };
}

/**
 * Interpreta la respuesta de un handler de exportación: 202 → espera el trabajo y
 * descarga; 200 → el archivo ya viene en el cuerpo; otro estado → error legible.
 */
export async function archivoDeRespuesta(
  respuesta: Response,
  mensajeFallo: string,
  opciones: OpcionesExportacion = {},
): Promise<ArchivoExportado> {
  if (respuesta.status === 202) {
    const cuerpo = await respuesta.json().catch(() => null);
    if (!esTrabajo(cuerpo)) throw new Error(mensajeFallo);
    opciones.onProgreso?.({ estado: cuerpo.data.estado, progreso: cuerpo.data.progreso ?? 0 });
    return esperarYDescargarExportacion(cuerpo.data.id, opciones);
  }
  if (!respuesta.ok) throw new Error(await mensajeDeError(respuesta, mensajeFallo));
  return { blob: await respuesta.blob(), ...metadatosDeTruncado(respuesta.headers) };
}

/** Texto para el botón/aviso mientras se genera: «Generando… 40%». */
export function textoDeProgreso(progreso: ProgresoExportacion | null): string {
  // Al usuario no se le muestra «en cola»: mientras espera o arranca se ve «Generando…»
  // y el porcentaje aparece en cuanto hay avance real.
  if (!progreso || progreso.estado === "PENDIENTE") return "Generando reporte…";
  const porcentaje = Math.max(0, Math.min(100, Math.round(progreso.progreso)));
  return porcentaje > 0 ? `Generando reporte… ${porcentaje}%` : "Generando reporte…";
}

export function esCancelacion(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

/** Dispara la descarga automática del archivo en el navegador. */
export function guardarArchivo(blob: Blob, nombre: string): void {
  const url = window.URL.createObjectURL(blob);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = nombre;
  enlace.click();
  window.setTimeout(() => window.URL.revokeObjectURL(url), 1000);
}
