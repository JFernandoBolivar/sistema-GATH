/**
 * Implementación del repositorio de Movimientos usando la API REST.
 */
import type { RepoMovimientos } from "../../domain/ports/repo-movimientos";
import { movimientosApi } from "../http/movimientos-api";
import { movimientoApiAEntidad } from "../mappers/mapper-movimientos";

export const repoMovimientosApi: RepoMovimientos = {
  async listarHistorialPorEmpleado(cedula) {
    const raw = await movimientosApi.getHistorialPorEmpleado(cedula);
    return raw.map(movimientoApiAEntidad);
  },

  async listarHistorialPorCargo(codigoPuesto) {
    const raw = await movimientosApi.getHistorialPorCargo(codigoPuesto);
    return raw.map(movimientoApiAEntidad);
  },
};
