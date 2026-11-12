import type {
  EstadoBloque,
  SolicitudBloque,
  VistaPreviaBloque,
} from "../entities/restablecimiento-bloque";

export interface RepoRestablecimientoBloque {
  vistaPrevia(solicitud: SolicitudBloque): Promise<VistaPreviaBloque>;
  ejecutar(solicitud: SolicitudBloque, confirmacion: number): Promise<EstadoBloque>;
  estado(taskId: string): Promise<EstadoBloque>;
  /** Excel con todas las cuentas de la selección (clasificación + alcance), como archivo. */
  excel(solicitud: SolicitudBloque): Promise<Blob>;
}
