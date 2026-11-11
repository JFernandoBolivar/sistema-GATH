/** Casos de uso del restablecimiento de contraseñas en bloque (U2). */
import type {
  EstadoBloque,
  SolicitudBloque,
} from "../../domain/entities/restablecimiento-bloque";
import type { RepoRestablecimientoBloque } from "../../domain/ports/repo-restablecimiento-bloque";

export function calcularRestablecimientoBloque(
  repo: RepoRestablecimientoBloque,
  solicitud: SolicitudBloque,
): Promise<EstadoBloque> {
  return repo.vistaPrevia(solicitud);
}

export function ejecutarRestablecimientoBloque(
  repo: RepoRestablecimientoBloque,
  solicitud: SolicitudBloque,
  confirmacion: number,
): Promise<EstadoBloque> {
  return repo.ejecutar(solicitud, confirmacion);
}

export function consultarRestablecimientoBloque(
  repo: RepoRestablecimientoBloque,
  taskId: string,
): Promise<EstadoBloque> {
  return repo.estado(taskId);
}
