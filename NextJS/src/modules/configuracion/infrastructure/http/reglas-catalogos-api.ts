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

  actualizarParentesco: (id: number, aplica_familiar: boolean) =>
    apiClient.patch<ApiResponse<ReglaParentescoDTO>>(
      `/api/v1/configuracion/reglas-catalogos/parentescos/${id}/`,
      { aplica_familiar },
    ),

  cambiarCategoriaMotivo: (id: number, categoria_id: number) =>
    apiClient.patch<ApiResponse<ReglaMotivoDTO>>(
      `/api/v1/configuracion/reglas-catalogos/motivos/${id}/categoria/`,
      { categoria_id },
    ),

  crearMotivo: (movimiento: string, categoria_id: number) =>
    apiClient.post<ApiResponse<ReglaMotivoDTO>>(
      "/api/v1/configuracion/reglas-catalogos/motivos/",
      { movimiento, categoria_id },
    ),

  actualizarNomina: (
    id: number,
    datos: { es_activo?: boolean; requiere_codig?: boolean },
  ) =>
    apiClient.patch<ApiResponse<ReglaNominaDTO>>(
      `/api/v1/configuracion/reglas-catalogos/nominas/${id}/`,
      datos,
    ),
};
