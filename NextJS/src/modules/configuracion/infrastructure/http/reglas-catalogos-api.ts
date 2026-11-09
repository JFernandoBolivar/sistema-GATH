/**
 * Cliente HTTP para Reglas de Catálogos (A5).
 */
import { apiClient } from "@/shared/infrastructure/http/fetcher-api";
import type { ApiResponse } from "@/shared/types/api-response";
import type {
  ReglaChecklistSoporteDTO,
  ReglaMotivoDTO,
  ReglaNominaDTO,
  ReglaPaisDTO,
  ReglaParentescoDTO,
  ReglaTipoSoporteDTO,
  ReglasCatalogosCompletoDTO,
} from "../../application/dtos/reglas-catalogos-dto";

export const reglasCatalogosApi = {
  obtenerTodas: () =>
    apiClient.get<ApiResponse<ReglasCatalogosCompletoDTO>>(
      "/api/v1/configuracion/reglas-catalogos/",
    ),

  actualizarParentesco: (id: number, datos: Partial<Omit<ReglaParentescoDTO, "id">>) =>
    apiClient.patch<ApiResponse<ReglaParentescoDTO>>(
      `/api/v1/configuracion/reglas-catalogos/parentescos/${id}/`,
      datos,
    ),

  crearParentesco: (
    descripcion: string,
    aplica_familiar: boolean,
    regla?: Partial<Omit<ReglaParentescoDTO, "id" | "descripcion" | "aplica_familiar">>,
  ) =>
    apiClient.post<ApiResponse<ReglaParentescoDTO>>(
      "/api/v1/configuracion/reglas-catalogos/parentescos/",
      { descripcion, aplica_familiar, ...regla },
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

  crearPais: (nombre: string, codigo: string) =>
    apiClient.post<ApiResponse<ReglaPaisDTO>>(
      "/api/v1/configuracion/reglas-catalogos/paises/",
      { nombre, codigo },
    ),

  actualizarPais: (id: number, datos: { nombre?: string; codigo?: string }) =>
    apiClient.patch<ApiResponse<ReglaPaisDTO>>(
      `/api/v1/configuracion/reglas-catalogos/paises/${id}/`,
      datos,
    ),

  eliminarPais: (id: number) =>
    apiClient.delete<ApiResponse<ReglaPaisDTO>>(
      `/api/v1/configuracion/reglas-catalogos/paises/${id}/`,
    ),

  crearTipoSoporte: (datos: { codigo: string; nombre: string; orden: number }) =>
    apiClient.post<ApiResponse<ReglaTipoSoporteDTO>>(
      "/api/v1/configuracion/reglas-catalogos/tipos-soporte/",
      datos,
    ),

  actualizarTipoSoporte: (
    id: number,
    datos: { codigo?: string; nombre?: string; orden?: number },
  ) =>
    apiClient.patch<ApiResponse<ReglaTipoSoporteDTO>>(
      `/api/v1/configuracion/reglas-catalogos/tipos-soporte/${id}/`,
      datos,
    ),

  eliminarTipoSoporte: (id: number) =>
    apiClient.delete<ApiResponse<ReglaTipoSoporteDTO>>(
      `/api/v1/configuracion/reglas-catalogos/tipos-soporte/${id}/`,
    ),

  reordenarTiposSoporte: (ordenes: { id: number; orden: number }[]) =>
    apiClient.put<ApiResponse<ReglaTipoSoporteDTO[]>>(
      "/api/v1/configuracion/reglas-catalogos/tipos-soporte/reordenar/",
      { ordenes },
    ),

  actualizarChecklistSoporte: (
    seccion: string,
    tipos: { tipo_soporte_id: number; permitido: boolean; requerido: boolean }[],
  ) =>
    apiClient.put<ApiResponse<ReglaChecklistSoporteDTO[]>>(
      `/api/v1/configuracion/reglas-catalogos/tipos-soporte/checklist/${seccion}/`,
      { tipos },
    ),
};
