/**
 * Casos de uso de Préstamo de Cargo (encargaduría) (Reglas R2, R4).
 */
import type { RepoCargos } from "../../domain/ports/repo-cargos";
import type { PrestamoCargo } from "../../domain/entities/cargo";
import type { PrestamoCargoDTO, CrearPrestamoInputDTO } from "../dtos/cargo-dto";

function aDto(e: PrestamoCargo): PrestamoCargoDTO {
  return {
    id: e.id,
    empleadoEncargadoCedula: e.empleadoEncargadoCedula,
    empleadoEncargadoNombre: e.empleadoEncargadoNombre,
    cargoEncargadoId: e.cargoEncargadoId,
    cargoEncargadoCodigo: e.cargoEncargadoCodigo,
    cargoEncargadoDenominacion: e.cargoEncargadoDenominacion || "",
    titularCedula: e.titularCedula,
    titularNombre: e.titularNombre,
    motivoId: e.motivoId,
    motivoNombre: e.motivoNombre,
    estatusId: e.estatusId,
    estatusNombre: e.estatusNombre,
    fechaInicio: e.fechaInicio,
    fechaFin: e.fechaFin,
    ejecutadoPorId: e.ejecutadoPorId,
    estaFinalizada: e.estaFinalizada,
  };
}

export async function listarPrestamos(
  repo: RepoCargos,
  soloActivos?: boolean,
  empleado?: string
): Promise<PrestamoCargoDTO[]> {
  const entidades = await repo.listarPrestamos(soloActivos, empleado);
  return entidades.map(aDto);
}

export async function crearPrestamo(
  repo: RepoCargos,
  input: CrearPrestamoInputDTO
): Promise<PrestamoCargoDTO> {
  return aDto(await repo.crearPrestamo(input));
}

export async function finalizarPrestamo(
  repo: RepoCargos,
  prestamoId: number,
  fechaFin?: string
): Promise<PrestamoCargoDTO> {
  return aDto(await repo.finalizarPrestamo(prestamoId, fechaFin));
}

export type { PrestamoCargo };
