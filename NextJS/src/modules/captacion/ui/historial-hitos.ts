import type { HitoLineaTiempo } from "@/shared/ui/components/linea-tiempo";
import { describirEstado, type HitoHistorial } from "../domain/expediente";
import { describirActor, formatearFechaHora } from "../domain/formato";

/** Historial de transiciones → línea de tiempo (el último es el paso actual; los rechazos se marcan como no aprobados). */
export function hitosDeHistorial(historial: readonly HitoHistorial[]): HitoLineaTiempo[] {
  return historial.map((h, i) => {
    const { etiqueta, tono } = describirEstado(h.estadoDestino);
    const actor = describirActor(h.actorTipo, h.actorCedula);
    return {
      id: `${h.fecha}-${i}`,
      titulo: etiqueta,
      fecha: formatearFechaHora(h.fecha),
      detalle: h.motivo ? `${actor}. Motivo: ${h.motivo}` : actor,
      estado: tono === "danger" ? "fallido" : i === historial.length - 1 ? "actual" : "hecho",
    };
  });
}
