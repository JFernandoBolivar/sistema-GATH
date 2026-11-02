import type { MovimientoCargo } from "../entities/movimiento";

/** Página del historial tal como la entrega el repositorio. */
export interface PaginaHistorial {
  items: MovimientoCargo[];
  total: number;
  pagina: number;
  tamano: number;
  totalPaginas: number;
}

/** Documento descargado (PDF/Excel) con los metadatos de truncado. */
export interface ArchivoDescargado {
  blob: Blob;
  total: number | null;
  limite: number | null;
  truncado: boolean;
}
