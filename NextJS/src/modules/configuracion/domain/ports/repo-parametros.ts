/** Puerto del repositorio de parámetros del sistema (D9). */
import type {
  PaginaCambiosDTO,
  ParametroDTO,
} from "../../application/dtos/parametro-dto";

export interface RepoParametros {
  listar(): Promise<ParametroDTO[]>;
  actualizar(clave: string, valor: string): Promise<ParametroDTO>;
  historial(clave: string, pagina: number, tamano: number): Promise<PaginaCambiosDTO>;
  diasRecordatorioFeDeVida(): Promise<number[]>;
}
