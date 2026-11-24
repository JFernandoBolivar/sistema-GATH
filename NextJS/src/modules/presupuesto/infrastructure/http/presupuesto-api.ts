import { apiClient } from "@/shared/infrastructure/http/fetcher-api";
import type { ApiResponse } from "@/shared/types/api-response";
import type {
  DatosConstancia,
  DatosTransicionArea,
  DetalleArea,
  FiltrosArea,
  FiltrosVacantes,
  PaginaArea,
  PaginaVacantes,
} from "../../domain/solicitud";
import { detalleAreaDesdeApi, paginaAreaDesdeApi, paginaVacantesDesdeApi } from "../mappers/mapper-presupuesto";

const BASE = "/api/v1/postulacion/solicitudes";

type Crudo = Record<string, unknown>;

export const presupuestoApi = {
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

  vacantes: async (id: string, f: FiltrosVacantes): Promise<PaginaVacantes> => {
    const sobre = await apiClient.get<ApiResponse<Crudo>>(`${BASE}/${id}/vacantes/`, {
      params: {
        cargo: f.cargo,
        oficina: f.oficina,
        dependencia: f.dependencia,
        direccion_linea: f.direccionLinea,
        coordinacion: f.coordinacion,
        q: f.q?.trim(),
        pagina: f.pagina,
        page_size: f.tamano,
      },
    });
    return paginaVacantesDesdeApi(sobre.data);
  },

  reservar: async (id: string, puestoId: number): Promise<DetalleArea> => {
    const sobre = await apiClient.post<ApiResponse<Crudo>>(`${BASE}/${id}/reserva/`, { puesto_id: puestoId });
    return detalleAreaDesdeApi(sobre.data);
  },

  liberar: async (id: string): Promise<DetalleArea> => {
    const sobre = await apiClient.delete<ApiResponse<Crudo>>(`${BASE}/${id}/reserva/`);
    return detalleAreaDesdeApi(sobre.data);
  },

  declararConstancia: async (id: string, d: DatosConstancia): Promise<DetalleArea> => {
    const form = new FormData();
    form.set("referencia", d.referencia.trim());
    if (d.observaciones.trim()) form.set("observaciones", d.observaciones.trim());
    if (d.adjunto) form.set("adjunto", d.adjunto);
    const sobre = await apiClient.postForm<ApiResponse<Crudo>>(`${BASE}/${id}/constancia/`, form);
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
