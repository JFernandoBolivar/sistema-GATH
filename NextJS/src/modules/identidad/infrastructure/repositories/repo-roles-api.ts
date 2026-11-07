/**
 * Adaptador de repositorio de roles (Regla R4). Implementa el puerto
 * `RepoRoles` combinando HTTP + mapper.
 */
import type { RepoRoles, RolCrearInput } from "../../domain/ports/repo-roles";
import { usuariosApi, type RolBody } from "../http/usuarios-api";
import { mapperRol } from "../mappers/mapper-catalogo";

export const repoRolesApi: RepoRoles = {
  async listar() {
    const rows = await usuariosApi.getRoles();
    return rows.map(mapperRol);
  },

  async crear(input: RolCrearInput) {
    const row = await usuariosApi.crearRol({
      nombre_visible: input.nombreVisible,
      descripcion_rol: input.descripcionRol ?? "",
    });
    return mapperRol(row);
  },

  async actualizar(id: number, input: Partial<RolCrearInput>) {
    const body: RolBody = {};
    if (input.nombreVisible !== undefined) body.nombre_visible = input.nombreVisible;
    if (input.descripcionRol !== undefined) body.descripcion_rol = input.descripcionRol;
    const row = await usuariosApi.actualizarRol(id, body);
    return mapperRol(row);
  },

  async eliminar(id: number) {
    await usuariosApi.eliminarRol(id);
  },
};
