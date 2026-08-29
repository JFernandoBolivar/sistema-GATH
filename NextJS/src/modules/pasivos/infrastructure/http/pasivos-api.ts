/**
 * Cliente HTTP para Pasivos conectado a la API canónica /api/v1/pasivos/.
 */
import { apiClient } from "@/shared/infrastructure/http/fetcher-api";

export interface PasivoApiItem {
  id: number;
  cedula: string;
  nombres: string;
  apellidos: string;
  nombre_completo: string;
  tipo_pasivo: string;
  fecha_egreso: string | null;
  resolucion: string | null;
  observaciones: string | null;
  datos_vivienda: Record<string, unknown> | null;
  perfil_salud: Record<string, unknown> | null;
  formacion_academica: Record<string, unknown>[];
  contacto_emergencia: Record<string, unknown>[];
  antecedentes: Record<string, unknown>[];
  contrato_actual: Record<string, unknown> | null;
}

export interface ProcesarEgresoApiBody {
  motivo_movimiento_id: number;
  tipo_nomina_id: number;
  liberar_activos: boolean;
}

export const pasivosApi = {
  getPasivos: (busqueda?: string) =>
    apiClient.get<PasivoApiItem[]>("/api/v1/pasivos/", {
      params: busqueda ? { q: busqueda } : undefined,
    }),

  getPorCedula: (cedula: string) =>
    apiClient.get<PasivoApiItem>(`/api/v1/pasivos/${cedula}/`),

  procesarEgreso: (cedula: string, body: ProcesarEgresoApiBody) =>
    apiClient.post<PasivoApiItem>(`/api/v1/pasivos/${cedula}/procesar-egreso/`, body),
};
