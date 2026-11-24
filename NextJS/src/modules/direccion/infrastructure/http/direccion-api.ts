import { apiClient } from "@/shared/infrastructure/http/fetcher-api";
import type { ApiResponse } from "@/shared/types/api-response";
import type { DatosTransicionArea, DetalleArea, FiltrosArea, PaginaArea } from "@/modules/presupuesto/domain/solicitud";
import { detalleAreaDesdeApi, paginaAreaDesdeApi } from "@/modules/presupuesto/infrastructure/mappers/mapper-presupuesto";

const BASE = "/api/v1/postulacion/ingresos";

type Crudo = Record<string, unknown>;

export const direccionApi = {
  bandeja: async (f: FiltrosArea): Promise<PaginaArea> => {
    const sobre = await apiClient.get<ApiResponse<Crudo>>(`${BASE}/`, {
      params: {
        estado: f.estados.length > 0 ? f.estados.join(",") : undefined,
        vista: f.estados.length === 0 ? f.vista : undefined,
        q: f.q?.trim(),
        desde: f.desde,
        hasta: f.hasta,
        pagina: f.pagina,
        page_size: f.tamano,
      },
    });
    return paginaAreaDesdeApi(sobre.data);
  },

  detalle: async (id: string): Promise<DetalleArea> => {
    const sobre = await apiClient.get<ApiResponse<Crudo>>(`${BASE}/${id}/`);
    return detalleAreaDesdeApi(sobre.data);
  },

  transicion: async (id: string, t: DatosTransicionArea): Promise<DetalleArea> => {
    const sobre = await apiClient.post<ApiResponse<Crudo>>(`${BASE}/${id}/transicion/`, {
      destino: t.destino,
      ...(t.motivo ? { motivo: t.motivo } : {}),
    });
    return detalleAreaDesdeApi(sobre.data);
  },

  puntoCuenta: (id: string) => apiClient.getBlob(`${BASE}/${id}/punto-cuenta/`),
  constanciaAdjunto: (id: string) => apiClient.getBlob(`${BASE}/${id}/constancia/adjunto/`),
};
