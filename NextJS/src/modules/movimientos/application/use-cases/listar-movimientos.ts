/**
 * Casos de uso de Consulta de Movimientos (Reglas R2, R4).
 */
import type { FiltrosMovimiento, RepoMovimientos } from "../../domain/ports/repo-movimientos";
import type { MovimientoCargoDTO } from "../dtos/movimientos-dto";

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
): Promise<MovimientoCargoDTO[]> {
  if (repo.listarHistorial) {
    const entidades = await repo.listarHistorial(filtros);
    return entidades.map(aDto);
  }
  if (filtros?.cedula) {
    return listarHistorialPorEmpleado(repo, filtros.cedula);
  }
  if (filtros?.codigoPuesto) {
    return listarHistorialPorCargo(repo, filtros.codigoPuesto);
  }
  return [];
}

export async function listarTiposMovimientoDisponibles(
  repo: RepoMovimientos,
) {
  if (repo.listarTiposDisponibles) {
    return repo.listarTiposDisponibles();
  }
  return null;
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
