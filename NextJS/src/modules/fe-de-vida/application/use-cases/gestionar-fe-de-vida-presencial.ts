import type {
  CambioEntrada,
  EvidenciaNueva,
  PaginaPedida,
  RepoFeDeVida,
} from "../../domain/ports/repo-fe-de-vida";
import { MAX_BYTES_EVIDENCIA, TIPOS_EVIDENCIA } from "../../domain/value-objects/evidencia";
import type {
  DetalleSolicitudDTO,
  InicioPresencialDTO,
  PaginaDTO,
  PasivoPresencialDTO,
  SolicitudDTO,
} from "../dtos/fe-de-vida-dto";
import { normalizarPagina, vacioAUndefined } from "./paginacion";

export function buscarPasivosPresencial(
  repo: RepoFeDeVida,
  filtros: { texto?: string } & Partial<PaginaPedida> = {},
): Promise<PaginaDTO<PasivoPresencialDTO>> {
  return repo.buscarPasivosPresencial({
    ...normalizarPagina(filtros.limit, filtros.offset),
    texto: vacioAUndefined(filtros.texto),
  });
}

export function iniciarSolicitudPresencial(
  repo: RepoFeDeVida,
  cedula: string,
): Promise<InicioPresencialDTO> {
  return repo.iniciarSolicitudPresencial(cedula.trim());
}

export function guardarBorradorPresencial(
  repo: RepoFeDeVida,
  id: string,
  cambios: CambioEntrada[],
  opciones?: { sinCorreoAlternativo?: boolean; justificacionSinCorreo?: string },
): Promise<DetalleSolicitudDTO> {
  return repo.guardarBorradorPresencial(id, cambios, opciones);
}

export async function subirEvidenciaPresencial(
  repo: RepoFeDeVida,
  id: string,
  evidencia: EvidenciaNueva,
): Promise<SolicitudDTO> {
  if (evidencia.archivo.size > MAX_BYTES_EVIDENCIA) {
    throw new Error(
      `El archivo supera el tamaño máximo permitido (${Math.round(MAX_BYTES_EVIDENCIA / (1024 * 1024))} MB).`,
    );
  }
  if (!TIPOS_EVIDENCIA.includes(evidencia.archivo.type as (typeof TIPOS_EVIDENCIA)[number])) {
    throw new Error("Formato no admitido. Debe ser una foto JPG o PNG.");
  }
  return repo.subirEvidenciaPresencial(id, evidencia);
}

export function enviarPresencial(
  repo: RepoFeDeVida,
  id: string,
): Promise<SolicitudDTO> {
  return repo.enviarPresencial(id);
}

export function descargarConstanciaBienestar(
  repo: RepoFeDeVida,
  id: string,
): Promise<Blob> {
  return repo.descargarConstanciaBienestar(id);
}
