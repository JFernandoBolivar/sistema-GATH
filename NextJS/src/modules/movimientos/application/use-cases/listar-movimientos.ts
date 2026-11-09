/**
 * Casos de uso de Consulta de Movimientos (Reglas R2, R4).
 */
import type { FiltrosMovimiento, RepoMovimientos } from "../../domain/ports/repo-movimientos";
import type { PaginaHistorial } from "../../domain/value-objects/resultado-historial";
import type {
  MovimientoCargoDTO,
  PaginaMovimientosDTO,
} from "../dtos/movimientos-dto";

export const PAGINA_POR_DEFECTO = 1;
export const TAMANO_POR_DEFECTO = 10;

export async function listarHistorialPorEmpleado(
  repo: RepoMovimientos,
  cedula: string,
): Promise<MovimientoCargoDTO[]> {
  const entidades = await repo.listarHistorialPorEmpleado(cedula);
  return entidades.map(aDto);
}

export async function listarHistorialPorCargo(
  repo: RepoMovimientos,
  codigoPuesto: string,
): Promise<MovimientoCargoDTO[]> {
  const entidades = await repo.listarHistorialPorCargo(codigoPuesto);
  return entidades.map(aDto);
}

export async function listarHistorialGeneral(
  repo: RepoMovimientos,
  filtros?: FiltrosMovimiento,
  pagina: number = PAGINA_POR_DEFECTO,
  tamano: number = TAMANO_POR_DEFECTO,
): Promise<PaginaMovimientosDTO> {
  if (repo.listarHistorial) {
    return aPaginaDto(await repo.listarHistorial(filtros, pagina, tamano));
  }
  // Dobles sin paginación (no debería ocurrir con el backend actual).
  const entidades = filtros?.cedula
    ? await repo.listarHistorialPorEmpleado(filtros.cedula)
    : filtros?.codigoPuesto
      ? await repo.listarHistorialPorCargo(filtros.codigoPuesto)
      : [];
  const items = entidades.map(aDto);
  return { resultados: items, total: items.length, pagina: 1, tamano: items.length, totalPaginas: 1 };
}

export async function listarTiposMovimientoDisponibles(
  repo: RepoMovimientos,
) {
  if (repo.listarTiposDisponibles) {
    return repo.listarTiposDisponibles();
  }
  return null;
}

function aPaginaDto(pagina: PaginaHistorial): PaginaMovimientosDTO {
  return {
    resultados: pagina.items.map(aDto),
    total: pagina.total,
    pagina: pagina.pagina,
    tamano: pagina.tamano,
    totalPaginas: pagina.totalPaginas,
  };
}

function aDto(e: Awaited<ReturnType<RepoMovimientos["listarHistorialPorEmpleado"]>>[number]): MovimientoCargoDTO {
  return {
    id: e.id,
    empleadoCedula: e.empleadoCedula,
    codigoPuesto: e.codigoPuesto,
    tipoMovimiento: e.tipoMovimiento,
    motivoId: e.motivoId,
    motivoNombre: e.motivoNombre,
    denominacionNombre: e.denominacionNombre,
    especificaNombre: e.especificaNombre,
    gradoNombre: e.gradoNombre,
    tipoNominaNombre: e.tipoNominaNombre,
    estatusNombre: e.estatusNombre,
    tipoPersonalNombre: e.tipoPersonalNombre,
    dependenciaNombre: e.dependenciaNombre,
    direccionGeneralNombre: e.direccionGeneralNombre,
    direccionLineaNombre: e.direccionLineaNombre,
    coordinacionNombre: e.coordinacionNombre,
    fechaMovimiento: e.fechaMovimiento,
    ejecutadoPorId: e.ejecutadoPorId,
    ejecutadoPorNombre: e.ejecutadoPorNombre,
  };
}
