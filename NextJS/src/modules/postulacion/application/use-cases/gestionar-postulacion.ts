/**
 * Casos de uso del postulante sobre su propio expediente. Todos reciben el token de Django
 * (leído en el servidor por `sesion-postulante.ts`): el expediente sale SIEMPRE de ese token.
 */
import type { ValoresVentana1 } from "../../domain/ventana1";
import type { CatalogosVentana2 } from "../../domain/ventana2";
import type { EnvioDTO, MiExpedienteDTO, SesionInvitadoDTO, Ventana2DTO } from "../dtos/postulacion-dto";
import type { RepoPostulacion } from "../ports/repo-postulacion";

export function obtenerMiExpediente(repo: RepoPostulacion, token: string): Promise<MiExpedienteDTO> {
  return repo.obtenerMiExpediente(token);
}

export function guardarBorrador(
  repo: RepoPostulacion,
  token: string,
  valores: ValoresVentana1,
): Promise<MiExpedienteDTO> {
  return repo.guardarBorrador(token, valores);
}

export function enviarACaptacion(repo: RepoPostulacion, token: string): Promise<EnvioDTO> {
  return repo.enviar(token);
}

export function cambiarClave(
  repo: RepoPostulacion,
  token: string,
  claveActual: string,
  claveNueva: string,
): Promise<SesionInvitadoDTO> {
  return repo.cambiarClave(token, claveActual, claveNueva);
}

export function obtenerVentana2(repo: RepoPostulacion, token: string): Promise<Ventana2DTO> {
  return repo.obtenerVentana2(token);
}

export function guardarVentana2(
  repo: RepoPostulacion,
  token: string,
  cuerpo: Record<string, unknown>,
): Promise<Ventana2DTO> {
  return repo.guardarVentana2(token, cuerpo);
}

export function catalogosVentana2(
  repo: RepoPostulacion,
  token: string,
  estadoId?: number,
  municipioId?: number,
): Promise<CatalogosVentana2> {
  return repo.catalogosVentana2(token, estadoId, municipioId);
}
