/**
 * Puerto de usuarios (paso 3 del checklist §II.8). Contrato de dominio: la
 * implementación concreta vive en `infrastructure/repositories/`.
 */
import type { UsuarioEntity } from "../entities/usuario-entity";

/** Filtros de búsqueda expresados en términos del dominio. */
export interface UsuariosFiltros {
  readonly busqueda?: string;
}

export interface RepoUsuarios {
  getAll(filtros?: UsuariosFiltros): Promise<UsuarioEntity[]>;
}
