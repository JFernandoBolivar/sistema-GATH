/**
 * Cliente HTTP para Reglas de Catálogos (A5).
 */
import { apiClient } from "@/shared/infrastructure/http/fetcher-api";
import type { ApiResponse } from "@/shared/types/api-response";
import type {
  ReglaMotivoDTO,
  ReglaNominaDTO,
  ReglaParentescoDTO,
  ReglasCatalogosCompletoDTO,
} from "../../application/dtos/reglas-catalogos-dto";

export const reglasCatalogosApi = {
  obtenerTodas: () =>
    apiClient.get<ApiResponse<ReglasCatalogosCompletoDTO>>(
      "/api/v1/configuracion/reglas-catalogos/",
    ),

  actualizarParentesco: (id: number, datos: { aplica_familiar?: boolean; descripcion?: string }) =>
    apiClient.patch<ApiResponse<ReglaParentescoDTO>>(
      `/api/v1/configuracion/reglas-catalogos/parentescos/${id}/`,
      datos,
    ),

  crearParentesco: (descripcion: string, aplica_familiar: boolean) =>
    apiClient.post<ApiResponse<ReglaParentescoDTO>>(
      "/api/v1/configuracion/reglas-catalogos/parentescos/",
      { descripcion, aplica_familiar },
    ),

  eliminarParentesco: (id: number) =>
    apiClient.delete<ApiResponse<ReglaParentescoDTO>>(
      `/api/v1/configuracion/reglas-catalogos/parentescos/${id}/`,
    ),

  cambiarCategoriaMotivo: (id: number, categoria_id: number) =>
    apiClient.patch<ApiResponse<ReglaMotivoDTO>>(
      `/api/v1/configuracion/reglas-catalogos/motivos/${id}/categoria/`,
      { categoria_id },
    ),

  actualizarMotivo: (
    id: number,
    datos: { movimiento?: string; categoria_id?: number; activo?: boolean },
  ) =>
    apiClient.patch<ApiResponse<ReglaMotivoDTO>>(
      `/api/v1/configuracion/reglas-catalogos/motivos/${id}/`,
      datos,
    ),

  eliminarMotivo: (id: number) =>
    apiClient.delete<ApiResponse<ReglaMotivoDTO>>(
      `/api/v1/configuracion/reglas-catalogos/motivos/${id}/`,
    ),

  crearMotivo: (movimiento: string, categoria_id: number) =>
    apiClient.post<ApiResponse<ReglaMotivoDTO>>(
      "/api/v1/configuracion/reglas-catalogos/motivos/",
      { movimiento, categoria_id },
    ),

  actualizarNomina: (
    id: number,
    datos: { nomina?: string; es_activo?: boolean; requiere_codig?: boolean },
  ) =>
    apiClient.patch<ApiResponse<ReglaNominaDTO>>(
      `/api/v1/configuracion/reglas-catalogos/nominas/${id}/`,
      datos,
    ),

  crearNomina: (nomina: string, es_activo: boolean, requiere_codig: boolean) =>
    apiClient.post<ApiResponse<ReglaNominaDTO>>(
      "/api/v1/configuracion/reglas-catalogos/nominas/",
      { nomina, es_activo, requiere_codig },
    ),

  eliminarNomina: (id: number) =>
    apiClient.delete<ApiResponse<ReglaNominaDTO>>(
      `/api/v1/configuracion/reglas-catalogos/nominas/${id}/`,
    ),
};
