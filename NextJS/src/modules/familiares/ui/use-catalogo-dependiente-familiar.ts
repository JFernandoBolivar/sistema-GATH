"use client";

/**
 * Carga en cascada un catálogo del mini-expediente del familiar filtrado por
 * su padre (carreras por nivel académico, menciones por carrera), vía la
 * Server Action `getCatalogoDependienteFamiliarAction` (R7). Mismo patrón
 * que `modules/personal/ui/use-catalogo-dependiente.ts`.
 *
 * `valorActual` + `respaldo`: si el valor ya guardado no viene en la lista
 * filtrada, se agrega desde el catálogo completo para que el select no
 * quede en blanco.
 */
import { useMemo } from "react";
import useSWR from "swr";

import type { CatalogoFamiliarDTO } from "../application/dtos/familiar-dto";
import { getCatalogoDependienteFamiliarAction } from "../infrastructure/actions/familiares-actions";

type TipoDependiente = Parameters<typeof getCatalogoDependienteFamiliarAction>[0];

/** Agrega el valor ya guardado (tomado de `respaldo`) si la lista filtrada no lo trae. */
export function conValorActualFamiliar(
  base: CatalogoFamiliarDTO[],
  valorActual?: number | null,
  respaldo?: CatalogoFamiliarDTO[],
): CatalogoFamiliarDTO[] {
  if (!valorActual || valorActual <= 0 || base.some((o) => o.id === valorActual)) return base;
  const guardado = respaldo?.find((o) => o.id === valorActual);
  return guardado ? [guardado, ...base] : base;
}

export function useCatalogoDependienteFamiliar(
  tipo: TipoDependiente,
  padreId: number | null | undefined,
  opciones?: { valorActual?: number | null; respaldo?: CatalogoFamiliarDTO[] },
) {
  const padreValido = typeof padreId === "number" && padreId > 0 ? padreId : null;
  const { data, isLoading } = useSWR(padreValido ? ["catalogo-dependiente-familiar", tipo, padreValido] : null, () =>
    getCatalogoDependienteFamiliarAction(tipo, padreValido!),
  );

  const valorActual = opciones?.valorActual;
  const respaldo = opciones?.respaldo;
  const lista = useMemo(() => conValorActualFamiliar(data ?? [], valorActual, respaldo), [data, valorActual, respaldo]);

  return { opciones: lista, isLoading: padreValido !== null && isLoading };
}
