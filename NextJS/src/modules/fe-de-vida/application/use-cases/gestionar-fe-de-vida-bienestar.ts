import type { FiltrosBandeja, RepoFeDeVida } from "../../domain/ports/repo-fe-de-vida";
import { MAX_LONGITUD_MOTIVO } from "../../domain/value-objects/estados";
import type {
  DetalleSolicitudDTO,
  PaginaDTO,
  SolicitudDTO,
  UrlEvidenciaDTO,
} from "../dtos/fe-de-vida-dto";
import { normalizarPagina, vacioAUndefined } from "./paginacion";

export function exigirTexto(valor: string, nombre: string): string {
  const t = valor.trim();
  if (!t) throw new Error(`${nombre} es obligatorio.`);
  if (t.length > MAX_LONGITUD_MOTIVO) {
    throw new Error(`${nombre} no puede superar ${MAX_LONGITUD_MOTIVO} caracteres.`);
  }
  return t;
}

export async function listarBandeja(
  repo: RepoFeDeVida,
  filtros: Partial<FiltrosBandeja> = {},
): Promise<PaginaDTO<SolicitudDTO>> {
  if (filtros.desde && filtros.hasta && filtros.desde > filtros.hasta) {
    throw new Error('El rango de fechas es inválido: "desde" es posterior a "hasta".');
  }
  return repo.listarBandeja({
    ...normalizarPagina(filtros.limit, filtros.offset),
    texto: vacioAUndefined(filtros.texto),
    estado: vacioAUndefined(filtros.estado),
    procesoId: vacioAUndefined(filtros.procesoId),
    desde: vacioAUndefined(filtros.desde),
    hasta: vacioAUndefined(filtros.hasta),
  });
}

export function obtenerDetalleRevision(repo: RepoFeDeVida, id: string): Promise<DetalleSolicitudDTO> {
  return repo.obtenerDetalleRevision(id);
}

export function obtenerUrlEvidencia(repo: RepoFeDeVida, id: string): Promise<UrlEvidenciaDTO> {
  return repo.obtenerUrlEvidencia(id);
}

export function registrarCheck(repo: RepoFeDeVida, id: string): Promise<SolicitudDTO> {
  return repo.registrarCheck(id);
}

/** Aprobación directa (solo Administradora): la justificación es obligatoria. */
export async function aprobarDirecto(
  repo: RepoFeDeVida,
  id: string,
  justificacion: string,
): Promise<SolicitudDTO> {
  return repo.aprobarDirecto(id, exigirTexto(justificacion, "La justificación"));
}

/** Devuelve para corrección: motivo obligatorio; `requiereNuevaFoto` pide otra foto al pasivo. */
export async function devolverSolicitud(
  repo: RepoFeDeVida,
  id: string,
  motivo: string,
  requiereNuevaFoto: boolean,
): Promise<SolicitudDTO> {
  return repo.devolver(id, exigirTexto(motivo, "El motivo"), requiereNuevaFoto);
}

/** Rechazo definitivo: motivo obligatorio. */
export async function rechazarSolicitud(
  repo: RepoFeDeVida,
  id: string,
  motivo: string,
): Promise<SolicitudDTO> {
  return repo.rechazar(id, exigirTexto(motivo, "El motivo"));
}
