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
