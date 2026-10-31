/** DTOs de los parámetros del sistema (D9). */

export type TipoParametro = "booleano" | "entero" | "texto";

export interface ParametroDTO {
  clave: string;
  etiqueta: string;
  descripcion: string;
  grupo: string;
  tipo: TipoParametro;
  valor: string;
  defecto: string;
  minimo: number | null;
  maximo: number | null;
  actualizadoPorId: number | null;
  actualizadoEn: string | null;
}

export interface CambioParametroDTO {
  fecha: string;
  actorCedula: string;
  valorPrevio: string;
  valorNuevo: string;
  resultado: string;
}

export interface PaginaCambiosDTO {
  resultados: CambioParametroDTO[];
  total: number;
  pagina: number;
  tamano: number;
  totalPaginas: number;
}
