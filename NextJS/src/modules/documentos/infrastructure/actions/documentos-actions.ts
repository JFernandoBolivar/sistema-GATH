"use server";

/**
 * Server Actions del módulo `documentos` (regla R7): capturan el error, redirigen
 * si la sesión terminó y devuelven un resultado serializable con el mensaje y,
 * si el backend los dio, los errores por ruta (`bloques.3.celdas.0.variable`).
 */
import { unstable_rethrow } from "next/navigation";

import { ApiHttpError, handleSessionExpired } from "@/shared/infrastructure/http/errors";
import type {
  BorradorPlantilla,
  CatalogoVariables,
  PlantillaCompleta,
  PlantillaResumen,
  VersionPlantilla,
} from "../../domain/entities/plantilla";
import { documentosApi, type NuevaPlantilla } from "../http/documentos-api";

export type ResultadoDocumentos<T> =
  | { success: true; data: T; message?: string }
  | { success: false; error: string; status?: number; errores?: Record<string, string[]> };

async function ejecutar<T>(
  trabajo: () => Promise<{ data: T; message?: string }>,
  mensajePorDefecto: string,
): Promise<ResultadoDocumentos<T>> {
  try {
    const r = await trabajo();
    return { success: true, data: r.data, message: r.message };
  } catch (e) {
    unstable_rethrow(e);
    handleSessionExpired(e);
    if (e instanceof ApiHttpError) {
      return { success: false, error: e.message || mensajePorDefecto, status: e.status, errores: e.errores };
    }
    return { success: false, error: e instanceof Error && e.message ? e.message : mensajePorDefecto };
  }
}

export async function obtenerVariablesAction(): Promise<ResultadoDocumentos<CatalogoVariables>> {
  return ejecutar(() => documentosApi.variables(), "No se pudo cargar el catálogo de variables.");
}

export async function listarPlantillasAction(): Promise<ResultadoDocumentos<PlantillaResumen[]>> {
  return ejecutar(() => documentosApi.listar(), "No se pudieron cargar las plantillas.");
}

export async function crearPlantillaAction(datos: NuevaPlantilla): Promise<ResultadoDocumentos<PlantillaCompleta>> {
  return ejecutar(() => documentosApi.crear(datos), "No se pudo crear la plantilla.");
}

export async function obtenerPlantillaAction(id: string): Promise<ResultadoDocumentos<PlantillaCompleta>> {
  return ejecutar(() => documentosApi.obtener(id), "No se pudo cargar la plantilla.");
}

export async function guardarPlantillaAction(
  id: string,
  datos: Partial<BorradorPlantilla>,
): Promise<ResultadoDocumentos<PlantillaCompleta>> {
  return ejecutar(() => documentosApi.guardar(id, datos), "No se pudo guardar el borrador.");
}

export async function publicarPlantillaAction(
  id: string,
): Promise<ResultadoDocumentos<{ version: VersionPlantilla; plantilla: PlantillaCompleta }>> {
  return ejecutar(() => documentosApi.publicar(id), "No se pudo publicar la plantilla.");
}

export async function duplicarPlantillaAction(id: string): Promise<ResultadoDocumentos<PlantillaCompleta>> {
  return ejecutar(() => documentosApi.duplicar(id), "No se pudo duplicar la plantilla.");
}

export async function activarPlantillaAction(
  id: string,
  activa: boolean,
): Promise<ResultadoDocumentos<PlantillaCompleta>> {
  return ejecutar(() => documentosApi.activar(id, activa), "No se pudo cambiar el estado de la plantilla.");
}

export async function listarVersionesAction(id: string): Promise<ResultadoDocumentos<VersionPlantilla[]>> {
  return ejecutar(() => documentosApi.versiones(id), "No se pudo cargar el historial de versiones.");
}
