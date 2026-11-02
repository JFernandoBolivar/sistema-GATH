/**
 * Resolución de opciones "Otra" en el mini-expediente del familiar: valida
 * que se haya escrito el nombre, crea/reutiliza los registros con
 * `resolverAltasInlineFamiliarAction` y asigna los ids obtenidos. Mismo
 * patrón que `modules/personal/ui/resolver-otra.ts`.
 */
import type { SolicitudAltaInlineFamiliar } from "../application/use-cases/resolver-altas-inline-familiar";
import { resolverAltasInlineFamiliarAction } from "../infrastructure/actions/familiares-actions";

export interface PendienteOtraFamiliar {
  solicitud: SolicitudAltaInlineFamiliar;
  /** Mensaje si el usuario no escribió el nombre nuevo. */
  faltaNombre: string;
  asignar: (id: number) => void;
}

/** Devuelve `null` si todo se resolvió, o el mensaje de error a mostrar. */
export async function resolverPendientesOtraFamiliar(
  pendientes: PendienteOtraFamiliar[],
  resolver: typeof resolverAltasInlineFamiliarAction = resolverAltasInlineFamiliarAction,
): Promise<string | null> {
  if (pendientes.length === 0) return null;
  const sinNombre = pendientes.find((p) => !p.solicitud.nombre.trim());
  if (sinNombre) return sinNombre.faltaNombre;

  const resultado = await resolver(pendientes.map((p) => p.solicitud));
  if (resultado.error !== undefined) return resultado.error;
  (resultado.ok ?? []).forEach((item, i) => pendientes[i].asignar(item.id));
  return null;
}
