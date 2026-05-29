import { apiFetch } from "@/lib/api-client";
import type { EmployeeCarnet, EstadisticasData, MotivoOption, Plantilla } from "../types/carnetizacion";

export async function searchEmployees(query: string): Promise<EmployeeCarnet[]> {
  try {
    return await apiFetch<EmployeeCarnet[]>(`carnetizacion/api/buscar/?q=${encodeURIComponent(query)}`, {
      cache: "no-cache",
    });
  } catch (error) {
    throw new Error("Error en la búsqueda");
  }
}

export async function getEstadisticas(): Promise<EstadisticasData> {
  try {
    return await apiFetch<EstadisticasData>(`carnetizacion/estadisticas/`, {
      cache: "no-cache",
    });
  } catch (error) {
    throw new Error("Error al cargar estadísticas");
  }
}

export async function getMotivos(): Promise<MotivoOption[]> {
  try {
    return await apiFetch<MotivoOption[]>(`carnetizacion/api/motivos/`, {
      cache: "no-cache",
    });
  } catch (error) {
    throw new Error("Error al cargar motivos");
  }
}

export async function getPlantillas(): Promise<Plantilla[]> {
  try {
    return await apiFetch<Plantilla[]>(`carnetizacion/api/plantillas/`, {
      cache: "no-cache",
    });
  } catch (error) {
    throw new Error("Error al cargar plantillas");
  }
}

