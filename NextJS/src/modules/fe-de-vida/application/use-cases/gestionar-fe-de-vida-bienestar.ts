import type { FiltrosBandeja, RepoFeDeVida } from "../../domain/ports/repo-fe-de-vida";
import { MAX_LONGITUD_MOTIVO } from "../../domain/value-objects/estados";
import type {
  DetalleRevisionDTO,
  EvidenciaImagenDTO,
  PaginaDTO,
  SolicitudDTO,
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

export function obtenerDetalleRevision(repo: RepoFeDeVida, id: string): Promise<DetalleRevisionDTO> {
  return repo.obtenerDetalleRevision(id);
}

/** La foto la sirve el backend (el almacén no es alcanzable desde el navegador). */
export function obtenerEvidencia(repo: RepoFeDeVida, id: string): Promise<EvidenciaImagenDTO> {
  return repo.obtenerEvidencia(id);
}

export function registrarCheck(repo: RepoFeDeVida, id: string): Promise<SolicitudDTO> {
  return repo.registrarCheck(id);
}

export const MOTIVO_RETIRO_MIN_PALABRAS = 5;
export const MOTIVO_RETIRO_MIN_CARACTERES = 20;

/** Retira el check propio: justificación obligatoria (mismas reglas que el servidor, que las vuelve a validar). */
export async function retirarCheck(repo: RepoFeDeVida, id: string, motivo: string): Promise<SolicitudDTO> {
  const limpio = exigirTexto(motivo, "La justificación").replace(/\s+/g, " ");
  if (limpio.length < MOTIVO_RETIRO_MIN_CARACTERES || limpio.split(" ").length < MOTIVO_RETIRO_MIN_PALABRAS) {
    throw new Error(
      `La justificación debe tener al menos ${MOTIVO_RETIRO_MIN_PALABRAS} palabras y ${MOTIVO_RETIRO_MIN_CARACTERES} caracteres.`,
    );
  }
  if (/[<>]/.test(limpio)) throw new Error("La justificación no puede contener los símbolos < o >.");
  return repo.retirarCheck(id, limpio);
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
