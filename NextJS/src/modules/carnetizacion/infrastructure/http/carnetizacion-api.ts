/**
 * Cliente HTTP para Carnetización conectado a la API canónica /api/v1/carnetizacion/
 * (verificado contra `BACKEND/apps/carnetizacion/presentation/urls.py` +
 * `carnetizacion_serializers.py` — Fase 1 del plan de reparación).
 */
import { apiClient } from "@/shared/infrastructure/http/fetcher-api";
import type { ApiResponse } from "@/shared/types/api-response";

export interface CarnetApiItem {
  id: number;
  empleado_cedula: string;
  empleado_nombres: string;
  empleado_apellidos: string;
  security_hash: string;
  fecha_emision: string;
  motivo_id: number;
  motivo_nombre: string;
  activo: boolean;
  observaciones: string | null;
}

export interface PlantillaCarnetApiItem {
  id: number;
  nombre: string;
  imagen_url: string;
  activo: boolean;
  creado: string;
}

export interface ValidacionCarnetApiItem {
  es_valido: boolean;
  mensaje: string;
  carnet: CarnetApiItem | null;
}

export interface EstadisticaMotivoCarnetApiItem {
  motivo_id: number;
  motivo: string;
  total: number;
}

export interface EstadisticasCarnetApiItem {
  total: number;
  activos: number;
  revocados: number;
  emitidos_hoy: number;
  emitidos_mes: number;
  por_motivo: EstadisticaMotivoCarnetApiItem[];
}

export interface EmpleadoCarnetApiItem {
  id?: number;
  cedula: string;
  nombres?: string;
  apellidos?: string;
  nombre_completo?: string;
  cargo?: string;
  departamento?: string;
  codigo?: string;
  codigo_empleado?: string;
  foto_url?: string | null;
}

export const carnetizacionApi = {
  getCarnets: async (cedula?: string) => {
    const envelope = await apiClient.get<ApiResponse<CarnetApiItem[]>>("/api/v1/carnetizacion/", { params: { cedula } });
    return envelope.data ?? [];
  },

  emitir: async (empleadoCedula: string, motivoId: number, observaciones?: string) => {
    const envelope = await apiClient.post<ApiResponse<CarnetApiItem>>("/api/v1/carnetizacion/", {
      empleado_cedula: empleadoCedula,
      motivo_id: motivoId,
      observaciones,
    });
    return envelope.data;
  },

  validarPorHash: async (securityHash: string) => {
    const envelope = await apiClient.get<ApiResponse<ValidacionCarnetApiItem>>(`/api/v1/carnetizacion/validar/hash/${securityHash}/`);
    return envelope.data;
  },

  validarPorId: async (carnetId: number) => {
    const envelope = await apiClient.get<ApiResponse<ValidacionCarnetApiItem>>(`/api/v1/carnetizacion/validar/${carnetId}/`);
    return envelope.data;
  },

  getPlantillas: async () => {
    const envelope = await apiClient.get<ApiResponse<PlantillaCarnetApiItem[]>>("/api/v1/carnetizacion/plantillas/");
    return envelope.data ?? [];
  },

  activarPlantilla: async (plantillaId: number) => {
    const envelope = await apiClient.post<ApiResponse<PlantillaCarnetApiItem>>(`/api/v1/carnetizacion/plantillas/${plantillaId}/activar/`);
    return envelope.data;
  },

  crearPlantilla: async (nombre: string, imagen: File, activar?: boolean) => {
    const formData = new FormData();
    formData.append("nombre", nombre);
    formData.append("imagen", imagen);
    if (activar) formData.append("activar", "true");
    const envelope = await apiClient.postForm<ApiResponse<PlantillaCarnetApiItem>>("/api/v1/carnetizacion/plantillas/crear/", formData);
    return envelope.data;
  },

  // Fase 2.3 del plan de reparación: generación real del PDF (QR + foto + plantilla).
  descargarPdf: (carnetId: number) =>
    apiClient.getBlob(`/api/v1/carnetizacion/${carnetId}/pdf/`),

  revocar: (carnetId: number) =>
    apiClient.post<CarnetApiItem>(`/api/v1/carnetizacion/${carnetId}/revocar/`),

  getEstadisticas: async () => {
    const envelope = await apiClient.get<ApiResponse<EstadisticasCarnetApiItem>>("/api/v1/carnetizacion/estadisticas/");
    return envelope.data;
  },

  getEmpleado: async (cedula: string): Promise<EmpleadoCarnetApiItem | null> => {
    try {
      const envelope = await apiClient.get<ApiResponse<EmpleadoCarnetApiItem>>(`/api/v1/personal/${cedula}/`);
      return envelope.data ?? null;
    } catch {
      return null;
    }
  },

  buscarPersonal: async (query: string) => {
    const envelope = await apiClient.get<ApiResponse<EmpleadoCarnetApiItem[]>>("/api/v1/carnetizacion/buscar/", {
      params: { q: query },
    });
    return envelope.data ?? [];
  },

  getMotivos: async () => {
    const envelope = await apiClient.get<ApiResponse<{ id: number; nombre: string }[]>>("/api/v1/carnetizacion/motivos/");
    return envelope.data ?? [];
  },

  actualizarVistaPrevia: async (cedula: string, nombre: string) => {
    const envelope = await apiClient.post<ApiResponse<{ vista_previa: string }>>(`/api/v1/carnetizacion/actualizar-vista-previa/${cedula}/`, {
      nombre,
      cedula,
    });
    return {
      success: envelope.status === "success",
      vista_previa: envelope.data?.vista_previa || "",
    };
  },

  subirFoto: async (cedula: string, nombre: string, foto: File) => {
    const formData = new FormData();
    formData.append("foto", foto);
    formData.append("nombre", nombre);
    formData.append("cedula", cedula);
    const envelope = await apiClient.postForm<ApiResponse<{ vista_previa: string; filename?: string; message?: string }>>(
      `/api/v1/carnetizacion/subir-foto/${cedula}/`,
      formData,
    );
    return {
      success: envelope.status === "success",
      vista_previa: envelope.data?.vista_previa || "",
      filename: envelope.data?.filename,
      message: envelope.data?.message || envelope.message,
    };
  },

  generarCarnetPdf: async (cedula: string, motivoId: number, nombre: string) => {
    return apiClient.postBlob(`/api/v1/carnetizacion/generar/${cedula}/`, {
      motivo_id: motivoId,
      observaciones: "",
      datos_editados: { nombre, cedula },
    });
  },
};

