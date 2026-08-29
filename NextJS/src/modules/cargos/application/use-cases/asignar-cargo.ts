/**
 * Casos de uso de Asignación y Desasignación de Puestos (Reglas R2, R4).
 */
import type { RepoCargos } from "../../domain/ports/repo-cargos";
import type { CargoAsignacionDTO } from "../dtos/cargo-dto";

export async function asignarCargo(
  repo: RepoCargos,
  cargoId: number,
  empleadoCedula: string
): Promise<CargoAsignacionDTO> {
  const e = await repo.asignarCargo(cargoId, empleadoCedula);
  return {
    id: e.id,
    codigoNomina: e.codigoNomina,
    empleadoCedula: e.empleadoCedula,
    empleadoNombre: e.empleadoNombre,
    denominacionCargoId: e.denominacionCargoId,
    denominacionCargoNombre: e.denominacionCargoNombre,
    dependenciaId: e.dependenciaId,
    dependenciaNombre: e.dependenciaNombre,
    direccionGeneralId: e.direccionGeneralId,
    direccionGeneralNombre: e.direccionGeneralNombre,
    activo: e.activo,
    estaVacante: e.estaVacante,
  };
}

export async function desasignarCargo(
  repo: RepoCargos,
  cargoId: number
): Promise<CargoAsignacionDTO> {
  const e = await repo.desasignarCargo(cargoId);
  return {
    id: e.id,
    codigoNomina: e.codigoNomina,
    empleadoCedula: e.empleadoCedula,
    empleadoNombre: e.empleadoNombre,
    denominacionCargoId: e.denominacionCargoId,
    denominacionCargoNombre: e.denominacionCargoNombre,
    dependenciaId: e.dependenciaId,
    dependenciaNombre: e.dependenciaNombre,
    direccionGeneralId: e.direccionGeneralId,
    direccionGeneralNombre: e.direccionGeneralNombre,
    activo: e.activo,
    estaVacante: e.estaVacante,
  };
}
