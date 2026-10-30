import type {
  EstadoProceso,
  EstadoSolicitud,
  OrigenEvidencia,
  TipoDecision,
} from "../value-objects/estados";

export interface DecisionEntity {
  readonly tipo: TipoDecision;
  readonly rol: string;
  readonly actorCedula: string;
  readonly envio: number;
  readonly motivo: string;
  readonly fecha: string | null;
}

export interface SolicitudEntity {
  readonly id: string;
  readonly procesoId: string;
  readonly cedula: string;
  readonly nombre: string;
  readonly estado: EstadoSolicitud;
  readonly version: number;
  readonly envios: number;
  readonly origenEvidencia: OrigenEvidencia | null;
  readonly tieneEvidencia: boolean;
  readonly viaAprobacion: string | null;
  readonly requiereNuevaFoto: boolean;
  readonly fechaEnvio: string | null;
  readonly fechaValidacion: string | null;
  readonly decisiones: readonly DecisionEntity[];
}

export interface CambioEntity {
  readonly id: string;
  readonly seccion: string;
  readonly accion: string;
  readonly entidad: string;
  readonly entidadId: string | null;
  readonly campo: string;
  readonly valorAnterior: unknown;
  readonly valorPropuesto: unknown;
  /** Solo en el detalle de revisión: valor real de hoy. */
  readonly valorActual: unknown;
  /** La ficha cambió desde que el pasivo propuso el valor. */
  readonly conflicto: boolean;
}

export interface DetalleSolicitudEntity {
  readonly solicitud: SolicitudEntity;
  readonly cambios: readonly CambioEntity[];
}

export interface TipoPensionEntity {
  readonly id: number;
  readonly nombre: string;
}

export interface ProcesoEntity {
  readonly id: string;
  readonly nombre: string;
  readonly estado: EstadoProceso;
  readonly apertura: string | null;
  readonly cierre: string | null;
  readonly cierreReal: string | null;
  /** Vacío = alcance a todos los pasivos. */
  readonly tiposNomina: readonly TipoPensionEntity[];
  readonly diasRecordatorio: readonly number[];
}

export interface VigenteEntity {
  readonly proceso: ProcesoEntity;
  readonly solicitud: SolicitudEntity | null;
  readonly puedeEnviar: boolean;
}

export interface ProrrogaEntity {
  readonly id: string;
  readonly procesoId: string;
  readonly cedula: string;
  readonly general: boolean;
  readonly nuevaFechaLimite: string | null;
  readonly motivo: string;
  readonly concedidaPor: string;
}

export interface CoberturaEntity {
  readonly cedula: string;
  readonly nombreCompleto: string;
  readonly tipoNomina: string;
  readonly correo: string;
  readonly sinCorreo: boolean;
  readonly tieneCuenta: boolean;
}

export interface UrlEvidenciaEntity {
  readonly url: string;
  readonly expiraEnSegundos: number;
}

export interface PaginaEntity<T> {
  readonly count: number;
  readonly limit: number;
  readonly offset: number;
  readonly results: readonly T[];
}
