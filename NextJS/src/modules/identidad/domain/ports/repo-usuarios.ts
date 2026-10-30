/**
 * Puerto del Repositorio de Usuarios (Reglas R1, R4), alineado a los endpoints
 * de `apps.identidad` (usuarios, departamentos, permisos).
 */
import type { UsuarioEntity } from "../entities/usuario-entity";
import type { DepartamentoEntity, PermisoEntity } from "../entities/departamento-entity";

/** Filtros de búsqueda expresados en términos del dominio. */
export interface UsuariosFiltros {
  readonly busqueda?: string;
  readonly departamentoId?: number;
  readonly rolId?: number;
  readonly isActive?: boolean;
}

export interface UsuarioRegistrarInput {
  readonly cedula: string;
  readonly password: string;
  readonly departamentoId?: number | null;
  readonly rolId?: number | null;
}

export interface UsuarioEditarInput {
  readonly departamentoId?: number | null;
  readonly rolId?: number | null;
  readonly password?: string | null;
}

export interface RepoUsuarios {
  getAll(filtros?: UsuariosFiltros): Promise<UsuarioEntity[]>;
  crear(input: UsuarioRegistrarInput): Promise<UsuarioEntity>;
  editar(id: number, input: UsuarioEditarInput): Promise<UsuarioEntity>;
  cambiarEstado(id: number, isActive: boolean): Promise<UsuarioEntity>;
  /** D8: repone la cédula como contraseña inicial (7 días), revoca sesiones y avisa por correo. */
  restablecerAcceso(id: number): Promise<UsuarioEntity>;
  listarDepartamentos(): Promise<DepartamentoEntity[]>;
  listarPermisos(): Promise<PermisoEntity[]>;
}
