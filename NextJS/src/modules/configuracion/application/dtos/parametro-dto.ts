/** DTOs de los parámetros del sistema (D9). */

export type TipoParametro = "booleano" | "entero" | "texto";

export interface OpcionParametroDTO {
  valor: string;
  etiqueta: string;
}

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
  /** Si no está vacío, el valor se elige de esta lista (p. ej. retención). */
  opciones: OpcionParametroDTO[];
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
