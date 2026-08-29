/**
 * Entidades de Dominio de Movimientos de Cargo (Regla R1).
 *
 * Alineado a `MovimientoCargoSerializer` del backend
 * (`apps/movimientos/presentation/serializers/movimientos_serializers.py`).
 * Representa un registro del historial de movimientos de cargo de un
 * empleado o de un puesto (Fase 2.5 del plan de reparación).
 */
export interface MovimientoCargo {
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
