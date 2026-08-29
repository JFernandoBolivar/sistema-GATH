/**
 * Casos de uso de Consulta de Movimientos (Reglas R2, R4).
 */
import type { RepoMovimientos } from "../../domain/ports/repo-movimientos";
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
