"use server";

/**
 * Puente de solo lectura entre Familiares y la API de Pasivos. Evita que el
 * módulo de familiares importe código de `modules/pasivos`: solo consume las
 * rutas REST canónicas del backend.
 */
import { apiClient } from "@/shared/infrastructure/http/fetcher-api";
import type { ApiResponse } from "@/shared/types/api-response";

export interface PasivoResumen {
  cedula: string;
  nombres: string;
  apellidos: string;
  nombreCompleto: string;
}

interface PasivoApiResumen {
  cedula: string;
  nombres: string;
  apellidos: string;
  nombre_completo: string;
}

interface PaginaPasivosApiResumen {
  count: number;
  limit: number;
  offset: number;
  results: PasivoApiResumen[];
}

export async function listarPasivosParaFamiliarAction(): Promise<PasivoResumen[]> {
  try {
    const envelope = await apiClient.get<ApiResponse<PaginaPasivosApiResumen>>(
      "/api/v1/pasivos/",
      { params: { limit: 50, offset: 0 } },
    );
    return (envelope.data?.results ?? []).map((p) => ({
      cedula: p.cedula,
      nombres: p.nombres,
      apellidos: p.apellidos,
      nombreCompleto: p.nombre_completo,
    }));
  } catch {
    return [];
  }
}

export async function getPasivoResumenAction(cedula: string): Promise<PasivoResumen | null> {
  try {
    const envelope = await apiClient.get<ApiResponse<PasivoApiResumen>>(
      `/api/v1/pasivos/${encodeURIComponent(cedula)}/`,
    );
    const p = envelope.data;
    return {
      cedula: p.cedula,
      nombres: p.nombres,
      apellidos: p.apellidos,
      nombreCompleto: p.nombre_completo,
    };
  } catch {
    return null;
  }
}
