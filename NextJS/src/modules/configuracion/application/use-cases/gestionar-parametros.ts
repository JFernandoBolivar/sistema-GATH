/** Casos de uso de parámetros del sistema (D9). */
import type {
  PaginaCambiosDTO,
  ParametroDTO,
} from "../dtos/parametro-dto";
import type { RepoParametros } from "../../domain/ports/repo-parametros";

export const PAGINA_POR_DEFECTO = 1;
export const TAMANO_POR_DEFECTO = 10;

export function listarParametros(repo: RepoParametros): Promise<ParametroDTO[]> {
  return repo.listar();
}

export function actualizarParametro(
  repo: RepoParametros,
  clave: string,
  valor: string,
): Promise<ParametroDTO> {
  return repo.actualizar(clave, valor);
}

export function historialParametro(
  repo: RepoParametros,
  clave: string,
  pagina: number = PAGINA_POR_DEFECTO,
  tamano: number = TAMANO_POR_DEFECTO,
): Promise<PaginaCambiosDTO> {
  return repo.historial(clave, pagina, tamano);
}

export function diasRecordatorioFeDeVida(repo: RepoParametros): Promise<number[]> {
  return repo.diasRecordatorioFeDeVida();
}
