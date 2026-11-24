import { apiClient } from "@/shared/infrastructure/http/fetcher-api";
import type { ApiResponse } from "@/shared/types/api-response";
import type {
  BorradorPlantilla,
  CatalogoVariables,
  PlantillaCompleta,
  PlantillaResumen,
  VersionPlantilla,
} from "../../domain/entities/plantilla";

const BASE = "/api/v1/documentos";

export interface NuevaPlantilla {
  codigo: string;
  nombre: string;
  descripcion?: string;
  modo: "formulario" | "pdf_overlay";
  momento: string;
  firmante: string;
  requiere_firma_clic: boolean;
}

export const documentosApi = {
  variables: () => apiClient.get<ApiResponse<CatalogoVariables>>(`${BASE}/variables/`),
  listar: () => apiClient.get<ApiResponse<PlantillaResumen[]>>(`${BASE}/plantillas/`),
  crear: (datos: NuevaPlantilla) =>
    apiClient.post<ApiResponse<PlantillaCompleta>>(`${BASE}/plantillas/`, { ...datos }),
  obtener: (id: string) => apiClient.get<ApiResponse<PlantillaCompleta>>(`${BASE}/plantillas/${id}/`),
  guardar: (id: string, datos: Partial<BorradorPlantilla>) =>
    apiClient.put<ApiResponse<PlantillaCompleta>>(`${BASE}/plantillas/${id}/`, { ...datos }),
  publicar: (id: string) =>
    apiClient.post<ApiResponse<{ version: VersionPlantilla; plantilla: PlantillaCompleta }>>(
      `${BASE}/plantillas/${id}/publicar/`,
    ),
  duplicar: (id: string) =>
    apiClient.post<ApiResponse<PlantillaCompleta>>(`${BASE}/plantillas/${id}/duplicar/`),
  activar: (id: string, activa: boolean) =>
    apiClient.post<ApiResponse<PlantillaCompleta>>(`${BASE}/plantillas/${id}/activar/`, { activa }),
  versiones: (id: string) =>
    apiClient.get<ApiResponse<VersionPlantilla[]>>(`${BASE}/plantillas/${id}/versiones/`),
  subirArchivo: (id: string, recurso: "fondo" | "logo", formData: FormData) =>
    apiClient.postForm<ApiResponse<PlantillaCompleta>>(`${BASE}/plantillas/${id}/${recurso}/`, formData),
  vistaPrevia: (id: string, cuerpo: Record<string, unknown>) =>
    apiClient.postBlob(`${BASE}/plantillas/${id}/vista-previa/`, cuerpo),
};
