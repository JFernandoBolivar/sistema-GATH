"use server";

/**
 * Server Actions de la bandeja de Captación (D-7/D-8). Usan la sesión del empleado (token normal) y
 * devuelven un resultado con el motivo en español: no lanzan errores al navegador.
 */
import { unstable_rethrow } from "next/navigation";
import { generateTraceId } from "@/shared/infrastructure/logging/trace-context";
import { logAudit } from "@/shared/infrastructure/logging/logger-server";
import { ApiHttpError, errorDeAccion, handleSessionExpired } from "@/shared/infrastructure/http/errors";
import type { FiltrosVacantes, PaginaVacantes } from "@/modules/presupuesto/domain/solicitud";
import { validarAprobacion, validarPdfFirmado } from "../../domain/ingreso-corto";
import type { DocumentoExpedienteDTO } from "@/modules/documentos/domain/lib/documentos-expediente";
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

/** Documentos del expediente con su estado y la evidencia de firma (permiso de la bandeja de Captación). */
export async function listarDocumentosExpedienteAction(id: string): Promise<ResultadoAccion<DocumentoExpedienteDTO[]>> {
  return ejecutar("listarDocumentosExpedienteAction", "No fue posible cargar los documentos.", () => captacionApi.documentos(id));
}

/** El PDF del documento viaja como base64 (las acciones no devuelven binarios); la descarga queda en la bitácora. */
export async function descargarDocumentoExpedienteAction(
  id: string,
  codigo: string,
): Promise<ResultadoAccion<{ base64: string; nombre: string }>> {
  return ejecutar("descargarDocumentoExpedienteAction", "No fue posible descargar el documento.", async () => {
    const blob = await captacionApi.documentoPdf(id, codigo);
    return { base64: Buffer.from(await blob.arrayBuffer()).toString("base64"), nombre: `${codigo.toLowerCase()}-${id.slice(0, 8)}.pdf` };
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

// --- Ingreso sin Presupuesto y/o sin Dirección General (M-5) ---
type Descarga = { base64: string; nombre: string };

export async function listarVacantesCaptacionAction(id: string, filtros: FiltrosVacantes): Promise<ResultadoAccion<PaginaVacantes>> {
  return ejecutar("listarVacantesCaptacionAction", "No fue posible cargar los puestos vacantes.", () => captacionApi.vacantes(id, filtros));
}

export async function reservarPuestoCaptacionAction(id: string, puestoId: number): Promise<ResultadoAccion<DetalleExpediente>> {
  return ejecutar("reservarPuestoCaptacionAction", "No fue posible reservar el puesto.", () => captacionApi.reservar(id, puestoId));
}

export async function liberarReservaCaptacionAction(id: string): Promise<ResultadoAccion<DetalleExpediente>> {
  return ejecutar("liberarReservaCaptacionAction", "No fue posible liberar la reserva.", () => captacionApi.liberarReserva(id));
}

export async function generarPuntoCuentaCaptacionAction(id: string): Promise<ResultadoAccion<DetalleExpediente>> {
  return ejecutar("generarPuntoCuentaCaptacionAction", "No fue posible generar el Punto de Cuenta.", () => captacionApi.generarPuntoCuenta(id));
}

/** `fecha_firma` (AAAA-MM-DD) obligatoria y no futura; `pdf_firmado` opcional. */
export async function registrarAprobacionCaptacionAction(id: string, formData: FormData): Promise<ResultadoAccion<DetalleExpediente>> {
  const fecha = formData.get("fecha_firma");
  const archivo = formData.get("pdf_firmado");
  const pdf = archivo instanceof File && archivo.size > 0 ? archivo : null;
  const errores = validarAprobacion({ fechaFirma: typeof fecha === "string" ? fecha : "", pdfFirmado: pdf });
  if (Object.keys(errores).length > 0) {
    return { ok: false, error: Object.values(errores)[0], errores: Object.fromEntries(Object.entries(errores).map(([k, v]) => [k, [v]])) };
  }
  return ejecutar(
    "registrarAprobacionCaptacionAction",
    "No fue posible registrar la aprobación.",
    () => captacionApi.registrarAprobacion(id, fecha as string, pdf),
    () => "Aprobación del ingreso registrada.",
  );
}

export async function adjuntarPdfFirmadoCaptacionAction(id: string, formData: FormData): Promise<ResultadoAccion<DetalleExpediente>> {
  const archivo = formData.get("pdf_firmado");
  const pdf = archivo instanceof File && archivo.size > 0 ? archivo : null;
  const error = pdf ? validarPdfFirmado(pdf) : "Seleccione el archivo PDF firmado.";
  if (error || !pdf) return { ok: false, error: error ?? "Seleccione el archivo PDF firmado." };
  return ejecutar("adjuntarPdfFirmadoCaptacionAction", "No fue posible adjuntar el PDF firmado.", () => captacionApi.adjuntarPdfFirmado(id, pdf), () => "PDF firmado adjuntado.");
}

/** Los PDF viajan como base64 (las acciones no devuelven binarios); la consulta queda en la bitácora del servidor. */
export async function descargarPuntoCuentaCaptacionAction(id: string, numero: string): Promise<ResultadoAccion<Descarga>> {
  return ejecutar("descargarPuntoCuentaCaptacionAction", "No fue posible descargar el Punto de Cuenta.", async () => ({
    base64: Buffer.from(await (await captacionApi.puntoCuentaPdf(id)).arrayBuffer()).toString("base64"),
    nombre: `punto-cuenta-${numero || id.slice(0, 8)}.pdf`,
  }));
}

export async function descargarPuntoCuentaFirmadoCaptacionAction(id: string, numero: string): Promise<ResultadoAccion<Descarga>> {
  return ejecutar("descargarPuntoCuentaFirmadoCaptacionAction", "No fue posible descargar el Punto de Cuenta firmado.", async () => ({
    base64: Buffer.from(await (await captacionApi.puntoCuentaFirmadoPdf(id)).arrayBuffer()).toString("base64"),
    nombre: `punto-cuenta-firmado-${numero || id.slice(0, 8)}.pdf`,
  }));
}
