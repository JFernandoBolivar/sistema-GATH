/**
 * Cliente HTTP para Personal conectado a la API canónica /api/v1/personal/
 * (verificado contra `BACKEND/apps/personal/presentation/urls.py` +
 * `personal_serializers.py::EmpleadoSerializer` — Fase 1 del plan de
 * reparación). Los recursos identifican al empleado por cédula, no por id.
 */
import { apiClient } from "@/shared/infrastructure/http/fetcher-api";

export interface EmpleadoApiItem {
  id: number;
  cedula: string;
  nombres: string;
  apellidos: string;
  nombre_completo: string;
  sexo_id: number;
  sexo_nombre: string;
  correo: string | null;
  telefono_movil: string | null;
  telefono_habitacion: string | null;
  fecha_nacimiento: string | null;
  estado_civil_id: number | null;
  estado_civil_nombre: string | null;
  carnet_patria: string | null;
  total_anos_apn: number;
}

export const personalApi = {
  getEmpleados: (filtros?: { q?: string }) =>
    apiClient.get<EmpleadoApiItem[]>("/api/v1/personal/", { params: filtros }),

  getPorCedula: (cedula: string) =>
    apiClient.get<EmpleadoApiItem>(`/api/v1/personal/${cedula}/`),

  crear: (payload: Record<string, unknown>) =>
    apiClient.post<EmpleadoApiItem>("/api/v1/personal/", payload),

  actualizar: (cedula: string, payload: Record<string, unknown>) =>
    apiClient.put<EmpleadoApiItem>(`/api/v1/personal/${cedula}/`, payload),

  subirFoto: (cedula: string, formData: FormData) =>
    apiClient.postForm<{ clave: string; url: string; mensaje: string }>(
      `/api/v1/personal/${cedula}/foto/`,
      formData,
    ),
};
