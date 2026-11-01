/**
 * Puerto del Repositorio de Usuarios (Reglas R1, R4), alineado a los endpoints
 * de `apps.identidad` (usuarios, permisos y matriz).
 */
import type { UsuarioEntity } from "../entities/usuario-entity";
import type { PermisoEntity } from "../entities/departamento-entity";

/** Filtros de búsqueda expresados en términos del dominio. */
export interface UsuariosFiltros {
  readonly cedula?: string;
  readonly nombre?: string;
  readonly correo?: string;
  readonly rolId?: number;
  readonly isActive?: boolean;
  readonly condicion?: "ACTIVO" | "PASIVO";
  readonly pagina?: number;
  readonly pageSize?: number;
}

export interface PaginaUsuariosEntity {
  readonly resultados: UsuarioEntity[];
  readonly total: number;
  readonly pagina: number;
  readonly tamano: number;
  readonly totalPaginas: number;
}

export interface PermisosUsuarioEntity {
  readonly rolId: number | null;
  readonly rolNombre: string | null;
  readonly delRol: string[];
  readonly allow: string[];
  readonly deny: string[];
  readonly efectivos: string[];
  readonly version: number;
}

export interface UsuarioDetalleEntity {
  readonly usuario: UsuarioEntity;
  readonly permisos: PermisosUsuarioEntity;
}

export interface UsuarioRegistrarInput {
  readonly cedula: string;
  readonly password: string;
  readonly rolId?: number | null;
}

export interface UsuarioEditarInput {
  readonly rolId?: number | null;
  readonly motivo?: string;
}

export interface GuardarOverridesInput {
  readonly allow: string[];
  readonly deny: string[];
  readonly motivo: string;
}

export interface FilaMatrizEntity {
  readonly codigo: string;
  readonly nombre: string;
  readonly modulo: string;
}

export interface ColumnaRolMatrizEntity {
  readonly rolId: number;
  readonly nombre: string;
  readonly codigos: string[];
}

export interface MatrizPermisosEntity {
  readonly filas: FilaMatrizEntity[];
  readonly roles: ColumnaRolMatrizEntity[];
}

export interface RepoUsuarios {
  getAll(filtros?: UsuariosFiltros): Promise<PaginaUsuariosEntity>;
  obtenerDetalle(id: number): Promise<UsuarioDetalleEntity>;
  crear(input: UsuarioRegistrarInput): Promise<UsuarioEntity>;
  editar(id: number, input: UsuarioEditarInput): Promise<UsuarioEntity>;
  cambiarEstado(id: number, isActive: boolean, motivo: string): Promise<UsuarioEntity>;
  /** D8: repone la cédula como contraseña inicial, revoca sesiones y avisa por correo. */
  restablecerAcceso(id: number, motivo: string): Promise<UsuarioEntity>;
  /** D8: RRHH elige el correo de acceso de un pasivo o trabajador. */
  cambiarCorreoAcceso(input: {
    cedula: string;
    fuente: "INSTITUCIONAL" | "ALTERNATIVO" | "OTRO";
    correo?: string;
    motivo: string;
  }): Promise<{ correo: string; cuentaCreada: boolean; avisado: boolean }>;
  guardarOverrides(id: number, input: GuardarOverridesInput): Promise<UsuarioDetalleEntity>;
  matriz(): Promise<MatrizPermisosEntity>;
  guardarMatriz(rolId: number, permisos: string[], motivo: string): Promise<MatrizPermisosEntity>;
  listarPermisos(): Promise<PermisoEntity[]>;
}
