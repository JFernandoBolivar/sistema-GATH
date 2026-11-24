import type { HitoHistorial } from "./expediente";

/** Motivo con el que el expediente entró a `estado` (el hito más reciente hacia ese estado). */
export function motivoDeEntrada(historial: readonly HitoHistorial[], estado: string): string {
  for (let i = historial.length - 1; i >= 0; i--) {
    if (historial[i].estadoDestino === estado) return historial[i].motivo;
  }
  return "";
}
