/**
 * DTOs de Movimientos (Regla R5).
 */
export interface MovimientoCargoDTO {
  id: number;
  empleadoCedula: string;
  codigoPuesto: string;
  tipoMovimiento: string;
  motivoId: number | null;
  motivoNombre: string | null;
  denominacionNombre: string;
  especificaNombre: string;
  gradoNombre: string | null;
  tipoNominaNombre: string;
  estatusNombre: string;
  tipoPersonalNombre: string | null;
  dependenciaNombre: string | null;
  direccionGeneralNombre: string | null;
  direccionLineaNombre: string | null;
  coordinacionNombre: string | null;
  fechaMovimiento: string;
  ejecutadoPorId: number;
  ejecutadoPorNombre: string;
}

/** Página del historial (paginación en el servidor: 10 por defecto, tope 50). */
export interface PaginaMovimientosDTO {
  resultados: MovimientoCargoDTO[];
  total: number;
  pagina: number;
  tamano: number;
  totalPaginas: number;
}

/** Documento descargado (PDF/Excel) con el aviso de truncado del backend. */
export interface DescargaMovimientosDTO {
  blob: Blob;
  total: number | null;
  limite: number | null;
  truncado: boolean;
}
