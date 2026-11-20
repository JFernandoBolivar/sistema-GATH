/** Carnet de trabajador pendiente de imprimir (B-6). */
export interface ColaImpresionCarnet {
  carnetId: number;
  cedula: string;
  nombre: string;
  cargo: string;
  departamento: string;
  motivo: string;
  fechaEmision: string | null;
}

/** Máximo de credenciales por lote de impresión (el backend rechaza más: 10 hojas A4 de 9). */
export const MAXIMO_POR_LOTE = 90;
