"use client";

import useSWR from "swr";

import type {
  AlertaPlantilla,
  CatalogoVariables,
  DocumentoGeneradoResumen,
  FiltrosPlantilla,
  ListadoBajoDemanda,
  PlantillaBajoDemanda,
  PlantillaCompleta,
  PlantillaResumen,
} from "../../domain/entities/plantilla";
import {
  listarBajoDemandaAction,
  listarPlantillasConAlertasAction,
  obtenerPlantillaAction,
  obtenerVariablesAction,
} from "../../infrastructure/actions/documentos-actions";

export function usePlantillas(filtros: FiltrosPlantilla = {}) {
  const proceso = filtros.proceso ?? "";
  const grupo = filtros.grupo ?? "";
  const { data, isLoading, mutate } = useSWR(
    ["documentos/plantillas", proceso, grupo],
    () => listarPlantillasConAlertasAction({ proceso: proceso || undefined, grupo: grupo || undefined }),
  );
  const listado = data?.success ? data.data : null;
  // Tolera un backend que aún responda solo con la lista (sin el sobre `{plantillas, alertas}`).
  const plantillas: PlantillaResumen[] = Array.isArray(listado) ? listado : (listado?.plantillas ?? []);
  const alertas: AlertaPlantilla[] = Array.isArray(listado) ? [] : (listado?.alertas ?? []);
  return {
    plantillas,
    alertas,
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
    { revalidateOnFocus: false, revalidateOnReconnect: true },
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

export function useVariables(proceso?: string) {
  const { data, isLoading, mutate } = useSWR(
    ["documentos/variables", proceso ?? "todas"],
    () => obtenerVariablesAction(proceso),
    { revalidateOnFocus: false, revalidateOnReconnect: true },
  );
  const catalogo: CatalogoVariables | null = data?.success ? data.data : null;
  return { catalogo, cargando: isLoading, error: data && !data.success ? data.error : null, recargar: () => mutate() };
}

/** El panel bajo demanda solo consulta mientras la ficha del trabajador está abierta. */
export function useDocumentosBajoDemanda(cedula: string | null, activo: boolean) {
  const { data, isLoading, mutate } = useSWR(
    activo && cedula ? ["documentos/bajo-demanda", cedula] : null,
    () => listarBajoDemandaAction(cedula as string),
    { revalidateOnFocus: false },
  );
  const listado: ListadoBajoDemanda | null = data?.success ? data.data : null;
  return {
    plantillas: listado?.plantillas ?? [],
    generados: listado?.generados ?? [],
    cargando: isLoading,
    error: data && !data.success ? data.error : null,
    recargar: () => mutate(),
  };
}

export type { DocumentoGeneradoResumen, PlantillaBajoDemanda };
