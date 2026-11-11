/**
 * Modelos serializables de los parámetros del sistema (D9).
 *
 * Viven en `domain/` porque el puerto `RepoParametros` los usa: un `domain` no
 * puede depender de `application/` (S5-02). `application/dtos/parametro-dto`
 * los reexporta para no romper los imports existentes.
 */

export type TipoParametro = "booleano" | "entero" | "texto";

export interface OpcionParametroDTO {
  valor: string;
  etiqueta: string;
}

export interface DependeDeDTO {
  clave: string;
  valor: string;
}

export interface TrabajadorParametroDTO {
  cedula: string;
  nombre: string;
  tiene_cuenta: boolean;
  cuenta_activa: boolean;
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
  depende_de?: DependeDeDTO | null;
}

export interface CambioParametroDTO {
  fecha: string;
  actorCedula: string;
  valorPrevio: string;
  valorNuevo: string;
  resultado: string;
  agregados?: string[];
  quitados?: string[];
  resumen_cambio?: string | null;
}

export interface PaginaCambiosDTO {
  resultados: CambioParametroDTO[];
  total: number;
  pagina: number;
  tamano: number;
  totalPaginas: number;
}
