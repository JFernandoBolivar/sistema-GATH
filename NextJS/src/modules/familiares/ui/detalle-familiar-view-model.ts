/**
 * Helpers de presentación puros para la vista de detalle de un familiar
 * (`detalle-familiar.tsx`). Sin React, testeables de forma aislada — mismo
 * patrón que `modules/personal/ui/expediente-detalle-view-model.ts`.
 */
import { formatInTimeZone } from "date-fns-tz";

const SIN_DATO = "N/A";

const ETIQUETAS_DOCUMENTO: Record<string, string> = {
  cedula: "Cédula del familiar",
  partida_nacimiento: "Partida de nacimiento",
};

export function fechaLegible(fecha?: string | null): string {
  if (!fecha) return SIN_DATO;
  const d = new Date(fecha);
  if (Number.isNaN(d.getTime())) return fecha;
  return formatInTimeZone(d, "UTC", "dd/MM/yyyy");
}

export function etiquetaDocumento(tipo: string): string {
  return ETIQUETAS_DOCUMENTO[tipo] ?? tipo;
}
