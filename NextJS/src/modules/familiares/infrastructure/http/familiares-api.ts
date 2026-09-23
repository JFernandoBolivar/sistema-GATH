/**
 * Cliente HTTP para Familiares conectado a las APIs canónicas /api/v1/familiares/
 */
import { apiClient } from "@/shared/infrastructure/http/fetcher-api";

export interface CatalogoFamiliarApiItem {
  id: number;
  nombre: string;
}

export interface FamiliarApiItem {
  id: number;
  empleado_cedula: string;
  cedula_familiar: string | null;
  primer_nombre: string;
  segundo_nombre: string | null;
  primer_apellido: string;
  segundo_apellido: string | null;
  parentesco_id: number;
  parentesco_nombre: string;
  fecha_nacimiento: string;
  sexo_id: number;
  sexo_nombre: string;
  mismo_ente: boolean;
  heredero: boolean;
  observaciones: string | null;
}

export interface DocumentoFamiliarApiItem {
  id: number;
  familiar_id: number;
  tipo_documento: string;
  ruta_archivo: string;
  fecha_subida: string;
}

export const familiaresApi = {
  getPorEmpleado: (cedula: string) =>
    apiClient.get<FamiliarApiItem[]>(`/api/v1/familiares/empleado/${cedula}/`),

  getPorId: (id: number) =>
    apiClient.get<FamiliarApiItem>(`/api/v1/familiares/${id}/`),

  crear: (cedula: string, payload: Record<string, unknown>) =>
    apiClient.post<FamiliarApiItem>(`/api/v1/familiares/empleado/${cedula}/`, payload),

  actualizar: (id: number, payload: Record<string, unknown>) =>
    apiClient.put<FamiliarApiItem>(`/api/v1/familiares/${id}/`, payload),

  eliminar: (id: number) =>
    apiClient.delete<void>(`/api/v1/familiares/${id}/`),

  getDocumentos: (familiarId: number) =>
    apiClient.get<DocumentoFamiliarApiItem[]>(`/api/v1/familiares/${familiarId}/documentos/`),

  getParentescos: () =>
    apiClient.get<CatalogoFamiliarApiItem[]>("/api/v1/catalogos/parentescos/"),

  getSexos: () =>
    apiClient.get<CatalogoFamiliarApiItem[]>("/api/v1/catalogos/sexos/"),
};
