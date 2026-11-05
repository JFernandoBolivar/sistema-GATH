import { apiClient } from "@/shared/infrastructure/http/fetcher-api";
import type { ApiResponse } from "@/shared/types/api-response";
import type { FiltrosPuntoCuenta, PuntoCuentaItem } from "../../domain/entities/punto-cuenta";
import type { ConfiguracionPuntoCuenta } from "../../domain/entities/configuracion-punto-cuenta";

export const puntoCuentaApi = {
  listar: (filtros?: FiltrosPuntoCuenta) => {
    const params = new URLSearchParams();
    if (filtros?.cedula) params.append("cedula", filtros.cedula);
    if (filtros?.oficina_id) params.append("oficina_id", String(filtros.oficina_id));
    if (filtros?.fecha_desde) params.append("fecha_desde", filtros.fecha_desde);
    if (filtros?.fecha_hasta) params.append("fecha_hasta", filtros.fecha_hasta);

    const query = params.toString() ? `?${params.toString()}` : "";
    return apiClient.get<ApiResponse<PuntoCuentaItem[]>>(`/api/v1/puntocuenta/${query}`);
  },

  obtenerUrlDescarga: (id: string) => {
    return apiClient.get<ApiResponse<{ url: string }>>(`/api/v1/puntocuenta/${id}/documento/`);
  },

  obtenerConfiguracion: () => {
    return apiClient.get<ApiResponse<ConfiguracionPuntoCuenta>>(`/api/v1/puntocuenta/configuracion/`);
  },

  guardarConfiguracion: (datos: Partial<ConfiguracionPuntoCuenta>) => {
    return apiClient.put<ApiResponse<ConfiguracionPuntoCuenta>>(`/api/v1/puntocuenta/configuracion/`, datos);
  },
};
