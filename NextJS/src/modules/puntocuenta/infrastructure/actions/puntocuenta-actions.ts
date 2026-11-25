"use server";

import { unstable_rethrow } from "next/navigation";

import { ApiHttpError, handleSessionExpired } from "@/shared/infrastructure/http/errors";
import { puntoCuentaApi } from "../http/puntocuenta-api";
import type {
  CambiosConfiguracionPuntoCuenta,
  ConfiguracionPuntoCuenta,
} from "../../domain/entities/configuracion-punto-cuenta";
import type { FiltrosPuntoCuenta, PuntoCuentaItem } from "../../domain/entities/punto-cuenta";

export type ResultadoPuntoCuenta<T> =
  | { success: true; data: T; message?: string }
  | { success: false; error: string; status?: number };

async function ejecutar<T>(
  trabajo: () => Promise<{ data: T; message?: string }>,
  mensajePorDefecto: string,
): Promise<ResultadoPuntoCuenta<T>> {
  try {
    const r = await trabajo();
    return { success: true, data: r.data, message: r.message };
  } catch (e) {
    unstable_rethrow(e);
    handleSessionExpired(e);
    if (e instanceof ApiHttpError) {
      return { success: false, error: e.message || mensajePorDefecto, status: e.status };
    }
    return { success: false, error: e instanceof Error && e.message ? e.message : mensajePorDefecto };
  }
}

export async function listarPuntosCuentaAction(
  filtros?: FiltrosPuntoCuenta,
): Promise<ResultadoPuntoCuenta<PuntoCuentaItem[]>> {
  return ejecutar(() => puntoCuentaApi.listar(filtros), "Error al obtener los puntos de cuenta");
}

export async function obtenerConfiguracionPuntoCuentaAction(): Promise<ResultadoPuntoCuenta<ConfiguracionPuntoCuenta>> {
  return ejecutar(
    () => puntoCuentaApi.obtenerConfiguracion(),
    "No se pudo cargar la configuración de los procesos del Punto de Cuenta.",
  );
}

export async function guardarConfiguracionPuntoCuentaAction(
  datos: CambiosConfiguracionPuntoCuenta,
): Promise<ResultadoPuntoCuenta<ConfiguracionPuntoCuenta>> {
  return ejecutar(
    () => puntoCuentaApi.guardarConfiguracion(datos),
    "No se pudo guardar la configuración de los procesos del Punto de Cuenta.",
  );
}
