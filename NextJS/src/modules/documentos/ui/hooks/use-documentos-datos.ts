"use client";

import useSWR from "swr";

import {
  listarPlantillasAction,
  obtenerPlantillaAction,
  obtenerVariablesAction,
} from "../../infrastructure/actions/documentos-actions";
import type { CatalogoVariables, PlantillaCompleta, PlantillaResumen } from "../../domain/entities/plantilla";

export function usePlantillas() {
  const { data, isLoading, mutate } = useSWR("documentos/plantillas", () => listarPlantillasAction());
  const plantillas: PlantillaResumen[] = data?.success ? data.data : [];
  return {
    plantillas,
    cargando: isLoading,
    error: data && !data.success ? data.error : null,
    recargar: () => mutate(),
  };
}

/**
 * Plantilla completa. Sin revalidar por foco ni reconexión: el editor siembra su
 * borrador local con el `id` y una revalidación nunca debe pisar lo que se edita.
 */
export function usePlantilla(id: string) {
  const { data, isLoading, mutate } = useSWR(
    ["documentos/plantilla", id],
    () => obtenerPlantillaAction(id),
    { revalidateOnFocus: false, revalidateOnReconnect: false },
  );
  const plantilla: PlantillaCompleta | null = data?.success ? data.data : null;
  return {
    plantilla,
    cargando: isLoading,
    error: data && !data.success ? data.error : null,
    status: data && !data.success ? data.status : undefined,
    mutate,
  };
}

export function useVariables() {
  const { data, isLoading } = useSWR("documentos/variables", () => obtenerVariablesAction(), {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
  });
  const catalogo: CatalogoVariables | null = data?.success ? data.data : null;
  return { catalogo, cargando: isLoading, error: data && !data.success ? data.error : null };
}
