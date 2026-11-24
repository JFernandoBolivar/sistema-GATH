"use server";

/**
 * Server Actions de Dirección General (E-6). Usan la sesión del empleado y devuelven un resultado con el
 * motivo en español: no lanzan errores al navegador.
 */
import { unstable_rethrow } from "next/navigation";
import { generateTraceId } from "@/shared/infrastructure/logging/trace-context";
import { logAudit } from "@/shared/infrastructure/logging/logger-server";
import { errorDeAccion, handleSessionExpired } from "@/shared/infrastructure/http/errors";
import type {
  DatosTransicionArea,
  DetalleArea,
  FiltrosArea,
  PaginaArea,
  ResultadoAccion,
} from "@/modules/presupuesto/domain/solicitud";
import { direccionApi } from "../http/direccion-api";

async function ejecutar<T>(accion: string, porDefecto: string, fn: () => Promise<T>): Promise<ResultadoAccion<T>> {
  const traceId = generateTraceId();
  const inicio = Date.now();
  try {
    const data = await fn();
    await logAudit({ traceId, action: accion, status: "SUCCESS", durationMs: Date.now() - inicio });
    return { ok: true, data };
  } catch (error) {
    unstable_rethrow(error);
    await logAudit({ traceId, action: accion, status: "FAILED", durationMs: Date.now() - inicio });
    handleSessionExpired(error);
    const e = errorDeAccion(error, porDefecto);
    return { ok: false, error: e.error, errores: e.errores };
  }
}

export async function listarIngresosAction(filtros: FiltrosArea): Promise<ResultadoAccion<PaginaArea>> {
  return ejecutar("listarIngresosDireccionAction", "No fue posible cargar la bandeja.", () => direccionApi.bandeja(filtros));
}

export async function contarIngresosAction(estados: string[], vista?: string): Promise<ResultadoAccion<number>> {
  return ejecutar("contarIngresosDireccionAction", "No fue posible contar los ingresos.", async () =>
    (await direccionApi.bandeja({ estados, vista, pagina: 1, tamano: 1 })).total,
  );
}

export async function obtenerIngresoAction(id: string): Promise<ResultadoAccion<DetalleArea>> {
  return ejecutar("obtenerIngresoDireccionAction", "No fue posible cargar el ingreso.", () => direccionApi.detalle(id));
}

export async function decidirIngresoAction(id: string, t: DatosTransicionArea): Promise<ResultadoAccion<DetalleArea>> {
  return ejecutar("decidirIngresoDireccionAction", "No fue posible registrar la decisión.", () => direccionApi.transicion(id, t));
}

type Descarga = { base64: string; nombre: string };

export async function descargarPuntoCuentaDireccionAction(id: string, numero: string): Promise<ResultadoAccion<Descarga>> {
  return ejecutar("descargarPuntoCuentaDireccionAction", "No fue posible obtener el Punto de Cuenta.", async () => ({
    base64: Buffer.from(await (await direccionApi.puntoCuenta(id)).arrayBuffer()).toString("base64"),
    nombre: `punto-cuenta-${numero || id.slice(0, 8)}.pdf`,
  }));
}

export async function descargarConstanciaDireccionAction(id: string, numero: string): Promise<ResultadoAccion<Descarga>> {
  return ejecutar("descargarConstanciaDireccionAction", "No fue posible descargar la constancia.", async () => ({
    base64: Buffer.from(await (await direccionApi.constanciaAdjunto(id)).arrayBuffer()).toString("base64"),
    nombre: `constancia-presupuestaria-${numero || id.slice(0, 8)}.pdf`,
  }));
}
