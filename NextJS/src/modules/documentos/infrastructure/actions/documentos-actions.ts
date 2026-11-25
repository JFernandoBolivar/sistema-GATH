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
  DocumentoGeneradoResumen,
  GenerarBajoDemandaInput,
  ListadoBajoDemanda,
  ListadoPlantillas,
  PlantillaCompleta,
  PlantillaResumen,
  VersionPlantilla,
} from "../../domain/entities/plantilla";
import { documentosApi, type FiltrosPlantilla, type NuevaPlantilla } from "../http/documentos-api";

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

export async function obtenerVariablesAction(proceso?: string): Promise<ResultadoDocumentos<CatalogoVariables>> {
  return ejecutar(() => documentosApi.variables(proceso), "No se pudo cargar el catálogo de variables.");
}

export async function listarPlantillasAction(
  filtros: FiltrosPlantilla = {},
): Promise<ResultadoDocumentos<PlantillaResumen[]>> {
  return ejecutar(() => documentosApi.listar(filtros), "No se pudieron cargar las plantillas.");
}

export async function listarPlantillasConAlertasAction(
  filtros: FiltrosPlantilla = {},
): Promise<ResultadoDocumentos<ListadoPlantillas>> {
  return ejecutar(() => documentosApi.listarConAlertas(filtros), "No se pudieron cargar las plantillas.");
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

export async function listarBajoDemandaAction(
  trabajadorCedula: string,
): Promise<ResultadoDocumentos<ListadoBajoDemanda>> {
  return ejecutar(
    () => documentosApi.bajoDemanda(trabajadorCedula),
    "No se pudieron cargar los documentos del trabajador.",
  );
}

export async function generarBajoDemandaAction(
  datos: GenerarBajoDemandaInput,
): Promise<ResultadoDocumentos<DocumentoGeneradoResumen>> {
  return ejecutar(() => documentosApi.generarBajoDemanda(datos), "No se pudo generar el documento.");
}

export interface DescargaPdf {
  /** Proxy mismo origen; el binario nunca viaja dentro de la Server Action. */
  url: string;
  nombre: string;
}

/** Devuelve metadatos de descarga. El PDF se obtiene después por streaming en el Route Handler. */
export async function descargarDocumentoGeneradoAction(
  id: string,
  nombre: string,
): Promise<ResultadoDocumentos<DescargaPdf>> {
  return ejecutar(async () => {
    const base = nombre
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80);
    return {
      data: {
        url: `/api/documentos/generados/${encodeURIComponent(id)}/archivo/`,
        nombre: `${base || "documento"}-${id.slice(0, 8)}.pdf`,
      },
    };
  }, "No se pudo preparar la descarga del documento.");
}
