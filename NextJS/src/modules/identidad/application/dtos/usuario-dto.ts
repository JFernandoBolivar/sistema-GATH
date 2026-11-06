/**
 * DTOs del módulo identidad (Regla R5). La capa `ui/` opera exclusivamente
 * con estas estructuras, nunca con entidades de dominio.
 *
 * D3: el departamento quedó fuera del contrato de usuarios; la autorización se
 * explica por rol y permisos efectivos.
 */

export interface UsuarioDTO {
  id: number;
  cedula: string;
  nombres: string;
  apellidos: string;
  correo: string | null;
  correoAlternativo?: string | null;
  telefono: string | null;
  rolId: number | null;
  rolNombre: string | null;
  isActive: boolean;
  ultimoAcceso: string | null;
  condicion: string | null;
  passwordInicialPendiente: boolean;
}

export interface PermisosUsuarioDTO {
  rolId: number | null;
  rolNombre: string | null;
  delRol: string[];
  allow: string[];
  deny: string[];
  efectivos: string[];
  version: number;
  motivo?: string | null;
  fechaActualizacion?: string | null;
  asignadoPor?: string | null;
}

export interface UsuarioDetalleDTO extends UsuarioDTO {
  permisos: PermisosUsuarioDTO;
}

export interface PaginaUsuariosDTO {
  resultados: UsuarioDTO[];
  total: number;
  pagina: number;
  tamano: number;
  totalPaginas: number;
}

export interface FiltrosUsuariosDTO {
  cedula?: string;
  nombre?: string;
  correo?: string;
  rolId?: number;
  isActive?: boolean;
  condicion?: "ACTIVO" | "PASIVO";
  pagina?: number;
  pageSize?: number;
}

/** Alias usado por las pantallas de administración. */
export type UsuariosFiltrosDTO = FiltrosUsuariosDTO;

export interface RegistrarUsuarioInputDTO {
  cedula: string;
  password?: string;
  rolId?: number | null;
}

export interface EditarUsuarioInputDTO {
  rolId?: number | null;
  motivo?: string;
}

export interface RestablecerAccesoInputDTO {
  motivo: string;
}

export interface CambiarEstadoUsuarioInputDTO {
  isActive: boolean;
  motivo: string;
}

export interface CambiarCorreoAccesoInputDTO {
  cedula: string;
  fuente: "INSTITUCIONAL" | "ALTERNATIVO" | "OTRO";
  correo?: string;
  motivo: string;
}

export interface GuardarOverridesInputDTO {
  allow: string[];
  deny: string[];
  motivo: string;
}

export interface FilaMatrizDTO {
  codigo: string;
  nombre: string;
  modulo: string;
}

export interface ColumnaRolMatrizDTO {
  rolId: number;
  nombre: string;
  codigos: string[];
}

export interface MatrizPermisosDTO {
  filas: FilaMatrizDTO[];
  roles: ColumnaRolMatrizDTO[];
}

export interface RolDTO {
  id: number;
  nombreRol: string;
  descripcionRol: string;
  nUsuarios?: number;
  nPermisos?: number;
}

export interface GuardarRolInputDTO {
  nombreRol: string;
  descripcionRol?: string | null;
}

export interface PermisoDTO {
  codigo: string;
  nombre: string;
}
