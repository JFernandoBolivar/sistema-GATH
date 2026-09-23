/**
 * Implementación del repositorio de Movimientos usando la API REST.
 */
import type { FiltrosMovimiento, RepoMovimientos } from "../../domain/ports/repo-movimientos";
import { movimientosApi, type MovimientoApiItem } from "../http/movimientos-api";
import { movimientoApiAEntidad } from "../mappers/mapper-movimientos";

function extraerLista(raw: unknown): MovimientoApiItem[] {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === "object" && Array.isArray((raw as { data?: unknown }).data)) {
    return (raw as { data: MovimientoApiItem[] }).data;
  }
  return [];
}

export const repoMovimientosApi: RepoMovimientos = {
  async listarHistorial(filtros?: FiltrosMovimiento) {
    const raw = await movimientosApi.getHistorial({
      cedula: filtros?.cedula,
      codigo_puesto: filtros?.codigoPuesto,
      tipo_movimiento: filtros?.tipoMovimiento,
      fecha_inicio: filtros?.fechaInicio,
      fecha_fin: filtros?.fechaFin,
      gerencia: filtros?.gerencia,
      estatus: filtros?.estatus,
    });
    return extraerLista(raw).map(movimientoApiAEntidad);
  },

  async listarHistorialPorEmpleado(cedula) {
    const raw = await movimientosApi.getHistorialPorEmpleado(cedula);
    return extraerLista(raw).map(movimientoApiAEntidad);
  },

  async listarHistorialPorCargo(codigoPuesto) {
    const raw = await movimientosApi.getHistorialPorCargo(codigoPuesto);
    return extraerLista(raw).map(movimientoApiAEntidad);
  },
};

