/**
 * Casos de uso de listado y catálogos del módulo identidad (Reglas R2, R4).
 */
import type { RepoUsuarios } from "../../domain/ports/repo-usuarios";
import type { UsuarioDTO, DepartamentoDTO, PermisoDTO, UsuariosFiltroDTO } from "../dtos/usuario-dto";
import type { UsuarioEntity } from "../../domain/entities/usuario-entity";
import type { DepartamentoEntity, PermisoEntity } from "../../domain/entities/departamento-entity";

function aDto(u: UsuarioEntity): UsuarioDTO {
  return {
    id: u.id,
    cedula: u.cedula,
    nombres: u.nombres,
    apellidos: u.apellidos,
    correo: u.correo,
    telefono: u.telefono,
    departamentoId: u.departamentoId,
    rolId: u.rolId,
    isActive: u.isActive,
    debeCambiarPassword: u.debeCambiarPassword,
  };
}

export async function listarUsuarios(
  repo: RepoUsuarios,
  filtros?: UsuariosFiltroDTO,
): Promise<UsuarioDTO[]> {
  const entities = await repo.getAll(filtros);
  return entities.map(aDto);
}

export async function listarDepartamentos(repo: RepoUsuarios): Promise<DepartamentoDTO[]> {
  const entities = await repo.listarDepartamentos();
  return entities.map((e: DepartamentoEntity) => ({ id: e.id, nombre: e.nombre, descripcion: e.descripcion }));
}

export async function listarPermisos(repo: RepoUsuarios): Promise<PermisoDTO[]> {
  const entities = await repo.listarPermisos();
  return entities.map((e: PermisoEntity) => ({ codigo: e.codigo, nombre: e.nombre }));
}
