/** Casos de uso de la corrección de cédula de un trabajador. */
import type {
  EjecucionCorreccionCedula,
  ResultadoCorreccionCedula,
  SolicitudCorreccionCedula,
  VistaPreviaCorreccionCedula,
} from "../../domain/entities/correccion-cedula";
import type { RepoCorreccionCedula } from "../../domain/ports/repo-correccion-cedula";

export function verificarCorreccionCedula(
  repo: RepoCorreccionCedula,
  solicitud: SolicitudCorreccionCedula,
): Promise<VistaPreviaCorreccionCedula> {
  return repo.vistaPrevia(solicitud);
}

export function ejecutarCorreccionCedula(
  repo: RepoCorreccionCedula,
  solicitud: EjecucionCorreccionCedula,
): Promise<ResultadoCorreccionCedula> {
  return repo.ejecutar(solicitud);
}
