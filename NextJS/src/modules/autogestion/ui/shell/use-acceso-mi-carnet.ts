"use client";

import useSWR from "swr";

import { getMiCarnetAccesoAction } from "../../infrastructure/actions/autogestion-actions";

/**
 * Acceso a Mi Carnet según el backend (alcance configurable y usuarios
 * específicos). Mientras no se conoce la respuesta se oculta el ítem: no se
 * duplica la regla en el frontend ni se muestra un acceso que luego falla.
 */
export function useAccesoMiCarnet(): { puedeVerCarnet: boolean; cargando: boolean } {
  const { data, isLoading } = useSWR("mi-carnet-acceso", () => getMiCarnetAccesoAction(), {
    revalidateOnFocus: false,
    shouldRetryOnError: false,
  });
  return { puedeVerCarnet: data === true, cargando: isLoading };
}
