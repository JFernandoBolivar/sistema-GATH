import type { OpcionCatalogo } from "../../domain/ports/repo-catalogos-autogestion";
import type { ClaveCatalogo } from "../../domain/value-objects/campos-seccion";
import { listarCatalogoAction } from "../../infrastructure/actions/solicitudes-actions";

/** Carga un catálogo vía Server Action; ante error lanza el mensaje (para que SWR lo exponga). */
export async function opcionesCatalogo(
  clave: ClaveCatalogo,
  padreId?: number,
): Promise<OpcionCatalogo[]> {
  const res = await listarCatalogoAction(clave, padreId);
  if (!res.ok) throw new Error(res.mensaje);
  return res.datos;
}
