"use server";

import { generateTraceId } from "@/shared/infrastructure/logging/trace-context";
import { logAudit } from "@/shared/infrastructure/logging/logger-server";
import { handleSessionExpired } from "@/shared/infrastructure/http/errors";
import type {
  CheckInResponse,
  Evento,
  EventoCategoria,
  EventoInvitado,
  EventoZona,
  PanelEvento,
  ResumenImportacion,
} from "../../domain/entities/evento";
import {
  actualizarEvento,
  actualizarInvitado,
  checkInAcceso,
  crearCategoriaEvento,
  crearEvento,
  crearInvitado,
  crearZonaEvento,
  eliminarInvitado,
  emitirCredencialesLote,
  enviarCredencialesCorreo,
  getCategoriasEvento,
  getEventoDetalle,
  getEventos,
  getInvitadosEvento,
  getPanelEvento,
  getZonasEvento,
  importarInvitados,
} from "../../application/use-cases/gestionar-eventos";

export async function getEventosAction(filtros?: {
  estado?: string;
  busqueda?: string;
}): Promise<Evento[]> {
  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await getEventos(filtros);
    await logAudit({
      traceId,
      action: "getEventosAction",
      status: "SUCCESS",
      durationMs: Date.now() - startedAt,
    });
    return result;
  } catch (error) {
    await logAudit({
      traceId,
      action: "getEventosAction",
      status: "FAILED",
      durationMs: Date.now() - startedAt,
    });
    handleSessionExpired(error);
    throw error;
  }
}

export async function getEventoDetalleAction(id: string): Promise<Evento | null> {
  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await getEventoDetalle(id);
    await logAudit({
      traceId,
      action: "getEventoDetalleAction",
      status: "SUCCESS",
      durationMs: Date.now() - startedAt,
    });
    return result;
  } catch (error) {
    await logAudit({
      traceId,
      action: "getEventoDetalleAction",
      status: "FAILED",
      durationMs: Date.now() - startedAt,
    });
    handleSessionExpired(error);
    throw error;
  }
}

export async function crearEventoAction(datos: {
  nombre: string;
  lugar: string;
  fecha_inicio: string;
  fecha_fin: string;
  descripcion?: string;
  plantilla_id?: string | null;
  categorias?: Array<{
    nombre: string;
    color_primario?: string;
    color_acento?: string;
    orden?: number;
  }>;
  zonas?: Array<{
    nombre: string;
    codigo?: string;
    orden?: number;
  }>;
}): Promise<Evento> {
  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await crearEvento(datos);
    await logAudit({
      traceId,
      action: "crearEventoAction",
      status: "SUCCESS",
      durationMs: Date.now() - startedAt,
    });
    return result;
  } catch (error) {
    await logAudit({
      traceId,
      action: "crearEventoAction",
      status: "FAILED",
      durationMs: Date.now() - startedAt,
    });
    handleSessionExpired(error);
    throw error;
  }
}

export async function actualizarEventoAction(
  id: string,
  datos: Partial<Evento>
): Promise<Evento> {
  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await actualizarEvento(id, datos);
    await logAudit({
      traceId,
      action: "actualizarEventoAction",
      status: "SUCCESS",
      durationMs: Date.now() - startedAt,
    });
    return result;
  } catch (error) {
    await logAudit({
      traceId,
      action: "actualizarEventoAction",
      status: "FAILED",
      durationMs: Date.now() - startedAt,
    });
    handleSessionExpired(error);
    throw error;
  }
}

export async function getCategoriasEventoAction(
  eventoId: string
): Promise<EventoCategoria[]> {
  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await getCategoriasEvento(eventoId);
    await logAudit({
      traceId,
      action: "getCategoriasEventoAction",
      status: "SUCCESS",
      durationMs: Date.now() - startedAt,
    });
    return result;
  } catch (error) {
    await logAudit({
      traceId,
      action: "getCategoriasEventoAction",
      status: "FAILED",
      durationMs: Date.now() - startedAt,
    });
    handleSessionExpired(error);
    throw error;
  }
}

export async function crearCategoriaEventoAction(
  eventoId: string,
  datos: {
    nombre: string;
    color_primario?: string;
    color_acento?: string;
    orden?: number;
  }
): Promise<EventoCategoria> {
  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await crearCategoriaEvento(eventoId, datos);
    await logAudit({
      traceId,
      action: "crearCategoriaEventoAction",
      status: "SUCCESS",
      durationMs: Date.now() - startedAt,
    });
    return result;
  } catch (error) {
    await logAudit({
      traceId,
      action: "crearCategoriaEventoAction",
      status: "FAILED",
      durationMs: Date.now() - startedAt,
    });
    handleSessionExpired(error);
    throw error;
  }
}

export async function getZonasEventoAction(
  eventoId: string
): Promise<EventoZona[]> {
  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await getZonasEvento(eventoId);
    await logAudit({
      traceId,
      action: "getZonasEventoAction",
      status: "SUCCESS",
      durationMs: Date.now() - startedAt,
    });
    return result;
  } catch (error) {
    await logAudit({
      traceId,
      action: "getZonasEventoAction",
      status: "FAILED",
      durationMs: Date.now() - startedAt,
    });
    handleSessionExpired(error);
    throw error;
  }
}

export async function crearZonaEventoAction(
  eventoId: string,
  datos: {
    nombre: string;
    codigo?: string;
    orden?: number;
  }
): Promise<EventoZona> {
  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await crearZonaEvento(eventoId, datos);
    await logAudit({
      traceId,
      action: "crearZonaEventoAction",
      status: "SUCCESS",
      durationMs: Date.now() - startedAt,
    });
    return result;
  } catch (error) {
    await logAudit({
      traceId,
      action: "crearZonaEventoAction",
      status: "FAILED",
      durationMs: Date.now() - startedAt,
    });
    handleSessionExpired(error);
    throw error;
  }
}

export async function getInvitadosEventoAction(
  eventoId: string,
  filtros?: {
    categoria_id?: string;
    zona_id?: string;
    estado?: string;
    busqueda?: string;
  }
): Promise<EventoInvitado[]> {
  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await getInvitadosEvento(eventoId, filtros);
    await logAudit({
      traceId,
      action: "getInvitadosEventoAction",
      status: "SUCCESS",
      durationMs: Date.now() - startedAt,
    });
    return result;
  } catch (error) {
    await logAudit({
      traceId,
      action: "getInvitadosEventoAction",
      status: "FAILED",
      durationMs: Date.now() - startedAt,
    });
    handleSessionExpired(error);
    throw error;
  }
}

export async function crearInvitadoAction(
  eventoId: string,
  datos: {
    nombre_completo: string;
    categoria_id: string;
    zona_id: string;
    documento_identidad?: string;
    organizacion?: string;
    correo?: string;
    telefono?: string;
    mesa?: string;
    es_acompanante?: boolean;
    trabajador_titular_id?: number | null;
    observaciones?: string;
  }
): Promise<EventoInvitado> {
  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await crearInvitado(eventoId, datos);
    await logAudit({
      traceId,
      action: "crearInvitadoAction",
      status: "SUCCESS",
      durationMs: Date.now() - startedAt,
    });
    return result;
  } catch (error) {
    await logAudit({
      traceId,
      action: "crearInvitadoAction",
      status: "FAILED",
      durationMs: Date.now() - startedAt,
    });
    handleSessionExpired(error);
    throw error;
  }
}

export async function actualizarInvitadoAction(
  invitadoId: string,
  datos: Partial<EventoInvitado>
): Promise<EventoInvitado> {
  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await actualizarInvitado(invitadoId, datos);
    await logAudit({
      traceId,
      action: "actualizarInvitadoAction",
      status: "SUCCESS",
      durationMs: Date.now() - startedAt,
    });
    return result;
  } catch (error) {
    await logAudit({
      traceId,
      action: "actualizarInvitadoAction",
      status: "FAILED",
      durationMs: Date.now() - startedAt,
    });
    handleSessionExpired(error);
    throw error;
  }
}

export async function eliminarInvitadoAction(
  invitadoId: string
): Promise<boolean> {
  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await eliminarInvitado(invitadoId);
    await logAudit({
      traceId,
      action: "eliminarInvitadoAction",
      status: "SUCCESS",
      durationMs: Date.now() - startedAt,
    });
    return result;
  } catch (error) {
    await logAudit({
      traceId,
      action: "eliminarInvitadoAction",
      status: "FAILED",
      durationMs: Date.now() - startedAt,
    });
    handleSessionExpired(error);
    throw error;
  }
}

export async function importarInvitadosAction(
  eventoId: string,
  formData: FormData
): Promise<ResumenImportacion> {
  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const archivo = formData.get("archivo");
    const confirmar = formData.get("confirmar") === "true";
    if (!(archivo instanceof File)) {
      throw new Error("El archivo subido no es válido.");
    }
    const result = await importarInvitados(eventoId, { archivo, confirmar });
    await logAudit({
      traceId,
      action: "importarInvitadosAction",
      status: "SUCCESS",
      durationMs: Date.now() - startedAt,
    });
    return result;
  } catch (error) {
    await logAudit({
      traceId,
      action: "importarInvitadosAction",
      status: "FAILED",
      durationMs: Date.now() - startedAt,
    });
    handleSessionExpired(error);
    throw error;
  }
}

export async function emitirCredencialesLoteAction(
  eventoId: string,
  invitadosIds?: string[]
): Promise<{ total_procesados: number; total_emitidos: number }> {
  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await emitirCredencialesLote(eventoId, invitadosIds);
    await logAudit({
      traceId,
      action: "emitirCredencialesLoteAction",
      status: "SUCCESS",
      durationMs: Date.now() - startedAt,
    });
    return result;
  } catch (error) {
    await logAudit({
      traceId,
      action: "emitirCredencialesLoteAction",
      status: "FAILED",
      durationMs: Date.now() - startedAt,
    });
    handleSessionExpired(error);
    throw error;
  }
}

export async function enviarCredencialesCorreoAction(
  eventoId: string,
  invitadosIds?: string[]
): Promise<{ total_enviados: number; total_fallidos: number }> {
  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await enviarCredencialesCorreo(eventoId, invitadosIds);
    await logAudit({
      traceId,
      action: "enviarCredencialesCorreoAction",
      status: "SUCCESS",
      durationMs: Date.now() - startedAt,
    });
    return result;
  } catch (error) {
    await logAudit({
      traceId,
      action: "enviarCredencialesCorreoAction",
      status: "FAILED",
      durationMs: Date.now() - startedAt,
    });
    handleSessionExpired(error);
    throw error;
  }
}

export async function getPanelEventoAction(
  eventoId: string
): Promise<PanelEvento> {
  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await getPanelEvento(eventoId);
    await logAudit({
      traceId,
      action: "getPanelEventoAction",
      status: "SUCCESS",
      durationMs: Date.now() - startedAt,
    });
    return result;
  } catch (error) {
    await logAudit({
      traceId,
      action: "getPanelEventoAction",
      status: "FAILED",
      durationMs: Date.now() - startedAt,
    });
    handleSessionExpired(error);
    throw error;
  }
}

export async function checkInAccesoAction(datos: {
  codigo_o_hash: string;
  evento_id?: string;
  zona_id?: string;
}): Promise<CheckInResponse> {
  const traceId = generateTraceId();
  const startedAt = Date.now();
  try {
    const result = await checkInAcceso(datos);
    await logAudit({
      traceId,
      action: "checkInAccesoAction",
      status: "SUCCESS",
      durationMs: Date.now() - startedAt,
    });
    return result;
  } catch (error) {
    await logAudit({
      traceId,
      action: "checkInAccesoAction",
      status: "FAILED",
      durationMs: Date.now() - startedAt,
    });
    handleSessionExpired(error);
    throw error;
  }
}
