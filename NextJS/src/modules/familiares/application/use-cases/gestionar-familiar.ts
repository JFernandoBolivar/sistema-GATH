/**
 * Casos de uso de Creación, Edición y Eliminación de Familiar (Reglas R2, R4).
 */
import type { Familiar } from "../../domain/entities/familiar";
import type { RepoFamiliares } from "../../domain/ports/repo-familiares";
import type { FamiliarDTO, GuardarFamiliarInputDTO } from "../dtos/familiar-dto";

export async function crearFamiliar(
  repo: RepoFamiliares,
  input: GuardarFamiliarInputDTO,
): Promise<FamiliarDTO> {
  const e = await repo.crearFamiliar({
    empleadoCedula: input.empleadoCedula,
    cedulaFamiliar: input.cedulaFamiliar ?? null,
    primerNombre: input.primerNombre,
    segundoNombre: input.segundoNombre ?? null,
    primerApellido: input.primerApellido,
    segundoApellido: input.segundoApellido ?? null,
    parentescoId: input.parentescoId,
    fechaNacimiento: input.fechaNacimiento,
    sexoId: input.sexoId,
    mismoEnte: input.mismoEnte,
    heredero: input.heredero,
    observaciones: input.observaciones ?? null,
    formacionAcademica: input.formacionAcademica ?? null,
    perfilSalud: input.perfilSalud ?? null,
    perfilFisico: input.perfilFisico ?? null,
  });

  return {
    id: e.id,
    empleadoCedula: e.empleadoCedula,
    cedulaFamiliar: e.cedulaFamiliar,
    primerNombre: e.primerNombre,
    segundoNombre: e.segundoNombre,
    primerApellido: e.primerApellido,
    segundoApellido: e.segundoApellido,
    parentescoId: e.parentescoId,
    parentescoNombre: e.parentescoNombre,
    fechaNacimiento: e.fechaNacimiento,
    sexoId: e.sexoId,
    sexoNombre: e.sexoNombre,
    mismoEnte: e.mismoEnte,
    heredero: e.heredero,
    observaciones: e.observaciones,
    formacionAcademica: e.formacionAcademica ?? null,
    perfilSalud: e.perfilSalud ?? null,
    perfilFisico: e.perfilFisico ?? null,
  };
}

export async function actualizarFamiliar(
  repo: RepoFamiliares,
  id: number,
  data: Partial<GuardarFamiliarInputDTO>,
): Promise<FamiliarDTO> {
  const e = await repo.actualizarFamiliar(id, data as Partial<Familiar>);
  return {
    id: e.id,
    empleadoCedula: e.empleadoCedula,
    cedulaFamiliar: e.cedulaFamiliar,
    primerNombre: e.primerNombre,
    segundoNombre: e.segundoNombre,
    primerApellido: e.primerApellido,
    segundoApellido: e.segundoApellido,
    parentescoId: e.parentescoId,
    parentescoNombre: e.parentescoNombre,
    fechaNacimiento: e.fechaNacimiento,
    sexoId: e.sexoId,
    sexoNombre: e.sexoNombre,
    mismoEnte: e.mismoEnte,
    heredero: e.heredero,
    observaciones: e.observaciones,
    formacionAcademica: e.formacionAcademica ?? null,
    perfilSalud: e.perfilSalud ?? null,
    perfilFisico: e.perfilFisico ?? null,
  };
}

export async function eliminarFamiliar(repo: RepoFamiliares, id: number): Promise<void> {
  await repo.eliminarFamiliar(id);
}
