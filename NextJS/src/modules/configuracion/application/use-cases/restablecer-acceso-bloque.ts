/** Casos de uso del restablecimiento de contraseñas en bloque (U2). */
import type {
  ArchivoBloque,
  EstadoBloque,
  SolicitudBloque,
  VistaPreviaBloque,
} from "../../domain/entities/restablecimiento-bloque";
import type { RepoRestablecimientoBloque } from "../../domain/ports/repo-restablecimiento-bloque";

export function calcularRestablecimientoBloque(
  repo: RepoRestablecimientoBloque,
  solicitud: SolicitudBloque,
): Promise<VistaPreviaBloque> {
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

export async function descargarExcelRestablecimientoBloque(
  repo: RepoRestablecimientoBloque,
  solicitud: SolicitudBloque,
): Promise<ArchivoBloque> {
  const blob = await repo.excel(solicitud);
  const buffer = await blob.arrayBuffer();
  return {
    base64: Buffer.from(buffer).toString("base64"),
    nombre: `restablecimiento_${solicitud.clasificacion.toLowerCase()}_${solicitud.alcance.toLowerCase()}.xlsx`,
  };
}
