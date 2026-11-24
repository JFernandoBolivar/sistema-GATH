"use server";

/**
 * Server Actions de la bandeja de Captación (D-7/D-8). Usan la sesión del empleado (token normal) y
 * devuelven un resultado con el motivo en español: no lanzan errores al navegador.
 */
import { unstable_rethrow } from "next/navigation";
import { generateTraceId } from "@/shared/infrastructure/logging/trace-context";
import { logAudit } from "@/shared/infrastructure/logging/logger-server";
import { ApiHttpError, errorDeAccion, handleSessionExpired } from "@/shared/infrastructure/http/errors";
import { mensajeErrorContratacion, type ResultadoContratacion } from "../../domain/contratacion";
import type {
  AltaPostulanteResultado,
  CredencialEmitida,
  DatosAltaPostulante,
  DatosTransicion,
  DetalleExpediente,
  FiltrosBandeja,
  PaginaBandeja,
  ResultadoAccion,
  ResultadoPsicofisico,
  ResultadoTransicion,
} from "../../domain/expediente";
import { captacionApi } from "../http/captacion-api";

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
    return { ok: false, error: e.error, errores: e.errores, codigo: error instanceof ApiHttpError ? error.codigo : undefined };
  }
}

export async function listarBandejaAction(filtros: FiltrosBandeja): Promise<ResultadoAccion<PaginaBandeja>> {
  return ejecutar("listarBandejaCaptacionAction", "No fue posible cargar la bandeja.", () =>
    captacionApi.bandeja(filtros),
  );
}

/** Conteo de una pestaña: pide una sola fila y usa `total`. */
export async function contarExpedientesAction(estados: string[], porContactar = false): Promise<ResultadoAccion<number>> {
  return ejecutar("contarExpedientesCaptacionAction", "No fue posible contar los expedientes.", async () =>
    (await captacionApi.bandeja({ estados, porContactar, pagina: 1, tamano: 1 })).total,
  );
}

/** «Por contactar»: total y cuántos están atrasados (el backend ordena primero los atrasados). */
export async function resumenPorContactarAction(): Promise<ResultadoAccion<{ total: number; atrasados: number }>> {
  return ejecutar("resumenPorContactarCaptacionAction", "No fue posible contar los contactos pendientes.", async () => {
    const p = await captacionApi.bandeja({ estados: [], porContactar: true, pagina: 1, tamano: 50 });
    return { total: p.total, atrasados: p.resultados.filter((f) => f.contactoAtrasado).length };
  });
}

export async function obtenerExpedienteAction(id: string): Promise<ResultadoAccion<DetalleExpediente>> {
  return ejecutar("obtenerExpedienteCaptacionAction", "No fue posible cargar el expediente.", () =>
    captacionApi.detalle(id),
  );
}

export async function transicionarExpedienteAction(
  id: string,
  transicion: DatosTransicion,
): Promise<ResultadoAccion<ResultadoTransicion>> {
  return ejecutar("transicionarExpedienteAction", "No fue posible aplicar la acción.", () =>
    captacionApi.transicion(id, transicion),
  );
}

export async function crearPostulanteAction(
  datos: DatosAltaPostulante,
): Promise<ResultadoAccion<AltaPostulanteResultado>> {
  return ejecutar(
    "crearPostulanteAction",
    "No fue posible crear el postulante.",
    () => captacionApi.altaPostulante(datos),
    (r) => r.mensaje,
  );
}

export async function reponerCredencialAction(id: string): Promise<ResultadoAccion<CredencialEmitida>> {
  return ejecutar("reponerCredencialAction", "No fue posible reponer la credencial.", () =>
    captacionApi.reponerCredencial(id),
  );
}

export async function enviarEnlaceActivacionAction(id: string): Promise<ResultadoAccion<CredencialEmitida>> {
  return ejecutar("enviarEnlaceActivacionAction", "No fue posible enviar el enlace.", () => captacionApi.enviarEnlace(id));
}

export async function registrarPsicofisicoAction(
  id: string,
  formData: FormData,
): Promise<ResultadoAccion<ResultadoPsicofisico>> {
  const resultado = formData.get("resultado");
  const fecha = formData.get("fecha_aplicacion");
  const observaciones = formData.get("observaciones");
  const archivo = formData.get("informe");
  if ((resultado !== "APTO" && resultado !== "NO_APTO") || typeof fecha !== "string" || !fecha) {
    return { ok: false, error: "Indique el resultado y la fecha de aplicación." };
  }
  return ejecutar("registrarPsicofisicoAction", "No fue posible registrar el resultado.", () =>
    captacionApi.registrarPsicofisico(
      id,
      {
        resultado,
        fechaAplicacion: fecha,
        observaciones: typeof observaciones === "string" ? observaciones : undefined,
      },
      archivo instanceof File && archivo.size > 0 ? archivo : null,
    ),
  );
}

/** El informe PDF viaja como base64 (las acciones no devuelven binarios). */
export async function descargarInformePsicofisicoAction(
  id: string,
): Promise<ResultadoAccion<{ base64: string; nombre: string }>> {
  return ejecutar("descargarInformePsicofisicoAction", "No fue posible descargar el informe.", async () => {
    const blob = await captacionApi.informe(id);
    return {
      base64: Buffer.from(await blob.arrayBuffer()).toString("base64"),
      nombre: `informe-psicofisico-${id.slice(0, 8)}.pdf`,
    };
  });
}

export async function registrarContactoAction(id: string, nota?: string): Promise<ResultadoAccion<DetalleExpediente>> {
  return ejecutar("registrarContactoPostulanteAction", "No fue posible registrar el contacto.", () => captacionApi.contactado(id, nota));
}

/** Contratación atómica (crea la ficha, asigna el puesto y la cuenta). Los errores traen un texto claro por código. */
export async function contratarPostulanteAction(id: string): Promise<ResultadoAccion<ResultadoContratacion>> {
  const r = await ejecutar("contratarPostulanteAction", "No fue posible contratar al postulante.", () => captacionApi.asignar(id));
  if (r.ok) return r;
  return { ...r, error: mensajeErrorContratacion(r.codigo, r.error) };
}
