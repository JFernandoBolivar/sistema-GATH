"use client";

/**
 * Caché compartida de catálogos del expediente para toda la sesión (Fase 2).
 *
 * Vive a nivel de módulo (no por montaje de página): al navegar entre listado,
 * detalle y registro no se vuelven a pedir los 24 catálogos. Además deduplica
 * las peticiones concurrentes: si dos pantallas los piden a la vez, comparten
 * la misma promesa en vuelo.
 */
import type { CatalogosExpedienteDTO } from "../../application/dtos/empleado-dto";
import { getCatalogosExpedienteAction } from "../actions/personal-actions";

let cache: CatalogosExpedienteDTO | null = null;
let enVuelo: Promise<CatalogosExpedienteDTO> | null = null;

export function catalogosEnMemoria(): CatalogosExpedienteDTO | null {
  return cache;
}

export async function obtenerCatalogosExpediente(): Promise<CatalogosExpedienteDTO> {
  if (cache) return cache;
  if (!enVuelo) {
    enVuelo = getCatalogosExpedienteAction()
      .then((catalogos) => {
        cache = catalogos;
        return catalogos;
      })
      .finally(() => {
        enVuelo = null;
      });
  }
  return enVuelo;
}

export function limpiarCatalogosExpediente(): void {
  cache = null;
  enVuelo = null;
}
