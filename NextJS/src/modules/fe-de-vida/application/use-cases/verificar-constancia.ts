import type { ConstanciaVerificadaEntity } from "../../domain/entities/verificacion-constancia";
import type { RepoVerificacionConstancia } from "../../domain/ports/repo-verificacion-constancia";
import { codigoVerificacionValido } from "../../domain/services/verificacion-constancia";

export type ResultadoVerificacion =
  | { tipo: "valida"; constancia: ConstanciaVerificadaEntity; interna: boolean }
  | { tipo: "invalida" }
  | { tipo: "error"; mensaje: string };

const MENSAJE_LIMITE = "Hay demasiadas consultas en este momento. Intente de nuevo en un minuto.";
const MENSAJE_ERROR =
  "No fue posible verificar la constancia en este momento. Intente de nuevo más tarde.";

function estadoDe(error: unknown): number | null {
  const estado = (error as { status?: unknown } | null)?.status;
  return typeof estado === "number" ? estado : null;
}

async function consultar(
  consulta: () => Promise<ConstanciaVerificadaEntity>,
  interna: boolean,
): Promise<ResultadoVerificacion | "sin-permiso"> {
  try {
    return { tipo: "valida", constancia: await consulta(), interna };
  } catch (error) {
    const estado = estadoDe(error);
    if (estado === 404) return { tipo: "invalida" };
    if (estado === 429) return { tipo: "error", mensaje: MENSAJE_LIMITE };
    if (interna && (estado === 401 || estado === 403)) return "sin-permiso";
    return { tipo: "error", mensaje: MENSAJE_ERROR };
  }
}

/**
 * Verifica el código del QR. Con permiso consulta la vista interna (completa); si no, o si el
 * servidor la deniega, la pública. Nunca lanza: la ficha siempre tiene un estado que mostrar.
 */
export async function verificarConstancia(
  repo: RepoVerificacionConstancia,
  codigo: string,
  puedeVerInterna: boolean,
): Promise<ResultadoVerificacion> {
  const limpio = codigo.trim();
  if (!codigoVerificacionValido(limpio)) return { tipo: "invalida" };
  if (puedeVerInterna) {
    const interna = await consultar(() => repo.verificarInterna(limpio), true);
    if (interna !== "sin-permiso") return interna;
  }
  const publica = await consultar(() => repo.verificarPublica(limpio), false);
  return publica === "sin-permiso" ? { tipo: "error", mensaje: MENSAJE_ERROR } : publica;
}
