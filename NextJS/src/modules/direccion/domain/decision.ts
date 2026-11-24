import { construirBarraAcciones, type ItemBarraAcciones } from "@/modules/captacion/domain/barra-acciones";
import type { AccionExpediente } from "@/modules/presupuesto/domain/solicitud";
import { DESTINO_APROBAR, DESTINO_RECHAZAR } from "./ingreso";

export interface PanelDecision {
  aprobar: ItemBarraAcciones | null;
  rechazar: ItemBarraAcciones | null;
}

/** Separa las acciones del servidor en «aprobar» y «rechazar»; no inventa ninguna que el servidor no envíe. */
export function panelDecision(acciones: readonly AccionExpediente[]): PanelDecision {
  const items = construirBarraAcciones(acciones);
  return {
    aprobar: items.find((i) => i.destino === DESTINO_APROBAR) ?? null,
    rechazar: items.find((i) => i.destino === DESTINO_RECHAZAR) ?? null,
  };
}
