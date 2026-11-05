"use server";

import { puntoCuentaApi } from "../http/puntocuenta-api";
import type { FiltrosPuntoCuenta, PuntoCuentaItem } from "../../domain/entities/punto-cuenta";
import type { ConfiguracionPuntoCuenta } from "../../domain/entities/configuracion-punto-cuenta";

export async function listarPuntosCuentaAction(filtros?: FiltrosPuntoCuenta): Promise<{
  success: boolean;
  data?: PuntoCuentaItem[];
  error?: string;
}> {
  try {
    const res = await puntoCuentaApi.listar(filtros);
    return { success: true, data: res.data };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Error al obtener los puntos de cuenta",
    };
  }
}

export async function obtenerConfiguracionPuntoCuentaAction(): Promise<{
  success: boolean;
  data?: ConfiguracionPuntoCuenta;
  error?: string;
}> {
  try {
    const res = await puntoCuentaApi.obtenerConfiguracion();
    return { success: true, data: res.data };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Error al obtener la configuración",
    };
  }
}

export async function guardarConfiguracionPuntoCuentaAction(datos: Partial<ConfiguracionPuntoCuenta>): Promise<{
  success: boolean;
  data?: ConfiguracionPuntoCuenta;
  error?: string;
}> {
  try {
    const res = await puntoCuentaApi.guardarConfiguracion(datos);
    return { success: true, data: res.data };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Error al guardar la configuración",
    };
  }
}
