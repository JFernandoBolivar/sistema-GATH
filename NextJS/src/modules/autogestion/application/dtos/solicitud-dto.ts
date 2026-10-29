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

/** Resultado uniforme de las Server Actions de escritura. */
export type ResultadoAccion<T = undefined> =
  { ok: true; mensaje: string; datos: T } | { ok: false; mensaje: string };
