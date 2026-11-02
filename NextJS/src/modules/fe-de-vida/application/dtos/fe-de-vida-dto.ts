/**
 * DTOs de la fe de vida. Las entidades del dominio son inmutables y no llevan lógica propia,
 * por lo que el DTO que cruza a la UI tiene su misma forma serializable.
 */
import type {
  CambioEntity,
  CoberturaEntity,
  DecisionEntity,
  DetalleRevisionEntity,
  DetalleSolicitudEntity,
  PaginaEntity,
  ProcesoEntity,
  ProrrogaEntity,
  SolicitudEntity,
  TipoPensionEntity,
  EvidenciaImagenEntity,
  VigenteEntity,
} from "../../domain/entities/fe-de-vida";

export type DecisionDTO = DecisionEntity;
export type SolicitudDTO = SolicitudEntity;
export type CambioDTO = CambioEntity;
export type DetalleSolicitudDTO = DetalleSolicitudEntity;
export type DetalleRevisionDTO = DetalleRevisionEntity;
export type ProcesoDTO = ProcesoEntity;
export type VigenteDTO = VigenteEntity;
export type ProrrogaDTO = ProrrogaEntity;
export type CoberturaDTO = CoberturaEntity;
export type TipoPensionDTO = TipoPensionEntity;
export type EvidenciaImagenDTO = EvidenciaImagenEntity;
export type PaginaDTO<T> = PaginaEntity<T>;

/** Resultado serializable de una Server Action (nunca lanza al cliente). */
export type ResultadoAccion<T = undefined> =
  { ok: true; mensaje: string; datos: T } | { ok: false; mensaje: string };
