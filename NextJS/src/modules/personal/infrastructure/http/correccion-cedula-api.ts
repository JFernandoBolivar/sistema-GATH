/** Cliente HTTP de la corrección de cédula, sobre /api/v1/identidad/usuarios/corregir-cedula/. */
import { apiClient } from "@/shared/infrastructure/http/fetcher-api";
import type { ApiResponse } from "@/shared/types/api-response";

const BASE = "/api/v1/identidad/usuarios/corregir-cedula/";

export interface AfectadoApi {
  tabla: string;
  registros: number;
}

export interface VistaPreviaCedulaApi {
  trabajador: { cedula_actual: string; nombre: string; condicion: string };
  cedula_nueva: string;
  cuenta: { existe: boolean; correo?: string | null; clave_inicial_pendiente: boolean };
  afectados: AfectadoApi[];
  total_registros: number;
}

export interface ResultadoCedulaApi {
  cedula_anterior: string;
  cedula_nueva: string;
  afectados: AfectadoApi[];
  total_registros: number;
  clave_inicial_actualizada: boolean;
}

export interface CuerpoPreviewCedulaApi {
  cedula_actual: string;
  cedula_nueva: string;
}

export interface CuerpoEjecutarCedulaApi extends CuerpoPreviewCedulaApi {
  motivo: string;
  confirmacion: string;
}

export const correccionCedulaApi = {
  vistaPrevia: (cuerpo: CuerpoPreviewCedulaApi) =>
    apiClient.post<ApiResponse<VistaPreviaCedulaApi>>(
      `${BASE}preview/`,
      cuerpo as unknown as Record<string, unknown>,
    ),

  ejecutar: (cuerpo: CuerpoEjecutarCedulaApi) =>
    apiClient.post<ApiResponse<ResultadoCedulaApi>>(
      BASE,
      cuerpo as unknown as Record<string, unknown>,
    ),
};
