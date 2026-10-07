/**
 * Implementación del repositorio de Movimientos usando la API REST.
 */
import type { FiltrosMovimiento, RepoMovimientos } from "../../domain/ports/repo-movimientos";
import { movimientosApi, type MovimientoApiItem } from "../http/movimientos-api";
import { movimientoApiAEntidad } from "../mappers/mapper-movimientos";

function extraerLista<T = MovimientoApiItem>(raw: unknown): T[] {
  if (Array.isArray(raw)) return raw as T[];
  if (raw && typeof raw === "object" && Array.isArray((raw as { data?: unknown }).data)) {
    return (raw as { data: T[] }).data;
  }
  return [];
}

export const repoMovimientosApi: RepoMovimientos = {
  async listarHistorial(filtros?: FiltrosMovimiento) {
    const raw = await movimientosApi.getHistorial({
      cedula: filtros?.cedula,
      codigo_puesto: filtros?.codigoPuesto,
      categoria: filtros?.categoria,
      tipo_movimiento: filtros?.tipoMovimiento,
      fecha_inicio: filtros?.fechaInicio,
      fecha_fin: filtros?.fechaFin,
      gerencia: filtros?.gerencia,
      estatus: filtros?.estatus,
    });
    return extraerLista<MovimientoApiItem>(raw).map(movimientoApiAEntidad);
  },

  async listarHistorialPorEmpleado(cedula) {
    const raw = await movimientosApi.getHistorialPorEmpleado(cedula);
    return extraerLista<MovimientoApiItem>(raw).map(movimientoApiAEntidad);
  },

  async listarHistorialPorCargo(codigoPuesto) {
    const raw = await movimientosApi.getHistorialPorCargo(codigoPuesto);
    return extraerLista<MovimientoApiItem>(raw).map(movimientoApiAEntidad);
  },

  async listarTiposDisponibles() {
    const raw = await movimientosApi.getTiposDisponibles();
    if (raw && typeof raw === "object" && "data" in raw) {
      return (raw as { data: any }).data;
    }
    return raw as any;
  },

  async descargarPdf(filtros?: FiltrosMovimiento) {
    return movimientosApi.getPdf({
      cedula: filtros?.cedula,
      codigo_puesto: filtros?.codigoPuesto,
      categoria: filtros?.categoria,
      tipo_movimiento: filtros?.tipoMovimiento,
      fecha_inicio: filtros?.fechaInicio,
      fecha_fin: filtros?.fechaFin,
      gerencia: filtros?.gerencia,
      estatus: filtros?.estatus,
    });
  },
};

