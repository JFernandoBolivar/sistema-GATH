/**
 * Cliente HTTP para Organización conectado a las APIs canónicas /api/v1/organizacion/
 */
import { apiClient } from "@/shared/infrastructure/http/fetcher-api";

export interface DependenciaApiItem {
  id: number;
  nombre: string;
}

export interface DireccionGeneralApiItem {
  id: number;
  nombre: string;
  dependencia_id: number;
}

export interface DireccionLineaApiItem {
  id: number;
  nombre: string;
  direccion_general_id: number;
}

export interface CoordinacionApiItem {
  id: number;
  nombre: string;
  direccion_linea_id: number;
}

export interface OrganismoAdscritoApiItem {
  id: number;
  nombre: string;
}

export const organizacionApi = {
  getDependencias: () =>
    apiClient.get<DependenciaApiItem[]>("/api/v1/organizacion/dependencias/"),

  getDireccionesGenerales: (dependenciaId?: number) =>
    apiClient.get<DireccionGeneralApiItem[]>("/api/v1/organizacion/direcciones-generales/", {
      params: dependenciaId ? { dependencia_id: dependenciaId } : undefined,
    }),

  getDireccionesLinea: (direccionGeneralId?: number) =>
    apiClient.get<DireccionLineaApiItem[]>("/api/v1/organizacion/direcciones-linea/", {
      params: direccionGeneralId ? { direccion_general_id: direccionGeneralId } : undefined,
    }),

  getCoordinaciones: (direccionLineaId?: number) =>
    apiClient.get<CoordinacionApiItem[]>("/api/v1/organizacion/coordinaciones/", {
      params: direccionLineaId ? { direccion_linea_id: direccionLineaId } : undefined,
    }),

  getOrganismosAdscritos: () =>
    apiClient.get<OrganismoAdscritoApiItem[]>("/api/v1/organizacion/organismos-adscritos/"),
};
