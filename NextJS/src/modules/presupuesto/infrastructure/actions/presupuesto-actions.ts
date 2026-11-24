"use server";

/**
 * Server Actions de Presupuesto (E-1 a E-5). Usan la sesión del empleado y devuelven un resultado con el
 * motivo en español: no lanzan errores al navegador.
 */
import { unstable_rethrow } from "next/navigation";
import { generateTraceId } from "@/shared/infrastructure/logging/trace-context";
import { logAudit } from "@/shared/infrastructure/logging/logger-server";
import { errorDeAccion, handleSessionExpired } from "@/shared/infrastructure/http/errors";
import {
  MAX_BYTES_ADJUNTO,
  type DatosTransicionArea,
  type DetalleArea,
  type FiltrosArea,
  type FiltrosVacantes,
  type PaginaArea,
  type PaginaVacantes,
  type ResultadoAccion,
  validarConstancia,
} from "../../domain/solicitud";
import { presupuestoApi } from "../http/presupuesto-api";

async function ejecutar<T>(
  accion: string,
  porDefecto: string,
  fn: () => Promise<T>,
  mensaje?: (r: T) => string | undefined,
): Promise<ResultadoAccion<T>> {
  const traceId = generateTraceId();
  const inicio = Date.now();
  try {
    const data = await fn();
    await logAudit({ traceId, action: accion, status: "SUCCESS", durationMs: Date.now() - inicio });
    return { ok: true, data, mensaje: mensaje?.(data) };
  } catch (error) {
    unstable_rethrow(error);
    await logAudit({ traceId, action: accion, status: "FAILED", durationMs: Date.now() - inicio });
    handleSessionExpired(error);
    const e = errorDeAccion(error, porDefecto);
    return { ok: false, error: e.error, errores: e.errores };
  }
}

export async function listarSolicitudesAction(filtros: FiltrosArea): Promise<ResultadoAccion<PaginaArea>> {
  return ejecutar("listarSolicitudesPresupuestoAction", "No fue posible cargar la bandeja.", () => presupuestoApi.bandeja(filtros));
}

/** Conteo de una pestaña: pide una sola fila y usa `total`. */
export async function contarSolicitudesAction(estados: string[], vista?: string): Promise<ResultadoAccion<number>> {
  return ejecutar("contarSolicitudesPresupuestoAction", "No fue posible contar las solicitudes.", async () =>
    (await presupuestoApi.bandeja({ estados, vista, pagina: 1, tamano: 1 })).total,
  );
}

export async function obtenerSolicitudAction(id: string): Promise<ResultadoAccion<DetalleArea>> {
  return ejecutar("obtenerSolicitudPresupuestoAction", "No fue posible cargar la solicitud.", () => presupuestoApi.detalle(id));
}

export async function listarVacantesAction(id: string, filtros: FiltrosVacantes): Promise<ResultadoAccion<PaginaVacantes>> {
  return ejecutar("listarVacantesPresupuestoAction", "No fue posible cargar los puestos vacantes.", () =>
    presupuestoApi.vacantes(id, filtros),
  );
}

export async function reservarPuestoAction(id: string, puestoId: number): Promise<ResultadoAccion<DetalleArea>> {
  return ejecutar("reservarPuestoAction", "No fue posible reservar el puesto.", () => presupuestoApi.reservar(id, puestoId));
}

export async function liberarReservaAction(id: string): Promise<ResultadoAccion<DetalleArea>> {
  return ejecutar("liberarReservaAction", "No fue posible liberar la reserva.", () => presupuestoApi.liberar(id));
}

export async function declararConstanciaAction(id: string, formData: FormData): Promise<ResultadoAccion<DetalleArea>> {
  const referencia = formData.get("referencia");
  const observaciones = formData.get("observaciones");
  const adjunto = formData.get("adjunto");
  const archivo = adjunto instanceof File && adjunto.size > 0 ? adjunto : null;
  const datos = {
    referencia: typeof referencia === "string" ? referencia : "",
    observaciones: typeof observaciones === "string" ? observaciones : "",
    adjunto: archivo,
  };
  const errores = validarConstancia(datos);
  if (Object.keys(errores).length > 0) {
    return { ok: false, error: Object.values(errores)[0], errores: Object.fromEntries(Object.entries(errores).map(([k, v]) => [k, [v]])) };
  }
  if (archivo && archivo.size > MAX_BYTES_ADJUNTO) return { ok: false, error: "El adjunto supera los 10 MB." };
  return ejecutar(
    "declararConstanciaAction",
    "No fue posible declarar la disponibilidad.",
    () => presupuestoApi.declararConstancia(id, datos),
    () => "Disponibilidad presupuestaria declarada.",
  );
}

export async function transicionarSolicitudAction(id: string, t: DatosTransicionArea): Promise<ResultadoAccion<DetalleArea>> {
  return ejecutar("transicionarSolicitudAction", "No fue posible aplicar la acción.", () => presupuestoApi.transicion(id, t));
}

type Descarga = { base64: string; nombre: string };

/** Los PDF viajan como base64 (las acciones no devuelven binarios). */
export async function descargarPuntoCuentaPresupuestoAction(id: string, numero: string): Promise<ResultadoAccion<Descarga>> {
  return ejecutar("descargarPuntoCuentaPresupuestoAction", "No fue posible descargar el Punto de Cuenta.", async () => ({
    base64: Buffer.from(await (await presupuestoApi.puntoCuenta(id)).arrayBuffer()).toString("base64"),
    nombre: `punto-cuenta-${numero || id.slice(0, 8)}.pdf`,
  }));
}

export async function descargarConstanciaPresupuestoAction(id: string, numero: string): Promise<ResultadoAccion<Descarga>> {
  return ejecutar("descargarConstanciaPresupuestoAction", "No fue posible descargar la constancia.", async () => ({
    base64: Buffer.from(await (await presupuestoApi.constanciaAdjunto(id)).arrayBuffer()).toString("base64"),
    nombre: `constancia-presupuestaria-${numero || id.slice(0, 8)}.pdf`,
  }));
}
