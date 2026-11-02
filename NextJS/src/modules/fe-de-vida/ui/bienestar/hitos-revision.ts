import type { HitoLineaTiempo } from "@/shared/ui/components/linea-tiempo";
import type { SolicitudDTO } from "../../application/dtos/fe-de-vida-dto";
import { rolLegible } from "../../domain/services/reglas";
import { formatearFechaHora } from "../comun/formato";
import { hitosSolicitud } from "../pasivo/seguimiento-solicitud";

/**
 * Línea de tiempo de la revisión: los hitos de la solicitud más los checks del envío en curso, incluido el
 * retiro («Check retirado por <nombre> (<rol>): <motivo>»). Solo para Bienestar: el pasivo no ve revisores.
 */
export function hitosRevision(s: SolicitudDTO): HitoLineaTiempo[] {
  const base = hitosSolicitud(s);
  const decisiones: HitoLineaTiempo[] = s.decisiones
    .filter((d) => d.envio === s.envios && (d.tipo === "CHECK" || d.tipo === "CHECK_RETIRADO"))
    .map((d, i) => {
      const quien = `${d.actorNombre || d.actorCedula} (${rolLegible(d.rol)})`;
      return {
        id: `decision-${i}`,
        titulo:
          d.tipo === "CHECK" ? `Check dado por ${quien}` : `Check retirado por ${quien}: ${d.motivo}`,
        fecha: formatearFechaHora(d.fecha),
        estado: "hecho" as const,
      };
    });
  const i = base.findIndex((h) => h.id === "revision");
  return [...base.slice(0, i + 1), ...decisiones, ...base.slice(i + 1)];
}
