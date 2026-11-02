/**
 * Casos de uso de Gestión de Denominaciones de Cargo (Reglas R2, R4).
 */
import type { RepoCargos } from "../../domain/ports/repo-cargos";
import type { DenominacionCargo } from "../../domain/entities/cargo";
import type { DenominacionCargoDTO, DenominacionInputDTO } from "../dtos/cargo-dto";

function aDto(e: DenominacionCargo): DenominacionCargoDTO {
  return { id: e.id, nombre: e.nombre, orden: e.orden };
}

export async function crearDenominacion(
  repo: RepoCargos,
  input: DenominacionInputDTO
): Promise<DenominacionCargoDTO> {
  return aDto(await repo.crearDenominacion(input));
}

export async function actualizarDenominacion(
  repo: RepoCargos,
  id: number,
  input: DenominacionInputDTO
): Promise<DenominacionCargoDTO> {
  return aDto(await repo.actualizarDenominacion(id, input));
}

export async function eliminarDenominacion(repo: RepoCargos, id: number): Promise<void> {
  await repo.eliminarDenominacion(id);
}

export async function crearDenominacionEspecifica(
  repo: RepoCargos,
  input: DenominacionInputDTO
): Promise<DenominacionCargoDTO> {
  return aDto(await repo.crearDenominacionEspecifica(input));
}

export async function actualizarDenominacionEspecifica(
  repo: RepoCargos,
  id: number,
  input: DenominacionInputDTO
): Promise<DenominacionCargoDTO> {
  return aDto(await repo.actualizarDenominacionEspecifica(id, input));
}

export async function eliminarDenominacionEspecifica(repo: RepoCargos, id: number): Promise<void> {
  await repo.eliminarDenominacionEspecifica(id);
}
