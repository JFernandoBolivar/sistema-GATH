"use client";

import useSWR from "swr";

import type { ConfiguracionPuntoCuenta } from "@/modules/puntocuenta/domain/entities/configuracion-punto-cuenta";
import {
  guardarConfiguracionPuntoCuentaAction,
  obtenerConfiguracionPuntoCuentaAction,
  type ResultadoPuntoCuenta,
} from "@/modules/puntocuenta/infrastructure/actions/puntocuenta-actions";
import { usePlantillas } from "./use-documentos-datos";

/**
 * Configuración operativa del Punto de Cuenta y procesos sin plantilla publicada.
 * `activo` evita llamadas mientras el panel no está a la vista (la API exige
 * `configuracion.editar` y el listado de plantillas, permiso de lectura).
 */
export function useConfiguracionPuntoCuenta(activo = true) {
  const { data, isLoading, mutate } = useSWR(
    activo ? "puntocuenta/configuracion" : null,
    obtenerConfiguracionPuntoCuentaAction,
    { revalidateOnFocus: false },
  );
  const { alertas } = usePlantillas(activo ? { grupo: "punto_cuenta" } : {});
  const config: ConfiguracionPuntoCuenta | null = data?.success ? data.data : null;
  const faltantes = new Set(alertas.map((a) => a.proceso));

  const guardar = async (
    procesos: Record<string, boolean>,
  ): Promise<ResultadoPuntoCuenta<ConfiguracionPuntoCuenta>> => {
    const r = await guardarConfiguracionPuntoCuentaAction({ procesos_habilitados: procesos });
    if (r.success) await mutate({ success: true, data: r.data }, { revalidate: false });
    return r;
  };

  return {
    config,
    faltantes,
    cargando: isLoading,
    error: data && !data.success ? data.error : null,
    guardar,
    recargar: () => mutate(),
    actualizarCache: (nueva: ConfiguracionPuntoCuenta) =>
      mutate({ success: true, data: nueva }, { revalidate: false }),
  };
}
