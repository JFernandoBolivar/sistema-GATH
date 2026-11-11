import type {
  EstadoBloque,
  SolicitudBloque,
} from "../entities/restablecimiento-bloque";

export interface RepoRestablecimientoBloque {
  vistaPrevia(solicitud: SolicitudBloque): Promise<EstadoBloque>;
  ejecutar(solicitud: SolicitudBloque, confirmacion: number): Promise<EstadoBloque>;
  estado(taskId: string): Promise<EstadoBloque>;
}
