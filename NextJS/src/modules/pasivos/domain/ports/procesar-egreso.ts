/**
 * Parámetros de entrada del caso de uso `procesar_egreso` (Regla R2).
 */
export interface ProcesarEgresoInput {
  cedula: string;
  motivoMovimientoId: number;
  tipoNominaId: number;
  liberarActivos: boolean;
}
