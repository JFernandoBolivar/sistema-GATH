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

export const carnetizacionApi = {
  getCarnets: (cedula?: string) =>
    apiClient.get<CarnetApiItem[]>("/api/v1/carnetizacion/", { params: { cedula } }),

  emitir: (empleadoCedula: string, motivoId: number, observaciones?: string) =>
    apiClient.post<CarnetApiItem>("/api/v1/carnetizacion/", {
      empleado_cedula: empleadoCedula,
      motivo_id: motivoId,
      observaciones,
    }),

  validarPorHash: (securityHash: string) =>
    apiClient.get<ValidacionCarnetApiItem>(`/api/v1/carnetizacion/validar/hash/${securityHash}/`),

  validarPorId: (carnetId: number) =>
    apiClient.get<ValidacionCarnetApiItem>(`/api/v1/carnetizacion/validar/${carnetId}/`),

  getPlantillas: () =>
    apiClient.get<PlantillaCarnetApiItem[]>("/api/v1/carnetizacion/plantillas/"),

  activarPlantilla: (plantillaId: number) =>
    apiClient.post<PlantillaCarnetApiItem>(`/api/v1/carnetizacion/plantillas/${plantillaId}/activar/`),

  // Fase 2.3 del plan de reparación: generación real del PDF (QR + foto + plantilla).
  descargarPdf: (carnetId: number) =>
    apiClient.getBlob(`/api/v1/carnetizacion/${carnetId}/pdf/`),

  revocar: (carnetId: number) =>
    apiClient.post<CarnetApiItem>(`/api/v1/carnetizacion/${carnetId}/revocar/`),

  getEstadisticas: async () => {
    const envelope = await apiClient.get<ApiResponse<EstadisticasCarnetApiItem>>("/api/v1/carnetizacion/estadisticas/");
    return envelope.data;
  },
};
