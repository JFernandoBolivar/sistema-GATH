/**
 * Entidades de la autogestión por solicitud (Fase 2, PLAN_PRIORIDAD §2.1).
 * Reflejan el contrato de `/api/v1/autogestion/` en camelCase; no importan nada de capas externas.
 */

export const ESTADOS_SOLICITUD = [
  "SOLICITADA",
  "HABILITADA",
  "ENVIADA",
  "APROBADA",
  "APROBADA_PARCIAL",
  "RECHAZADA",
  "EXPIRADA",
] as const;
export type EstadoSolicitud = (typeof ESTADOS_SOLICITUD)[number];

export const SECCIONES = ["contacto", "vivienda", "formacion", "familiar", "foto"] as const;
export type SeccionCodigo = (typeof SECCIONES)[number];

export type DecisionCambio = "PENDIENTE" | "APROBADO" | "RECHAZADO";
export type AccionCambio = "MODIFICAR" | "CREAR";

export const TIPOS_SOPORTE = ["TITULO", "ACTA_NACIMIENTO", "CONSTANCIA", "FOTO", "OTRO"] as const;
export type TipoSoporte = (typeof TIPOS_SOPORTE)[number];

/** Estados finales: la solicitud ya no cambia. */
export const ESTADOS_FINALES: readonly EstadoSolicitud[] = [
  "APROBADA",
  "APROBADA_PARCIAL",
  "RECHAZADA",
  "EXPIRADA",
];

export interface SolicitudEntity {
  id: string;
  cedula: string;
  estado: EstadoSolicitud;
  seccionesSolicitadas: string[];
  seccionesHabilitadas: string[];
  motivo: string;
  ventanaInicio: string | null;
  ventanaFin: string | null;
  plazoDias: number | null;
  habilitadaPor: string;
  decididaPor: string;
  motivoDecision: string;
  version: number;
  fechaSolicitud: string | null;
  fechaEnvio: string | null;
  fechaDecision: string | null;
}

export type ValorCambio = string | number | boolean | null | Record<string, unknown>;

export interface CambioEntity {
  id: string;
  seccion: string;
  accion: AccionCambio;
  entidadDestino: string;
  entidadId: string | null;
  campo: string;
  valorAnterior: ValorCambio;
  valorPropuesto: ValorCambio;
  /** Valor vigente hoy en la ficha (solo en solicitudes ENVIADAS). */
  valorActual: ValorCambio;
  /** La ficha cambió tras la propuesta: no puede aprobarse tal cual. */
  conflicto: boolean;
  decision: DecisionCambio;
  motivoDecision: string;
  decididoPor: string;
  fechaDecision: string | null;
}

export interface SoporteEntity {
  id: string;
  seccion: string;
  tipo: string;
  mimeReal: string;
  tamanoBytes: number;
  nombreOriginal: string;
  fecha: string | null;
  /** Ruta autenticada que sirve el archivo (se pide por el proxy de mismo origen). */
  urlArchivo: string;
}

export interface ProrrogaEntity {
  id: string;
  fechaFinAnterior: string;
  fechaFinNueva: string;
  motivo: string;
  prorrogadaPor: string;
  fecha: string | null;
}

export interface SolicitudDetalleEntity extends SolicitudEntity {
  cambios: CambioEntity[];
  soportes: SoporteEntity[];
  prorrogas: ProrrogaEntity[];
}

export interface SeccionAutogestionEntity {
  codigo: string;
  nombre: string;
  requiereSoporte: boolean;
  activa: boolean;
}

export interface DatosComplementariosEntity {
  cedula: string;
  correoAlternativo: string | null;
  tieneHijos: boolean | null;
  actualizadoEn: string | null;
  actualizadoPor: string;
}

export interface PaginaSolicitudesEntity {
  count: number;
  limit: number;
  offset: number;
  results: SolicitudEntity[];
}

/** Cambio que el trabajador propone en el borrador (cuerpo de PUT /borrador/). */
export interface ItemBorrador {
  seccion: string;
  entidad: string;
  accion: AccionCambio;
  campo: string;
  valor: ValorCambio;
  entidadId?: string | null;
}

export interface DecisionCampo {
  cambioId: string;
  aprobado: boolean;
  motivo: string;
}
