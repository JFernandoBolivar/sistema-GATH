/**
 * Adaptador de repositorio de roles (Regla R4). Implementa el puerto
 * `RepoRoles` combinando HTTP + mapper.
 */
import type { RepoRoles, RolCrearInput } from "../../domain/ports/repo-roles";
import { usuariosApi } from "../http/usuarios-api";
import { mapperRol } from "../mappers/mapper-catalogo";

export const repoRolesApi: RepoRoles = {
  async listar() {
    const rows = await usuariosApi.getRoles();
    return rows.map(mapperRol);
  },

  async crear(input: RolCrearInput) {
    const row = await usuariosApi.crearRol({
      nombre_rol: input.nombreRol,
      descripcion_rol: input.descripcionRol ?? "",
    });
    return mapperRol(row);
  },

  async actualizar(id: number, input: Partial<RolCrearInput>) {
    const row = await usuariosApi.actualizarRol(id, {
      nombre_rol: input.nombreRol ?? "",
      descripcion_rol: input.descripcionRol ?? "",
    });
    return mapperRol(row);
  },

  async eliminar(id: number) {
    await usuariosApi.eliminarRol(id);
  },
};
