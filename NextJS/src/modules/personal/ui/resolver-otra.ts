/**
 * Resolución de opciones "Otra" en los diálogos de actualización del
 * expediente: valida que se haya escrito el nombre, crea/reutiliza los
 * registros con `resolverAltasInlineAction` y asigna los ids obtenidos.
 */
import type { SolicitudAltaInline } from "../application/use-cases/resolver-altas-inline";
import { resolverAltasInlineAction } from "../infrastructure/actions/registro-actions";

export interface PendienteOtra {
  solicitud: SolicitudAltaInline;
  /** Mensaje si el usuario no escribió el nombre nuevo. */
  faltaNombre: string;
  asignar: (id: number) => void;
}

/** Devuelve `null` si todo se resolvió, o el mensaje de error a mostrar. */
export async function resolverPendientesOtra(
  pendientes: PendienteOtra[],
  resolver: typeof resolverAltasInlineAction = resolverAltasInlineAction,
): Promise<string | null> {
  if (pendientes.length === 0) return null;
  const sinNombre = pendientes.find((p) => !p.solicitud.nombre.trim());
  if (sinNombre) return sinNombre.faltaNombre;

  const resultado = await resolver(pendientes.map((p) => p.solicitud));
  if (resultado.error !== undefined) return resultado.error;
  (resultado.ok ?? []).forEach((item, i) => pendientes[i].asignar(item.id));
  return null;
}
