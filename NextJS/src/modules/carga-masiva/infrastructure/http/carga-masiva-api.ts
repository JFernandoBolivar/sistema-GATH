import { apiClient } from "@/shared/infrastructure/http/fetcher-api";
import type { ApiResponse } from "@/shared/types/api-response";
import type {
  CargaMasivaDetalle,
  CargaMasivaResumen,
  PoblacionCarga,
} from "../../domain/entities/carga-masiva";

export const cargaMasivaApi = {
  listarCargas: (poblacion?: PoblacionCarga, estado?: string) => {
    const params = new URLSearchParams();
    if (poblacion) params.set("poblacion", poblacion);
    if (estado) params.set("estado", estado);
    const query = params.toString() ? `?${params.toString()}` : "";
    return apiClient.get<ApiResponse<CargaMasivaResumen[]>>(
      `/api/v1/carga-masiva/cargas/${query}`,
    );
  },

  obtenerDetalle: (cargaId: string, estadoFila?: string) => {
    const params = estadoFila ? `?estado=${encodeURIComponent(estadoFila)}` : "";
    return apiClient.get<ApiResponse<CargaMasivaDetalle>>(
      `/api/v1/carga-masiva/cargas/${cargaId}/${params}`,
    );
  },

  confirmarFilas: (cargaId: string, filaIds: string[]) => {
    return apiClient.post<ApiResponse<CargaMasivaResumen>>(
      `/api/v1/carga-masiva/cargas/${cargaId}/confirmar/`,
      { filas: filaIds },
    );
  },

  aplicar: (cargaId: string) => {
    return apiClient.post<ApiResponse<CargaMasivaResumen>>(
      `/api/v1/carga-masiva/cargas/${cargaId}/aplicar/`,
    );
  },

  aprobar: (cargaId: string) => {
    return apiClient.post<ApiResponse<CargaMasivaResumen>>(
      `/api/v1/carga-masiva/cargas/${cargaId}/aprobar/`,
    );
  },

  rechazar: (cargaId: string, motivo: string) => {
    return apiClient.post<ApiResponse<CargaMasivaResumen>>(
      `/api/v1/carga-masiva/cargas/${cargaId}/rechazar/`,
      { motivo },
    );
  },

  revertir: (cargaId: string) => {
    return apiClient.post<ApiResponse<CargaMasivaResumen>>(
      `/api/v1/carga-masiva/cargas/${cargaId}/revertir/`,
    );
  },
};
