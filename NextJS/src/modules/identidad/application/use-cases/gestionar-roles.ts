/**
 * Casos de uso de gestión del catálogo de roles (Reglas R2, R4).
 */
import type { RepoRoles } from "../../domain/ports/repo-roles";
import type { RolDTO, GuardarRolInputDTO } from "../dtos/usuario-dto";
import type { RolEntity } from "../../domain/entities/rol-entity";

function aDto(e: RolEntity): RolDTO {
  return {
    id: e.id,
    nombreRol: e.nombreRol,
    nombreVisible: e.nombreVisible,
    descripcionRol: e.descripcionRol,
    nUsuarios: e.nUsuarios,
    nPermisos: e.nPermisos,
  };
}

export async function listarRoles(repo: RepoRoles): Promise<RolDTO[]> {
  const entities = await repo.listar();
  return entities.map(aDto);
}

export async function crearRol(repo: RepoRoles, input: GuardarRolInputDTO): Promise<RolDTO> {
  return aDto(await repo.crear({ nombreVisible: input.nombreVisible, descripcionRol: input.descripcionRol ?? "" }));
}

export async function actualizarRol(
  repo: RepoRoles,
  id: number,
  input: Partial<GuardarRolInputDTO>,
): Promise<RolDTO> {
  const data: Partial<{ nombreVisible: string; descripcionRol: string }> = {};
  if (input.nombreVisible !== undefined) data.nombreVisible = input.nombreVisible;
  if (input.descripcionRol !== undefined) data.descripcionRol = input.descripcionRol ?? "";
  return aDto(await repo.actualizar(id, data));
}

export async function eliminarRol(repo: RepoRoles, id: number): Promise<void> {
  await repo.eliminar(id);
}
