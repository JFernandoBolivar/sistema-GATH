/**
 * Solicitudes de carnet hechas por el trabajador desde Autogestión (decisión del 2026-11-20):
 * Recursos Humanos las revisa en la bandeja de Carnetización y emite o rechaza.
 */
import type { CondicionTitular } from "./carnet";

export type EstadoSolicitudCarnetApi = "PENDIENTE" | "APROBADA" | "RECHAZADA" | "CANCELADA";

/** Fila tal como la devuelve `GET /api/v1/carnetizacion/solicitudes/`. */
export interface SolicitudCarnetApi {
  id: string;
  cedula: string;
  estado: EstadoSolicitudCarnetApi;
  motivo_id: number;
  motivo: string;
  justificacion: string;
  motivo_rechazo: string;
  carnet_id: number | null;
  fecha_solicitud: string | null;
  fecha_resolucion: string | null;
  nombres?: string;
  apellidos?: string;
  cargo?: string;
  departamento?: string;
  condicion?: CondicionTitular;
  carnet_anterior_estado?: "ACTIVO" | "VENCIDO" | "NINGUNO";
}

export type EstadoSolicitudCarnet = EstadoSolicitudCarnetApi;

/** Fila de la bandeja (forma que usa la vista). */
export interface SolicitudCarnetItem {
  id: string;
  cedula: string;
  nombres: string;
  apellidos: string;
  nombreCompleto: string;
  cargo: string;
  departamento: string;
  poblacion: "ACTIVO" | "PASIVO" | "SIN_ASIGNACION";
  motivoId: number;
  motivoSolicitud: string;
  justificacion: string;
  fechaSolicitud: string;
  estado: EstadoSolicitudCarnet;
  motivoRechazo?: string;
  carnetAnteriorEstado?: "ACTIVO" | "VENCIDO" | "NINGUNO";
}

export function solicitudDesdeApi(fila: SolicitudCarnetApi): SolicitudCarnetItem {
  const nombres = (fila.nombres ?? "").trim();
  const apellidos = (fila.apellidos ?? "").trim();
  return {
    id: fila.id,
    cedula: fila.cedula,
    nombres,
    apellidos,
    // Mismo formato que usaba la bandeja: «APELLIDOS, NOMBRES».
    nombreCompleto: apellidos && nombres ? `${apellidos}, ${nombres}` : apellidos || nombres || fila.cedula,
    cargo: fila.cargo || "No especificado",
    departamento: fila.departamento || "",
    poblacion: fila.condicion ?? "ACTIVO",
    motivoId: fila.motivo_id,
    motivoSolicitud: fila.motivo || "",
    justificacion: fila.justificacion || "",
    fechaSolicitud: fila.fecha_solicitud ?? "",
    estado: fila.estado,
    motivoRechazo: fila.motivo_rechazo || undefined,
    carnetAnteriorEstado: fila.carnet_anterior_estado,
  };
}

/** Última solicitud del trabajador en «Mi carnet» (Autogestión). */
export interface MiSolicitudCarnet {
  id: string;
  estado: EstadoSolicitudCarnetApi;
  motivo: string;
  motivo_rechazo: string;
  fecha_solicitud: string | null;
  fecha_resolucion: string | null;
}
