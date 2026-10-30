/**
 * Llamadas HTTP del módulo identidad (Regla R7). Único punto que define las
 * rutas /api/v1/identidad/*. Todas las respuestas llegan envueltas en el sobre
 * C-1 (`ok()`), por eso cada lectura desempaqueta `data`.
 */
import { apiClient } from "@/shared/infrastructure/http/fetcher-api";
import { queryParams } from "@/shared/infrastructure/http/query-params";
import type { ApiResponse } from "@/shared/types/api-response";
import type { UsuariosFiltros } from "../../domain/ports/repo-usuarios";

export const USUARIOS_PATH = "api/v1/identidad/usuarios/";
export const ROLES_PATH = "api/v1/identidad/roles/";
export const DEPARTAMENTOS_PATH = "api/v1/identidad/departamentos/";
export const PERMISOS_PATH = "api/v1/identidad/permisos/";

export interface UsuarioApiItem {
  id: number;
  cedula: string;
  nombres: string;
  apellidos: string;
  correo: string | null;
  telefono: string | null;
  departamento_id: number | null;
  rol_id: number | null;
  is_active: boolean;
  debe_cambiar_password: boolean | null;
}

export interface RolApiItem {
  id: number;
  nombre_rol: string;
  descripcion_rol: string;
}

export interface DepartamentoApiItem {
  id: number;
  nombre: string;
  descripcion: string;
}

export interface PermisoApiItem {
  codigo: string;
  nombre: string;
}

export type RegistrarUsuarioBody = {
  cedula: string;
  password: string;
  departamento_id?: number | null;
  rol_id?: number | null;
};

export type EditarUsuarioBody = {
  departamento_id?: number | null;
  rol_id?: number | null;
  password?: string | null;
};

export type RolBody = {
  nombre_rol: string;
  descripcion_rol?: string | null;
};

async function list<T>(getPromise: Promise<ApiResponse<T[]>>): Promise<T[]> {
  const envelope = await getPromise;
  return envelope.data ?? [];
}

async function single<T>(getPromise: Promise<ApiResponse<T>>): Promise<T> {
  const envelope = await getPromise;
  return envelope.data;
}

export const usuariosApi = {
  getUsuarios: (filtros?: UsuariosFiltros) => {
    const qs = queryParams({
      cedula: filtros?.busqueda,
      departamento_id: filtros?.departamentoId,
      rol_id: filtros?.rolId,
      is_active: filtros?.isActive,
    });
    return list<UsuarioApiItem>(apiClient.get<ApiResponse<UsuarioApiItem[]>>(`${USUARIOS_PATH}${qs}`));
  },

  registrar: (body: RegistrarUsuarioBody) =>
    single<UsuarioApiItem>(apiClient.post<ApiResponse<UsuarioApiItem>>(`${USUARIOS_PATH}registro/`, body)),

  editar: (id: number, body: EditarUsuarioBody) =>
    single<UsuarioApiItem>(apiClient.patch<ApiResponse<UsuarioApiItem>>(`${USUARIOS_PATH}${id}/`, body)),

  cambiarEstado: (id: number, body: { is_active: boolean }) =>
    single<UsuarioApiItem>(apiClient.patch<ApiResponse<UsuarioApiItem>>(`${USUARIOS_PATH}${id}/estado/`, body)),

  restablecerAcceso: (id: number) =>
    single<UsuarioApiItem>(apiClient.post<ApiResponse<UsuarioApiItem>>(`${USUARIOS_PATH}${id}/restablecer-acceso/`, {})),

  getRoles: () =>
    list<RolApiItem>(apiClient.get<ApiResponse<RolApiItem[]>>(ROLES_PATH)),

  crearRol: (body: RolBody) =>
    single<RolApiItem>(apiClient.post<ApiResponse<RolApiItem>>(ROLES_PATH, body)),

  actualizarRol: (id: number, body: RolBody) =>
    single<RolApiItem>(apiClient.patch<ApiResponse<RolApiItem>>(`${ROLES_PATH}${id}/`, body)),

  eliminarRol: (id: number) =>
    apiClient.delete<ApiResponse<null>>(`${ROLES_PATH}${id}/eliminar/`),

  getDepartamentos: () =>
    list<DepartamentoApiItem>(apiClient.get<ApiResponse<DepartamentoApiItem[]>>(DEPARTAMENTOS_PATH)),

  getPermisos: () =>
    list<PermisoApiItem>(apiClient.get<ApiResponse<PermisoApiItem[]>>(PERMISOS_PATH)),
};
