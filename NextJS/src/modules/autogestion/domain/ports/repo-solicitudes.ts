import type {
  DatosComplementariosEntity,
  DecisionCampo,
  ItemBorrador,
  PaginaSolicitudesEntity,
  SeccionAutogestionEntity,
  SolicitudDetalleEntity,
  SolicitudEntity,
  SoporteEntity,
} from "../entities/solicitud-actualizacion";

export interface FiltrosBandeja {
  estado?: string;
  cedula?: string;
  limit: number;
  offset: number;
}

/** Filtros de «Mis solicitudes»: estado y rango (inclusivo, AAAA-MM-DD) de la fecha de solicitud. */
export interface FiltrosMisSolicitudes {
  estado?: string;
  fechaDesde?: string;
  fechaHasta?: string;
  limit: number;
  offset: number;
}

export interface SoporteNuevo {
  seccion: string;
  tipo: string;
  archivo: File;
}

export interface DecisionCambios {
  version: number;
  decisiones: DecisionCampo[];
  motivoGeneral?: string;
}

/** Puerto de las solicitudes de actualización (trabajador y Bienestar). */
export interface RepoSolicitudes {
  // Trabajador
  listarMias(filtros: FiltrosMisSolicitudes): Promise<PaginaSolicitudesEntity>;
  obtenerMia(id: string): Promise<SolicitudDetalleEntity>;
  solicitar(campos: string[], motivo: string): Promise<SolicitudEntity>;
  guardarBorrador(
    id: string,
    cambios: ItemBorrador[],
    version?: number,
  ): Promise<SolicitudDetalleEntity>;
  subirSoporte(id: string, soporte: SoporteNuevo): Promise<SoporteEntity>;
  eliminarSoporte(id: string, soporteId: string): Promise<void>;
  enviar(id: string, version?: number): Promise<SolicitudEntity>;
  listarSecciones(): Promise<SeccionAutogestionEntity[]>;
  obtenerMisDatosComplementarios(): Promise<DatosComplementariosEntity>;
  // Bienestar
  listarBandeja(filtros: FiltrosBandeja): Promise<PaginaSolicitudesEntity>;
  obtenerDetalle(id: string): Promise<SolicitudDetalleEntity>;
  obtenerComparativo(id: string): Promise<SolicitudDetalleEntity>;
  habilitar(id: string, plazoDias: number, secciones?: string[]): Promise<SolicitudEntity>;
  prorrogar(id: string, nuevaFechaFin: string, motivo: string): Promise<SolicitudEntity>;
  decidir(id: string, decision: DecisionCambios): Promise<SolicitudDetalleEntity>;
  devolver(id: string, motivo: string, version?: number): Promise<SolicitudEntity>;
  rechazar(id: string, motivo: string, version?: number): Promise<SolicitudEntity>;
}
