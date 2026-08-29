/**
 * Casos de uso de Consulta de Cargos (Reglas R2, R4).
 */
import type { RepoCargos } from "../../domain/ports/repo-cargos";
import type { CargoAsignacionDTO, DenominacionCargoDTO } from "../dtos/cargo-dto";

export async function listarCargos(
  repo: RepoCargos,
  filtros?: { dependenciaId?: number; soloVacantes?: boolean }
): Promise<CargoAsignacionDTO[]> {
  const entidades = await repo.listarCargos(filtros);
  return entidades.map((e) => ({
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
  }));
}

export async function listarDenominaciones(
  repo: RepoCargos
): Promise<DenominacionCargoDTO[]> {
  const entidades = await repo.listarDenominaciones();
  return entidades.map((e) => ({ id: e.id, nombre: e.nombre }));
}
