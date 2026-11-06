/**
 * Llamadas HTTP del módulo identidad (Regla R7). Único punto que define las
 * rutas /api/v1/identidad/*. Todas las respuestas llegan envueltas en el sobre
 * C-1 (`ok()`), por eso cada lectura desempaqueta `data`.
 */
import { apiClient } from "@/shared/infrastructure/http/fetcher-api";
import type { ApiResponse } from "@/shared/types/api-response";
import type { UsuariosFiltros } from "../../domain/ports/repo-usuarios";

export const USUARIOS_PATH = "api/v1/identidad/usuarios/";
export const ROLES_PATH = "api/v1/identidad/roles/";
export const PERMISOS_PATH = "api/v1/identidad/permisos/";

export interface UsuarioApiItem {
  id: number;
  cedula: string;
  nombres: string;
  apellidos: string;
  correo: string | null;
  telefono: string | null;
  rol_id: number | null;
  rol_nombre: string | null;
  is_active: boolean;
  ultimo_acceso: string | null;
  condicion: string | null;
  password_inicial_pendiente: boolean;
}

export interface PermisosUsuarioApiItem {
  rol_id: number | null;
  rol_nombre: string | null;
  del_rol: string[];
  allow: string[];
  deny: string[];
  efectivos: string[];
  version: number;
}

export interface UsuarioDetalleApiItem extends UsuarioApiItem {
  permisos: PermisosUsuarioApiItem;
}

export interface PaginaUsuariosApi {
  resultados: UsuarioApiItem[];
  total: number;
  pagina: number;
  tamano: number;
  total_paginas: number;
}

export interface FilaMatrizApiItem {
  codigo: string;
  nombre: string;
  modulo: string;
}

export interface ColumnaRolMatrizApiItem {
  rol_id: number;
  nombre: string;
  codigos: string[];
}

export interface MatrizPermisosApi {
  filas: FilaMatrizApiItem[];
  roles: ColumnaRolMatrizApiItem[];
}

export interface RolApiItem {
  id: number;
  nombre_rol: string;
  descripcion_rol: string;
  n_usuarios?: number;
  n_permisos?: number;
}

export interface PermisoApiItem {
  codigo: string;
  nombre: string;
}

export type RegistrarUsuarioBody = {
  cedula: string;
  password?: string;
  rol_id?: number | null;
};

export type EditarUsuarioBody = {
  rol_id?: number | null;
  motivo?: string;
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

function filtrosParams(filtros?: UsuariosFiltros): Record<string, string | number | boolean> {
  if (!filtros) return {};
  return {
    cedula: filtros.cedula ?? "",
    nombre: filtros.nombre ?? "",
    correo: filtros.correo ?? "",
    rol_id: filtros.rolId ?? "",
    is_active: filtros.isActive === undefined ? "" : String(filtros.isActive),
    condicion: filtros.condicion ?? "",
    pagina: filtros.pagina ?? 1,
    page_size: filtros.pageSize ?? 10,
  };
}

export const usuariosApi = {
  getUsuarios: (filtros?: UsuariosFiltros) =>
    single<PaginaUsuariosApi>(
      apiClient.get<ApiResponse<PaginaUsuariosApi>>(USUARIOS_PATH, {
        params: filtrosParams(filtros),
      }),
    ),

  obtenerDetalle: (id: number) =>
    single<UsuarioDetalleApiItem>(
      apiClient.get<ApiResponse<UsuarioDetalleApiItem>>(`${USUARIOS_PATH}${id}/detalle/`),
    ),

  registrar: (body: RegistrarUsuarioBody) =>
    single<UsuarioApiItem>(apiClient.post<ApiResponse<UsuarioApiItem>>(`${USUARIOS_PATH}registro/`, body)),

  editar: (id: number, body: EditarUsuarioBody) =>
    single<UsuarioApiItem>(apiClient.patch<ApiResponse<UsuarioApiItem>>(`${USUARIOS_PATH}${id}/`, body)),

  cambiarEstado: (id: number, body: { is_active: boolean; motivo: string }) =>
    single<UsuarioApiItem>(apiClient.patch<ApiResponse<UsuarioApiItem>>(`${USUARIOS_PATH}${id}/estado/`, body)),

  restablecerAcceso: (id: number, motivo: string) =>
    single<UsuarioApiItem>(
      apiClient.post<ApiResponse<UsuarioApiItem>>(`${USUARIOS_PATH}${id}/restablecer-acceso/`, { motivo }),
    ),

  guardarOverrides: (id: number, body: { allow: string[]; deny: string[]; motivo: string }) =>
    single<UsuarioDetalleApiItem>(
      apiClient.put<ApiResponse<UsuarioDetalleApiItem>>(`${USUARIOS_PATH}${id}/permisos-individuales/`, body),
    ),

  cambiarCorreoAcceso: (cedula: string, body: { fuente: string; correo?: string; motivo: string }) =>
    single<{ correo: string; cuenta_creada: boolean; avisado: boolean }>(
      apiClient.post<ApiResponse<{ correo: string; cuenta_creada: boolean; avisado: boolean }>>(
        `api/v1/identidad/cuentas/${cedula}/correo-acceso/`,
        body,
      ),
    ),

  matriz: () =>
    single<MatrizPermisosApi>(apiClient.get<ApiResponse<MatrizPermisosApi>>(`${ROLES_PATH}matriz/`)),

  guardarMatriz: (rolId: number, permisos: string[], motivo: string) =>
    single<MatrizPermisosApi>(
      apiClient.put<ApiResponse<MatrizPermisosApi>>(`${ROLES_PATH}${rolId}/permisos/`, {
        permisos,
        motivo,
        confirmar: true,
      }),
    ),

  getRoles: () => list<RolApiItem>(apiClient.get<ApiResponse<RolApiItem[]>>(ROLES_PATH)),

  crearRol: (body: RolBody) =>
    single<RolApiItem>(apiClient.post<ApiResponse<RolApiItem>>(ROLES_PATH, body)),

  actualizarRol: (id: number, body: RolBody) =>
    single<RolApiItem>(apiClient.patch<ApiResponse<RolApiItem>>(`${ROLES_PATH}${id}/`, body)),

  eliminarRol: (id: number) => apiClient.delete<ApiResponse<null>>(`${ROLES_PATH}${id}/eliminar/`),

  getPermisos: () => list<PermisoApiItem>(apiClient.get<ApiResponse<PermisoApiItem[]>>(PERMISOS_PATH)),
};
