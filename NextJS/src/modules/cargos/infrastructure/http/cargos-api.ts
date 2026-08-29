/**
 * Cliente HTTP para Cargos conectado a las APIs canónicas /api/v1/cargos/
 */
import { apiClient } from "@/shared/infrastructure/http/fetcher-api";

export interface CargoApiItem {
  id: number;
  codigo_nomina: string | null;
  empleado_cedula: string | null;
  empleado_nombre: string | null;
  denominacion_cargo_id: number;
  denominacion_cargo_nombre: string;
  dependencia_id: number | null;
  dependencia_nombre: string | null;
  direccion_general_id: number | null;
  direccion_general_nombre: string | null;
  activo: boolean;
  esta_vacante: boolean;
}

export interface DenominacionApiItem {
  id: number;
  nombre: string;
}

export const cargosApi = {
  getCargos: (filtros?: { dependencia_id?: number }) =>
    apiClient.get<CargoApiItem[]>("/api/v1/cargos/", { params: filtros }),

  getVacantes: () =>
    apiClient.get<CargoApiItem[]>("/api/v1/cargos/vacantes/"),

  getDenominaciones: () =>
    apiClient.get<DenominacionApiItem[]>("/api/v1/cargos/denominaciones/"),

  asignar: (cargoId: number, empleadoCedula: string) =>
    apiClient.post<CargoApiItem>(`/api/v1/cargos/${cargoId}/asignar/`, {
      empleado_cedula: empleadoCedula,
    }),

  desasignar: (cargoId: number) =>
    apiClient.post<CargoApiItem>(`/api/v1/cargos/${cargoId}/desasignar/`, {}),
};
