/**
 * DTOs de la autogestión por solicitud. La UI recibe estas formas serializables (fechas ISO en texto),
 * nunca la lógica del dominio (R5). Hoy coinciden estructuralmente con las entidades.
 */
import type {
  CambioEntity,
  DatosComplementariosEntity,
  DecisionCampo,
  ItemBorrador,
  PaginaSolicitudesEntity,
  ProrrogaEntity,
  SeccionAutogestionEntity,
  SolicitudDetalleEntity,
  SolicitudEntity,
  SoporteEntity,
} from "../../domain/entities/solicitud-actualizacion";

export type SolicitudDTO = SolicitudEntity;
export type SolicitudDetalleDTO = SolicitudDetalleEntity;
export type CambioDTO = CambioEntity;
export type SoporteDTO = SoporteEntity;
export type ProrrogaDTO = ProrrogaEntity;
export type SeccionDTO = SeccionAutogestionEntity;
export type DatosComplementariosDTO = DatosComplementariosEntity;
export type PaginaSolicitudesDTO = PaginaSolicitudesEntity;
export type ItemBorradorDTO = ItemBorrador;
export type DecisionCampoDTO = DecisionCampo;

/** Configuración vigente de solicitudes para la condición del trabajador (O12). */
export interface BloqueoSolicitudDTO {
  clave: string;
  seccion: string;
  solicitud_id: string;
  fecha: string;
  mensaje: string;
  alcance?: "registro" | "seccion" | "desactivado";
}

export interface EsperaSolicitudDTO {
  seccion: string;
  hasta: string;
  dias: number;
  acciones: string[];
  mensaje: string;
}

export interface PoliticaAutogestionDTO {
  condicion: string;
  habilitado: boolean;
  secciones: string[];
  /** O48: alcance del bloqueo por solicitud pendiente. */
  bloqueo_alcance?: "registro" | "seccion" | "desactivado";
  bloqueos?: BloqueoSolicitudDTO[];
  esperas?: EsperaSolicitudDTO[];
  espera_acciones?: string[];
}

/** Resultado uniforme de las Server Actions de escritura. */
export type ResultadoAccion<T = undefined> =
  | { ok: true; mensaje: string; datos: T }
  | { ok: false; mensaje: string; errores?: Record<string, string[]> };
