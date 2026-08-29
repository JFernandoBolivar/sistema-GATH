/**
 * Puerto del Repositorio de Movimientos (Reglas R1, R4).
 *
 * Solo lectura: el historial de movimientos lo escriben `apps.cargos` /
 * `apps.pasivos` vía señal de dominio en el backend; el frontend únicamente
 * consulta el historial por empleado o por puesto.
 */
import type { MovimientoCargo } from "../entities/movimiento";

export interface RepoMovimientos {
  listarHistorialPorEmpleado(cedula: string): Promise<MovimientoCargo[]>;
  listarHistorialPorCargo(codigoPuesto: string): Promise<MovimientoCargo[]>;
}
