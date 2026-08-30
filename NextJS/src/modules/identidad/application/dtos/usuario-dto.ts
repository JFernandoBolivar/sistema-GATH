/**
 * DTOs del módulo identidad (Regla R5). La capa `ui/` opera exclusivamente
 * con estas estructuras, nunca con entidades de dominio.
 */

export interface UsuarioDTO {
  id: number;
  cedula: string;
  nombres: string;
  apellidos: string;
  correo: string | null;
  telefono: string | null;
  departamentoId: number | null;
  rolId: number | null;
  isActive: boolean;
  debeCambiarPassword: boolean | null;
}

export interface RegistrarUsuarioInputDTO {
  cedula: string;
  password: string;
  departamentoId?: number | null;
  rolId?: number | null;
}

export interface EditarUsuarioInputDTO {
  departamentoId?: number | null;
  rolId?: number | null;
  password?: string | null;
}

export interface CambiarEstadoUsuarioInputDTO {
  isActive?: boolean;
}

/** Filtros opcionales del listado, ya validados y saneados. */
export interface UsuariosFiltroDTO {
  busqueda?: string;
  departamentoId?: number;
  rolId?: number;
  isActive?: boolean;
}

export interface RolDTO {
  id: number;
  nombreRol: string;
  descripcionRol: string;
}

export interface GuardarRolInputDTO {
  nombreRol: string;
  descripcionRol?: string | null;
}

export interface DepartamentoDTO {
  id: number;
  nombre: string;
  descripcion: string;
}

export interface PermisoDTO {
  codigo: string;
  nombre: string;
}
