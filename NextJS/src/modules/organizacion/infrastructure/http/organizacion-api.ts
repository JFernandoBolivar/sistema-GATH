/**
 * Cliente HTTP para Organización conectado a las APIs canónicas
 * /api/v1/organizacion/. Todas las respuestas llegan envueltas en el sobre
 * C-1 (`ok()`); por eso cada lectura/escritura desempaqueta `data` antes de
 * devolver el resultado (mismo patrón que `cargos-api.ts`).
 */
import { apiClient } from "@/shared/infrastructure/http/fetcher-api";
import type { ApiResponse } from "@/shared/types/api-response";

export interface DependenciaApiItem {
  id: number;
  codigo: string;
  nombre: string;
}

export interface DireccionGeneralApiItem {
  id: number;
  codigo: string;
  nombre: string;
  dependencia_id: number | null;
}

export interface DireccionLineaApiItem {
  id: number;
  codigo: string;
  nombre: string;
  direccion_general_id: number | null;
}

export interface CoordinacionApiItem {
  id: number;
  codigo: string;
  nombre: string;
  direccion_linea_id: number | null;
}

export interface OrganismoAdscritoApiItem {
  id: number;
  nombre: string;
  parent_id: number | null;
}

export type DependenciaWriteBody = { codigo: string; nombre: string };
export type DireccionGeneralWriteBody = {
  codigo: string;
  nombre: string;
  dependencia_id: number | null;
};
export type DireccionLineaWriteBody = {
  codigo: string;
  nombre: string;
  direccion_general_id: number | null;
};
export type CoordinacionWriteBody = {
  codigo: string;
  nombre: string;
  direccion_linea_id: number | null;
};
export type OrganismoAdscritoWriteBody = { nombre: string; parent_id: number | null };

async function list<T>(getter: Promise<ApiResponse<T[]>>): Promise<T[]> {
  const envelope = await getter;
  return envelope.data ?? [];
}

async function single<T>(getter: Promise<ApiResponse<T>>): Promise<T> {
  const envelope = await getter;
  return envelope.data;
}

export const organizacionApi = {
  getDependencias: () =>
    list<DependenciaApiItem>(
      apiClient.get<ApiResponse<DependenciaApiItem[]>>("/api/v1/organizacion/dependencias/"),
    ),

  crearDependencia: (body: DependenciaWriteBody) =>
    single<DependenciaApiItem>(
      apiClient.post<ApiResponse<DependenciaApiItem>>("/api/v1/organizacion/dependencias/crear/", body),
    ),

  actualizarDependencia: (id: number, body: DependenciaWriteBody) =>
    single<DependenciaApiItem>(
      apiClient.put<ApiResponse<DependenciaApiItem>>(`/api/v1/organizacion/dependencias/${id}/`, body),
    ),

  eliminarDependencia: (id: number) =>
    apiClient.delete<ApiResponse<null>>(`/api/v1/organizacion/dependencias/${id}/eliminar/`),

  getDireccionesGenerales: (dependenciaId?: number) =>
    list<DireccionGeneralApiItem>(
      apiClient.get<ApiResponse<DireccionGeneralApiItem[]>>("/api/v1/organizacion/direcciones-generales/", {
        params: dependenciaId ? { dependencia_id: dependenciaId } : undefined,
      }),
    ),

  crearDireccionGeneral: (body: DireccionGeneralWriteBody) =>
    single<DireccionGeneralApiItem>(
      apiClient.post<ApiResponse<DireccionGeneralApiItem>>("/api/v1/organizacion/direcciones-generales/crear/", body),
    ),

  actualizarDireccionGeneral: (id: number, body: DireccionGeneralWriteBody) =>
    single<DireccionGeneralApiItem>(
      apiClient.put<ApiResponse<DireccionGeneralApiItem>>(`/api/v1/organizacion/direcciones-generales/${id}/`, body),
    ),

  eliminarDireccionGeneral: (id: number) =>
    apiClient.delete<ApiResponse<null>>(`/api/v1/organizacion/direcciones-generales/${id}/eliminar/`),

  getDireccionesLinea: (direccionGeneralId?: number) =>
    list<DireccionLineaApiItem>(
      apiClient.get<ApiResponse<DireccionLineaApiItem[]>>("/api/v1/organizacion/direcciones-linea/", {
        params: direccionGeneralId ? { direccion_general_id: direccionGeneralId } : undefined,
      }),
    ),

  crearDireccionLinea: (body: DireccionLineaWriteBody) =>
    single<DireccionLineaApiItem>(
      apiClient.post<ApiResponse<DireccionLineaApiItem>>("/api/v1/organizacion/direcciones-linea/crear/", body),
    ),

  actualizarDireccionLinea: (id: number, body: DireccionLineaWriteBody) =>
    single<DireccionLineaApiItem>(
      apiClient.put<ApiResponse<DireccionLineaApiItem>>(`/api/v1/organizacion/direcciones-linea/${id}/`, body),
    ),

  eliminarDireccionLinea: (id: number) =>
    apiClient.delete<ApiResponse<null>>(`/api/v1/organizacion/direcciones-linea/${id}/eliminar/`),

  getCoordinaciones: (direccionLineaId?: number) =>
    list<CoordinacionApiItem>(
      apiClient.get<ApiResponse<CoordinacionApiItem[]>>("/api/v1/organizacion/coordinaciones/", {
        params: direccionLineaId ? { direccion_linea_id: direccionLineaId } : undefined,
      }),
    ),

  crearCoordinacion: (body: CoordinacionWriteBody) =>
    single<CoordinacionApiItem>(
      apiClient.post<ApiResponse<CoordinacionApiItem>>("/api/v1/organizacion/coordinaciones/crear/", body),
    ),

  actualizarCoordinacion: (id: number, body: CoordinacionWriteBody) =>
    single<CoordinacionApiItem>(
      apiClient.put<ApiResponse<CoordinacionApiItem>>(`/api/v1/organizacion/coordinaciones/${id}/`, body),
    ),

  eliminarCoordinacion: (id: number) =>
    apiClient.delete<ApiResponse<null>>(`/api/v1/organizacion/coordinaciones/${id}/eliminar/`),

  getOrganismosAdscritos: () =>
    list<OrganismoAdscritoApiItem>(
      apiClient.get<ApiResponse<OrganismoAdscritoApiItem[]>>("/api/v1/organizacion/organismos-adscritos/"),
    ),

  crearOrganismoAdscrito: (body: OrganismoAdscritoWriteBody) =>
    single<OrganismoAdscritoApiItem>(
      apiClient.post<ApiResponse<OrganismoAdscritoApiItem>>("/api/v1/organizacion/organismos-adscritos/crear/", body),
    ),

  actualizarOrganismoAdscrito: (id: number, body: OrganismoAdscritoWriteBody) =>
    single<OrganismoAdscritoApiItem>(
      apiClient.put<ApiResponse<OrganismoAdscritoApiItem>>(`/api/v1/organizacion/organismos-adscritos/${id}/`, body),
    ),

  eliminarOrganismoAdscrito: (id: number) =>
    apiClient.delete<ApiResponse<null>>(`/api/v1/organizacion/organismos-adscritos/${id}/eliminar/`),
};
