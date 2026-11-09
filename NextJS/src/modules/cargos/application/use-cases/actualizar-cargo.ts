/**
 * Caso de uso para actualizar los atributos de un cargo existente (Regla R2).
 * Réplica funcional de `update_position` del legado.
 */
import type { RepoCargos } from "../../domain/ports/repo-cargos";
import type { CargoAsignacionDTO, ActualizarCargoInputDTO } from "../dtos/cargo-dto";
import type { CargoAsignacion } from "../../domain/entities/cargo";

function cargoADto(e: CargoAsignacion): CargoAsignacionDTO {
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
    fechaActualizacion: e.fechaActualizacion,
  };
}

export async function actualizarCargo(
  repo: RepoCargos,
  cargoId: number,
  input: ActualizarCargoInputDTO,
): Promise<CargoAsignacionDTO> {
  const entidad = await repo.actualizarCargo(cargoId, input);
  return cargoADto(entidad);
}
