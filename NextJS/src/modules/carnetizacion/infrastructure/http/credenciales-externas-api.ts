import { apiClient } from "@/shared/infrastructure/http/fetcher-api";
import type { ApiResponse } from "@/shared/types/api-response";

export interface CredencialExternaApiItem {
  id: string;
  tipo_credencial: string;
  nombre: string;
  documento: string;
  correo: string;
  empresa: string;
  contrato: string;
  persona_visitada: string;
  motivo: string;
  vigencia_desde: string;
  vigencia_hasta: string;
  estado: "ACTIVA" | "DEVUELTA" | "ANULADA" | "VENCIDA";
  security_hash: string;
  empleado_cedula: string | null;
  observaciones: string;
  devuelta_en: string | null;
  anulada_en: string | null;
}

export interface CrearCredencialExternaApiInput {
  tipo_codigo: string;
  nombre: string;
  documento: string;
  motivo: string;
  vigencia_desde: string;
  vigencia_hasta: string;
  correo?: string;
  empresa?: string;
  contrato?: string;
  persona_visitada?: string;
  empleado_cedula?: string | null;
  observaciones?: string;
}

export type GrupoCredencial = "externo" | "temporal";

function rutaGrupo(grupo: GrupoCredencial): string {
  return grupo === "temporal"
    ? "/api/v1/carnetizacion/credenciales-temporales/"
    : "/api/v1/carnetizacion/credenciales-externas/";
}

export const credencialesExternasApi = {
  listar: async (
    grupo: GrupoCredencial,
    filtros?: { tipo?: string; estado?: string; desde?: string; hasta?: string },
  ) => {
    const envelope = await apiClient.get<ApiResponse<CredencialExternaApiItem[]>>(
      rutaGrupo(grupo),
      { params: filtros },
    );
    return envelope.data ?? [];
  },

  crear: async (grupo: GrupoCredencial, datos: CrearCredencialExternaApiInput) => {
    const envelope = await apiClient.post<ApiResponse<CredencialExternaApiItem>>(
      rutaGrupo(grupo),
      datos as unknown as Record<string, unknown>,
    );
    return envelope.data;
  },

  devolver: async (id: string) => {
    const envelope = await apiClient.post<ApiResponse<CredencialExternaApiItem>>(
      `/api/v1/carnetizacion/credenciales-externas/${id}/devolver/`,
    );
    return envelope.data;
  },

  anular: async (id: string) => {
    const envelope = await apiClient.post<ApiResponse<CredencialExternaApiItem>>(
      `/api/v1/carnetizacion/credenciales-externas/${id}/anular/`,
    );
    return envelope.data;
  },

  pdf: (id: string) =>
    apiClient.getBlob(`/api/v1/carnetizacion/credenciales-externas/${id}/pdf/`),

  lotePdf: (ids: string[]) =>
    apiClient.postBlob("/api/v1/carnetizacion/credenciales-externas/lote/pdf/", { ids }),

  enviar: async (id: string, destinatario?: string) => {
    const envelope = await apiClient.post<ApiResponse<{ enviado: boolean }>>(
      `/api/v1/carnetizacion/credenciales-externas/${id}/enviar/`,
      { destinatario: destinatario ?? "" },
    );
    return envelope.data;
  },
};
