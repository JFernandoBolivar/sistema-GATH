/**
 * Casos de uso de gestión de usuarios: registrar, editar y cambiar estado
 * (Reglas R2, R4).
 */
import type { RepoUsuarios } from "../../domain/ports/repo-usuarios";
import type {
  UsuarioDTO,
  RegistrarUsuarioInputDTO,
  EditarUsuarioInputDTO,
  CambiarEstadoUsuarioInputDTO,
} from "../dtos/usuario-dto";
import type { UsuarioEntity } from "../../domain/entities/usuario-entity";

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

export async function registrarUsuario(
  repo: RepoUsuarios,
  input: RegistrarUsuarioInputDTO,
): Promise<UsuarioDTO> {
  const entidad = await repo.crear({
    cedula: input.cedula,
    password: input.password,
    departamentoId: input.departamentoId ?? null,
    rolId: input.rolId ?? null,
  });
  return aDto(entidad);
}

export async function editarUsuario(
  repo: RepoUsuarios,
  id: number,
  input: EditarUsuarioInputDTO,
): Promise<UsuarioDTO> {
  const entidad = await repo.editar(id, {
    departamentoId: input.departamentoId ?? null,
    rolId: input.rolId ?? null,
    password: input.password ?? null,
  });
  return aDto(entidad);
}

export async function cambiarEstadoUsuario(
  repo: RepoUsuarios,
  id: number,
  input: CambiarEstadoUsuarioInputDTO,
): Promise<UsuarioDTO> {
  const isActive = typeof input.isActive === "boolean" ? input.isActive : false;
  const entidad = await repo.cambiarEstado(id, isActive);
  return aDto(entidad);
}
