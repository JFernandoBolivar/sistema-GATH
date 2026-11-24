import type { HitoLineaTiempo } from "@/shared/ui/components/linea-tiempo";
import { describirEstado, type HitoHistorial } from "../domain/expediente";
import { describirActor, formatearFechaHora } from "../domain/formato";

/** Historial de transiciones → línea de tiempo (el último es el paso actual; los rechazos se marcan como no aprobados). */
/** Asientos del enlace de activación (D-10): no cambian de estado; el correo va enmascarado. */
function tituloDeAsiento(h: HitoHistorial): string | null {
  switch (h.tipo) {
    case "ENLACE_ACTIVACION_ENVIADO":
      return h.correoEnmascarado ? `Enlace de acceso enviado a ${h.correoEnmascarado}` : "Enlace de acceso enviado";
    case "ENLACE_ACTIVACION_USADO":
      return "El postulante creó su contraseña con el enlace";
    case "ENLACE_ACTIVACION_REVOCADO":
      return "Enlace de acceso anulado";
    default:
      return null;
  }
}

export function hitosDeHistorial(historial: readonly HitoHistorial[]): HitoLineaTiempo[] {
  // El paso actual es el último CAMBIO DE ESTADO: los asientos sin cambio (enlace, contacto) no lo desplazan.
  const actual = historial.reduce((idx, h, i) => (h.tipo ? idx : i), historial.length - 1);
  return historial.map((h, i) => {
    const { etiqueta, tono } = describirEstado(h.estadoDestino);
    const actor = describirActor(h.actorTipo, h.actorCedula);
    return {
      id: `${h.fecha}-${i}`,
      titulo: tituloDeAsiento(h) ?? etiqueta,
      fecha: formatearFechaHora(h.fecha),
      detalle: h.motivo ? `${actor}. Motivo: ${h.motivo}` : actor,
      estado: tono === "danger" ? "fallido" : i === actual ? "actual" : "hecho",
    };
  });
}
