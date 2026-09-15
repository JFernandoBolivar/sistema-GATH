/**
 * Caso de uso para crear un código de posición vacante (Regla R2), réplica
 * funcional de la pantalla "Crear Nuevo Código" del legado.
 */
import type { RepoCargos } from "../../domain/ports/repo-cargos";
import type { CargoAsignacionDTO, CrearCargoInputDTO } from "../dtos/cargo-dto";
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
    observaciones: e.observaciones,
    estaVacante: e.estaVacante,
  };
}

export async function crearCargo(repo: RepoCargos, input: CrearCargoInputDTO): Promise<CargoAsignacionDTO> {
  const entidad = await repo.crearCargo(input);
  return cargoADto(entidad);
}
