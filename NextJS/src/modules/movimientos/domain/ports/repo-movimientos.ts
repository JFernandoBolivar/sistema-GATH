/**
 * Puerto del Repositorio de Movimientos (Reglas R1, R4).
 *
 * Solo lectura: el historial de movimientos lo escriben `apps.cargos` /
 * `apps.pasivos` vía señal de dominio en el backend; el frontend únicamente
 * consulta el historial por empleado o por puesto.
 */
import type { MovimientoCargo } from "../entities/movimiento";
import type { PaginaHistorial } from "../value-objects/resultado-historial";

export interface FiltrosMovimiento {
  cedula?: string;
  codigoPuesto?: string;
  categoria?: string;
  tipoMovimiento?: string;
  fechaInicio?: string;
  fechaFin?: string;
  gerencia?: string;
  estatus?: string;
}

export interface CatalogoTiposMovimientoInfo {
  categorias: string[];
  motivos_por_categoria: Record<string, string[]>;
}

export interface RepoMovimientos {
  listarHistorialPorEmpleado(cedula: string): Promise<MovimientoCargo[]>;
  listarHistorialPorCargo(codigoPuesto: string): Promise<MovimientoCargo[]>;
  /** Página del historial general (paginación en el servidor). */
  listarHistorial?(
    filtros?: FiltrosMovimiento,
    pagina?: number,
    tamano?: number,
  ): Promise<PaginaHistorial>;
  listarTiposDisponibles?(): Promise<CatalogoTiposMovimientoInfo>;
}
