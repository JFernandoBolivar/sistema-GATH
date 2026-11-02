/**
 * Endpoints de alta inline de catálogos académicos del backend
 * (`POST /api/v1/personal/catalogos/{carreras,menciones,instituciones,capacitaciones}/`).
 */
import { apiClient } from "@/shared/infrastructure/http/fetcher-api";
import type { ApiResponse } from "@/shared/types/api-response";

export interface CatalogoInlineApiItem {
  id: number;
  nombre: string;
}

const base = "/api/v1/personal/catalogos";

async function crear(path: string, body: Record<string, unknown>) {
  const envelope = await apiClient.post<ApiResponse<CatalogoInlineApiItem>>(`${base}/${path}/`, body);
  return envelope.data;
}

export const catalogosInlineApi = {
  crearCarrera: (nombre: string, nivelAcademicoId: number) =>
    crear("carreras", { nombre, nivel_academico_id: nivelAcademicoId }),
  crearMencion: (nombre: string, carreraId: number) => crear("menciones", { nombre, carrera_id: carreraId }),
  crearInstitucion: (nombre: string) => crear("instituciones", { nombre }),
  crearCapacitacion: (nombre: string) => crear("capacitaciones", { nombre }),
};
