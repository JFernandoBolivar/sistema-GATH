import type {
  AccionRevision,
  EstadoProceso,
  EstadoSolicitud,
  OrigenEvidencia,
  TipoDecision,
} from "../value-objects/estados";

export interface DecisionEntity {
  readonly tipo: TipoDecision;
  readonly rol: string;
  readonly actorCedula: string;
  /** Solo en el detalle de revisión: nombre de quien decidió (la cédula si no se halla). */
  readonly actorNombre: string;
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

/** Niveles de la estructura organizativa de la asignación (para calcular la oficina de adscripción). */
export interface AsignacionFicha {
  readonly tipoNomina: string | null;
  readonly cargo: string | null;
  readonly dependencia: string | null;
  readonly direccionGeneral: string | null;
  readonly direccionLinea: string | null;
  readonly coordinacion: string | null;
}

export interface ViviendaFicha {
  /** Ids vigentes: sirven de padre para resolver los nombres de municipio y parroquia declarados. */
  readonly estadoId: number | null;
  readonly municipioId: number | null;
  readonly estado: string | null;
  readonly municipio: string | null;
  readonly parroquia: string | null;
  readonly codigoPostal: string | null;
  readonly direccion: string | null;
  readonly condicion: string | null;
}

export interface ContactoEmergenciaFicha {
  readonly id: string;
  readonly nombres: string;
  readonly apellidos: string;
  readonly parentesco: string | null;
  readonly telefono: string | null;
}

export interface FamiliarFicha {
  readonly id: string;
  readonly nombre: string;
  readonly parentesco: string | null;
  readonly cedula: string | null;
  readonly fechaNacimiento: string | null;
}

/** Datos actuales del pasivo en el sistema (solo lectura) para quien revisa. */
export interface FichaPasivoEntity {
  readonly cedula: string;
  readonly nombres: string;
  readonly apellidos: string;
  readonly sexo: string | null;
  readonly fechaNacimiento: string | null;
  readonly correo: string | null;
  readonly correoAlternativo: string | null;
  readonly telefonoMovil: string | null;
  readonly telefonoHabitacion: string | null;
  readonly asignacion: AsignacionFicha | null;
  readonly fechaIngreso: string | null;
  readonly fechaEgreso: string | null;
  readonly vivienda: ViviendaFicha | null;
  readonly contactosEmergencia: readonly ContactoEmergenciaFicha[];
  readonly familiares: readonly FamiliarFicha[];
  /** `null` = el pasivo nunca lo declaró. */
  readonly tieneHijos: boolean | null;
}

/** Detalle de revisión: comparativo, ficha completa y las acciones que el usuario puede ejecutar. */
export interface DetalleRevisionEntity extends DetalleSolicitudEntity {
  readonly procesoNombre: string;
  readonly ficha: FichaPasivoEntity | null;
  readonly acciones: readonly AccionRevision[];
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

/** Foto con la cédula tal como la sirve el backend (bytes en base64 para cruzar la Server Action). */
export interface EvidenciaImagenEntity {
  readonly mime: string;
  readonly base64: string;
}

export interface PaginaEntity<T> {
  readonly count: number;
  readonly limit: number;
  readonly offset: number;
  readonly results: readonly T[];
}
