/**
 * Puerto del Repositorio de Movimientos (Reglas R1, R4).
 *
 * Solo lectura: el historial de movimientos lo escriben `apps.cargos` /
 * `apps.pasivos` vía señal de dominio en el backend; el frontend únicamente
 * consulta el historial por empleado o por puesto.
 */
import type { MovimientoCargo } from "../entities/movimiento";

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
  listarHistorial?(filtros?: FiltrosMovimiento): Promise<MovimientoCargo[]>;
  listarTiposDisponibles?(): Promise<CatalogoTiposMovimientoInfo>;
  /** PDF del historial generado en backend (ReportLab), reemplaza el render client-side con @react-pdf/renderer. */
  descargarPdf?(filtros?: FiltrosMovimiento): Promise<Blob>;
}

