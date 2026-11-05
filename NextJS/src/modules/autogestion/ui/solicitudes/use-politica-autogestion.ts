"use client";

import useSWR from "swr";
import { obtenerMiPoliticaAutogestionAction } from "../../infrastructure/actions/solicitudes-actions";
import type { PoliticaAutogestionDTO } from "../../application/dtos/solicitud-dto";

/**
 * Configuración vigente de solicitudes para la condición de la sesión (O12).
 * Mientras carga devuelve `undefined`; quien la use decide el estado de espera.
 */
export function usePoliticaAutogestion() {
  const { data, isLoading, mutate } = useSWR<PoliticaAutogestionDTO>(
    "mi-politica-autogestion",
    async () => {
      const res = await obtenerMiPoliticaAutogestionAction();
      if (!res.ok) throw new Error(res.mensaje);
      return res.datos;
    },
    { revalidateOnFocus: false },
  );
  return { politica: data, isLoading, mutate };
}
