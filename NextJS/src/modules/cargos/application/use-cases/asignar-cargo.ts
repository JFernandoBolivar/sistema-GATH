/**
 * Casos de uso de Asignación, Desasignación, Traslado y Gestión de Estatus de
 * Puestos (Reglas R2, R4).
 */
import type { RepoCargos } from "../../domain/ports/repo-cargos";
import type {
  CargoAsignacionDTO,
  CambiarCargoInputDTO,
  CrearCargoEspecialInputDTO,
  GestionarEstatusInputDTO,
} from "../dtos/cargo-dto";
import type { CargoAsignacion } from "../../domain/entities/cargo";

function aDto(e: CargoAsignacion): CargoAsignacionDTO {
  return {
    id: e.id,
    codigo: e.codigo,
    empleadoCedula: e.empleadoCedula,
    denominacionId: e.denominacionId,
    denominacionNombre: e.denominacionNombre,
    especificaId: e.especificaId,
    especificaNombre: e.especificaNombre,
    tipoNominaId: e.tipoNominaId,
    tipoNominaNombre: e.tipoNominaNombre,
    estatusId: e.estatusId,
    estatusNombre: e.estatusNombre,
    dependenciaId: e.dependenciaId,
    dependenciaNombre: e.dependenciaNombre,
    direccionGeneralId: e.direccionGeneralId,
    direccionGeneralNombre: e.direccionGeneralNombre,
    direccionLineaId: e.direccionLineaId,
    direccionLineaNombre: e.direccionLineaNombre,
    coordinacionId: e.coordinacionId,
    coordinacionNombre: e.coordinacionNombre,
    organismoId: e.organismoId,
    organismoNombre: e.organismoNombre,
    gradoId: e.gradoId,
    gradoNombre: e.gradoNombre,
    observaciones: e.observaciones,
    estaVacante: e.estaVacante,
  };
}

export async function asignarCargo(
  repo: RepoCargos,
  cargoId: number,
  empleadoCedula: string
): Promise<CargoAsignacionDTO> {
  return aDto(await repo.asignarCargo(cargoId, empleadoCedula));
}

export async function asignarCargoEspecial(
  repo: RepoCargos,
  input: CrearCargoEspecialInputDTO
): Promise<CargoAsignacionDTO> {
  return aDto(await repo.asignarCargoEspecial(input));
}

export async function desasignarCargo(
  repo: RepoCargos,
  cargoId: number
): Promise<CargoAsignacionDTO> {
  return aDto(await repo.desasignarCargo(cargoId));
}

export async function cambiarCargo(
  repo: RepoCargos,
  input: CambiarCargoInputDTO
): Promise<CargoAsignacionDTO> {
  return aDto(await repo.cambiarCargo(input.cargoActualId, input.cargoNuevoId, input.motivoId));
}

export async function gestionarEstatus(
  repo: RepoCargos,
  input: GestionarEstatusInputDTO
): Promise<CargoAsignacionDTO> {
  return aDto(await repo.gestionarEstatus(input.cargoId, input.estatusId, input.motivoId));
}
