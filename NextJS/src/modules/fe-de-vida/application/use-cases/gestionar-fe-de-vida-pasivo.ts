import type {
  CambioEntrada,
  EvidenciaNueva,
  FiltrosHistorial,
  RepoFeDeVida,
} from "../../domain/ports/repo-fe-de-vida";
import { MAX_BYTES_EVIDENCIA, TIPOS_EVIDENCIA } from "../../domain/value-objects/evidencia";
import type {
  DetalleSolicitudDTO,
  PaginaDTO,
  SolicitudDTO,
  VigenteDTO,
} from "../dtos/fe-de-vida-dto";
import { normalizarPagina, vacioAUndefined } from "./paginacion";

export function obtenerVigente(repo: RepoFeDeVida): Promise<VigenteDTO | null> {
  return repo.obtenerVigente();
}

export function iniciarSolicitud(repo: RepoFeDeVida): Promise<SolicitudDTO> {
  return repo.iniciarSolicitud();
}

export function listarMisSolicitudes(
  repo: RepoFeDeVida,
  filtros: Partial<FiltrosHistorial> = {},
): Promise<PaginaDTO<SolicitudDTO>> {
  return repo.listarMisSolicitudes({
    ...normalizarPagina(filtros.limit, filtros.offset),
    estado: vacioAUndefined(filtros.estado),
  });
}

export function obtenerMiSolicitud(repo: RepoFeDeVida, id: string): Promise<DetalleSolicitudDTO> {
  return repo.obtenerMiSolicitud(id);
}

export function guardarBorrador(
  repo: RepoFeDeVida,
  id: string,
  cambios: CambioEntrada[],
): Promise<DetalleSolicitudDTO> {
  return repo.guardarBorrador(id, cambios);
}

/** Valida tipo y tamaño de la foto antes de enviarla (el servidor vuelve a validar la firma real). */
export async function subirEvidencia(
  repo: RepoFeDeVida,
  id: string,
  evidencia: EvidenciaNueva,
): Promise<SolicitudDTO> {
  const { archivo } = evidencia;
  if (!(TIPOS_EVIDENCIA as readonly string[]).includes(archivo.type)) {
    throw new Error("La foto debe ser JPG o PNG.");
  }
  if (archivo.size === 0) throw new Error("La foto está vacía.");
  if (archivo.size > MAX_BYTES_EVIDENCIA) {
    throw new Error(`La foto no puede pesar más de ${Math.round(MAX_BYTES_EVIDENCIA / 1048576)} MB.`);
  }
  return repo.subirEvidencia(id, evidencia);
}

export function enviarSolicitud(repo: RepoFeDeVida, id: string): Promise<SolicitudDTO> {
  return repo.enviar(id);
}

export function descargarConstancia(repo: RepoFeDeVida, id: string): Promise<Blob> {
  return repo.descargarConstancia(id);
}
