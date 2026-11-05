/**
 * Parámetros de entrada del caso de uso `procesar_egreso` (Regla R2).
 */
export interface ProcesarEgresoInput {
  cedula: string;
  motivoMovimientoId: number;
  tipoNominaId: number;
  liberarActivos: boolean;
  /** O8: fecha real de egreso del servicio activo (AAAA-MM-DD). */
  fechaEgreso?: string;
}
