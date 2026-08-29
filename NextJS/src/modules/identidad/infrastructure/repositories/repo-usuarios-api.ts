/**
 * Adaptador de repositorio de usuarios (paso 10 del checklist §II.8).
 * Implementa el puerto `RepoUsuarios` combinando HTTP + mapper.
 */
import type { RepoUsuarios } from "../../domain/ports/repo-usuarios";
import { getUsuarios } from "../http/usuarios-api";
import { mapperUsuario } from "../mappers/mapper-usuario";

export const repoUsuariosApi: RepoUsuarios = {
  async getAll(filtros) {
    const rows = await getUsuarios(filtros);
    return rows.map(mapperUsuario);
  },
};
