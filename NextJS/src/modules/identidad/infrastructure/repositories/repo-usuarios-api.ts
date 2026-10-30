/**
 * Adaptador de repositorio de usuarios (Regla R4). Implementa el puerto
 * `RepoUsuarios` combinando HTTP + mapper.
 */
import type {
  RepoUsuarios,
  UsuarioRegistrarInput,
  UsuarioEditarInput,
} from "../../domain/ports/repo-usuarios";
import { usuariosApi } from "../http/usuarios-api";
import { mapperUsuario } from "../mappers/mapper-usuario";
import { mapperDepartamento, mapperPermiso } from "../mappers/mapper-catalogo";

export const repoUsuariosApi: RepoUsuarios = {
  async getAll(filtros) {
    const rows = await usuariosApi.getUsuarios(filtros);
    return rows.map(mapperUsuario);
  },

  async crear(input: UsuarioRegistrarInput) {
    const row = await usuariosApi.registrar({
      cedula: input.cedula,
      password: input.password,
      departamento_id: input.departamentoId,
      rol_id: input.rolId,
    });
    return mapperUsuario(row);
  },

  async editar(id: number, input: UsuarioEditarInput) {
    const row = await usuariosApi.editar(id, {
      departamento_id: input.departamentoId,
      rol_id: input.rolId,
      password: input.password,
    });
    return mapperUsuario(row);
  },

  async cambiarEstado(id: number, isActive: boolean) {
    const row = await usuariosApi.cambiarEstado(id, { is_active: isActive });
    return mapperUsuario(row);
  },

  async restablecerAcceso(id: number) {
    const row = await usuariosApi.restablecerAcceso(id);
    return mapperUsuario(row);
  },

  async listarDepartamentos() {
    const rows = await usuariosApi.getDepartamentos();
    return rows.map(mapperDepartamento);
  },

  async listarPermisos() {
    const rows = await usuariosApi.getPermisos();
    return rows.map(mapperPermiso);
  },
};
