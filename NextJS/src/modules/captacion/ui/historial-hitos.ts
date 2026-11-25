import type { HitoLineaTiempo } from "@/shared/ui/components/linea-tiempo";
import { describirEstado, type HitoHistorial } from "../domain/expediente";
import { sinJerga } from "../domain/jerga";
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

/** Asiento de la aprobación firmada fuera del sistema (M-1): sí cambia el estado (a «Aprobado»). */
export const TIPO_APROBACION_FUERA_SISTEMA = "APROBACION_FUERA_SISTEMA";

/** «Aprobado fuera del sistema; registrado por X el …; firma del …» → «Registrado por X el …; firma del …». */
function detalleDeAprobacionFueraDelSistema(motivo: string): string {
  const resto = motivo.replace(/^\s*aprobado fuera del sistema\s*[;:,.-]?\s*/i, "").replace(/;\s*/g, " · ").replace(/\.\s*$/, "");
  return resto ? `${resto.charAt(0).toUpperCase()}${resto.slice(1)}.` : "";
}

export function hitosDeHistorial(historial: readonly HitoHistorial[]): HitoLineaTiempo[] {
  // El paso actual es el último CAMBIO DE ESTADO: los asientos sin cambio (enlace, contacto) no lo desplazan.
  const cambiaEstado = (h: HitoHistorial) => !h.tipo || h.tipo === TIPO_APROBACION_FUERA_SISTEMA;
  const actual = historial.reduce((idx, h, i) => (cambiaEstado(h) ? i : idx), historial.length - 1);
  return historial.map((h, i) => {
    const { etiqueta, tono } = describirEstado(h.estadoDestino);
    const actor = describirActor(h.actorTipo, h.actorCedula, h.actorNombre);
    if (h.tipo === TIPO_APROBACION_FUERA_SISTEMA) {
      return {
        id: `${h.fecha}-${i}`,
        titulo: "Aprobado fuera del sistema",
        fecha: formatearFechaHora(h.fecha),
        detalle: detalleDeAprobacionFueraDelSistema(h.motivo) || actor,
        estado: i === actual ? "actual" : "hecho",
      };
    }
    return {
      id: `${h.fecha}-${i}`,
      titulo: tituloDeAsiento(h) ?? etiqueta,
      fecha: formatearFechaHora(h.fecha),
      detalle: h.motivo ? `${actor}. Motivo: ${sinJerga(h.motivo)}` : actor,
      estado: tono === "danger" ? "fallido" : i === actual ? "actual" : "hecho",
    };
  });
}
