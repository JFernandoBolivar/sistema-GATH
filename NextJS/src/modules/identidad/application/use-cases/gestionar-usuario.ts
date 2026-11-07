/**
 * Casos de uso de gestión de usuarios, overrides y matriz (Reglas R2, R4).
 */
import type {
  RepoUsuarios,
  GuardarOverridesInput,
} from "../../domain/ports/repo-usuarios";
import type {
  CambiarCorreoAccesoInputDTO,
  CambiarEstadoUsuarioInputDTO,
  EditarUsuarioInputDTO,
  GuardarOverridesInputDTO,
  MatrizPermisosDTO,
  RegistrarUsuarioInputDTO,
  UsuarioDetalleDTO,
  UsuarioDTO,
} from "../dtos/usuario-dto";
import { aUsuarioDto, obtenerDetalleUsuario } from "./listar-usuarios";

export async function registrarUsuario(
  repo: RepoUsuarios,
  input: RegistrarUsuarioInputDTO,
): Promise<UsuarioDTO> {
  const entidad = await repo.crear({
    cedula: input.cedula,
    password: input.password,
    rolId: input.rolId ?? null,
  });
  return aUsuarioDto(entidad);
}

export async function editarUsuario(
  repo: RepoUsuarios,
  id: number,
  input: EditarUsuarioInputDTO,
): Promise<UsuarioDTO> {
  const entidad = await repo.editar(id, {
    rolId: input.rolId ?? null,
    motivo: input.motivo,
  });
  return aUsuarioDto(entidad);
}

export async function cambiarEstadoUsuario(
  repo: RepoUsuarios,
  id: number,
  input: CambiarEstadoUsuarioInputDTO,
): Promise<UsuarioDTO> {
  const entidad = await repo.cambiarEstado(id, input.isActive, input.motivo);
  return aUsuarioDto(entidad);
}

export async function restablecerAccesoUsuario(
  repo: RepoUsuarios,
  id: number,
  motivo: string,
): Promise<UsuarioDTO> {
  return aUsuarioDto(await repo.restablecerAcceso(id, motivo));
}

export async function cambiarCorreoAcceso(
  repo: RepoUsuarios,
  input: CambiarCorreoAccesoInputDTO,
): Promise<{ correo: string; cuentaCreada: boolean; avisado: boolean }> {
  return repo.cambiarCorreoAcceso({
    cedula: input.cedula,
    fuente: input.fuente,
    correo: input.correo,
    motivo: input.motivo,
  });
}

export async function guardarOverridesUsuario(
  repo: RepoUsuarios,
  id: number,
  input: GuardarOverridesInputDTO,
): Promise<UsuarioDetalleDTO> {
  const datos: GuardarOverridesInput = {
    allow: input.allow,
    deny: input.deny,
    motivo: input.motivo,
  };
  await repo.guardarOverrides(id, datos);
  return obtenerDetalleUsuario(repo, id);
}

export async function obtenerMatrizPermisos(repo: RepoUsuarios): Promise<MatrizPermisosDTO> {
  const matriz = await repo.matriz();
  return {
    filas: matriz.filas.map((f) => ({ codigo: f.codigo, nombre: f.nombre, modulo: f.modulo })),
    roles: matriz.roles.map((r) => ({
      rolId: r.rolId,
      nombre: r.nombre,
      nombreVisible: r.nombreVisible,
      codigos: r.codigos,
    })),
  };
}

export async function guardarMatrizPermisos(
  repo: RepoUsuarios,
  rolId: number,
  permisos: string[],
  motivo: string,
): Promise<MatrizPermisosDTO> {
  const matriz = await repo.guardarMatriz(rolId, permisos, motivo);
  return {
    filas: matriz.filas.map((f) => ({ codigo: f.codigo, nombre: f.nombre, modulo: f.modulo })),
    roles: matriz.roles.map((r) => ({
      rolId: r.rolId,
      nombre: r.nombre,
      nombreVisible: r.nombreVisible,
      codigos: r.codigos,
    })),
  };
}
