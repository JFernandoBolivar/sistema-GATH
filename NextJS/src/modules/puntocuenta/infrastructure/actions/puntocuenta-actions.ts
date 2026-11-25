"use server";

import { puntoCuentaApi } from "../http/puntocuenta-api";
import type { FiltrosPuntoCuenta, PuntoCuentaItem } from "../../domain/entities/punto-cuenta";

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
