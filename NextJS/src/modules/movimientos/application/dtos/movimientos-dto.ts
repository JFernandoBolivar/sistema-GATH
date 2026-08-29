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
