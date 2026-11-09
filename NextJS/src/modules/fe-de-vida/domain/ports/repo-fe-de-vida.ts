import type {
  CoberturaEntity,
  DetalleRevisionEntity,
  DetalleSolicitudEntity,
  EvidenciaImagenEntity,
  InicioPresencialEntity,
  PaginaEntity,
  PasivoPresencialEntity,
  ProcesoEntity,
  ProrrogaEntity,
  SolicitudEntity,
  TipoPensionEntity,
  VigenteEntity,
} from "../entities/fe-de-vida";
import type { EstadoSolicitud } from "../value-objects/estados";
import type { EstadisticasEntity, PasivoEstadisticaEntity } from "../entities/estadisticas";
import type { ReenvioConstanciaDTO, RegenerarConstanciaDTO } from "../../application/dtos/fe-de-vida-dto";
import type { OrigenEvidencia } from "../value-objects/estados";

export interface PaginaPedida {
  limit: number;
  offset: number;
}

export interface FiltrosBandeja extends PaginaPedida {
  texto?: string;
  estado?: string;
  procesoId?: string;
  desde?: string;
  hasta?: string;
  historico?: boolean;
}

export interface FiltrosHistorial extends PaginaPedida {
  estado?: string;
}

export interface FiltrosProcesos extends PaginaPedida {
  estado?: string;
}

export interface FiltrosCobertura extends PaginaPedida {
  texto?: string;
  tipoNominaId?: number;
  sinCorreo?: boolean;
  sinCuenta?: boolean;
}

export interface FiltrosEstadisticas extends PaginaPedida {
  procesoId?: string;
  tipoNominaId?: number;
  estado?: EstadoSolicitud;
  canal?: "EN_LINEA" | "PRESENCIAL";
  desde?: string;
  hasta?: string;
}

/** Listado del detalle: faltan por responder o una casilla de la matriz. */
export interface FiltrosListadoEstadistica extends FiltrosEstadisticas {
  faltantes?: boolean;
}

export interface FiltrosExportacionEstadistica {
  procesoId?: string;
  tipoNominaId?: number;
  estado?: EstadoSolicitud;
  canal?: "EN_LINEA" | "PRESENCIAL";
  desde?: string;
  hasta?: string;
  listado: "faltantes" | "celda";
}

/** Cambio propuesto del acta tal como se envía al borrador. */
export interface CambioEntrada {
  seccion: string;
  entidad: string;
  accion: string;
  campo: string;
  valor: unknown;
  entidadId?: string | null;
}

export interface DatosProceso {
  nombre: string;
  apertura: string;
  cierre: string;
  /** Vacío = todos los pasivos. */
  tiposNomina: number[];
  diasRecordatorio: number[];
}

export interface DatosProrroga {
  nuevaFechaLimite: string;
  motivo: string;
  /** Vacía = prórroga general. */
  cedula?: string;
}

export interface EvidenciaNueva {
  archivo: File;
  origen: OrigenEvidencia;
  metadatos?: Record<string, unknown>;
}

/** Puerto de la fe de vida (pasivo, Bienestar, procesos y cobertura). */
export interface RepoFeDeVida {
  // Pasivo
  obtenerVigente(): Promise<VigenteEntity | null>;
  marcarGuiaVista(procesoId: string): Promise<boolean>;
  iniciarSolicitud(): Promise<SolicitudEntity>;
  listarMisSolicitudes(f: FiltrosHistorial): Promise<PaginaEntity<SolicitudEntity>>;
  obtenerMiSolicitud(id: string): Promise<DetalleSolicitudEntity>;
  guardarBorrador(id: string, cambios: CambioEntrada[]): Promise<DetalleSolicitudEntity>;
  subirEvidencia(id: string, evidencia: EvidenciaNueva): Promise<SolicitudEntity>;
  enviar(id: string): Promise<SolicitudEntity>;
  descargarConstancia(id: string): Promise<Blob>;
  // Revisión
  listarBandeja(f: FiltrosBandeja): Promise<PaginaEntity<SolicitudEntity>>;
  obtenerDetalleRevision(id: string): Promise<DetalleRevisionEntity>;
  obtenerEvidencia(id: string): Promise<EvidenciaImagenEntity>;
  registrarCheck(id: string): Promise<SolicitudEntity>;
  retirarCheck(id: string, motivo: string): Promise<SolicitudEntity>;
  aprobarDirecto(id: string, justificacion: string): Promise<SolicitudEntity>;
  devolver(id: string, motivo: string, requiereNuevaFoto: boolean): Promise<SolicitudEntity>;
  rechazar(id: string, motivo: string): Promise<SolicitudEntity>;
  reenviarConstancia(id: string): Promise<ReenvioConstanciaDTO>;
  regenerarConstancia(id: string, reenviar?: boolean): Promise<RegenerarConstanciaDTO>;
  // Procesos
  listarProcesos(f: FiltrosProcesos): Promise<PaginaEntity<ProcesoEntity>>;
  listarTiposPension(): Promise<TipoPensionEntity[]>;
  crearProceso(d: DatosProceso): Promise<ProcesoEntity>;
  editarProceso(id: string, d: DatosProceso): Promise<ProcesoEntity>;
  abrirProceso(id: string): Promise<ProcesoEntity>;
  cerrarProceso(id: string): Promise<ProcesoEntity>;
  listarProrrogas(procesoId: string): Promise<ProrrogaEntity[]>;
  prorrogar(procesoId: string, d: DatosProrroga): Promise<ProrrogaEntity>;
  // Cobertura
  listarCobertura(f: FiltrosCobertura): Promise<PaginaEntity<CoberturaEntity>>;
  // Estadísticas (O21)
  obtenerEstadisticas(f: FiltrosEstadisticas): Promise<EstadisticasEntity>;
  listarPasivosEstadistica(f: FiltrosListadoEstadistica): Promise<PaginaEntity<PasivoEstadisticaEntity>>;
  // Presencial
  buscarPasivosPresencial(f: { texto?: string } & PaginaPedida): Promise<PaginaEntity<PasivoPresencialEntity>>;
  iniciarSolicitudPresencial(cedula: string): Promise<InicioPresencialEntity>;
  guardarBorradorPresencial(
    id: string,
    cambios: CambioEntrada[],
    opciones?: { sinCorreoAlternativo?: boolean; justificacionSinCorreo?: string },
  ): Promise<DetalleSolicitudEntity>;
  subirEvidenciaPresencial(id: string, evidencia: EvidenciaNueva): Promise<SolicitudEntity>;
  enviarPresencial(id: string): Promise<SolicitudEntity>;
  descargarConstanciaBienestar(id: string): Promise<Blob>;
}
