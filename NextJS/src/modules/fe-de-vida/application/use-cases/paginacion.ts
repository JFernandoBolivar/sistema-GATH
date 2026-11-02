import { LIMITE_MAXIMO_PAGINA, LIMITE_PAGINA } from "../../domain/value-objects/estados";

/** Normaliza límite (1..50, por defecto 10) y desplazamiento (>= 0) de un listado paginado. */
export function normalizarPagina(limit?: number, offset?: number): { limit: number; offset: number } {
  const l = Number.isFinite(limit) ? Math.trunc(limit as number) : LIMITE_PAGINA;
  const o = Number.isFinite(offset) ? Math.trunc(offset as number) : 0;
  return { limit: Math.min(Math.max(l, 1), LIMITE_MAXIMO_PAGINA), offset: Math.max(o, 0) };
}

export const vacioAUndefined = (v: string | undefined | null): string | undefined => {
  const t = v?.trim();
  return t ? t : undefined;
};
