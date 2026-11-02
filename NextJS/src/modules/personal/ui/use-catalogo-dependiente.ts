"use client";

/**
 * Carga en cascada un catálogo filtrado por su padre (municipios por estado,
 * carreras por nivel académico, menciones por carrera, etc.) vía la Server
 * Action `getCatalogoDependienteAction` (R7). Lo usan el wizard de registro y
 * los diálogos de actualización del expediente.
 *
 * `valorActual` + `respaldo`: si el valor ya guardado no viene en la lista
 * filtrada (p. ej. carreras históricas sin nivel académico asociado), se
 * agrega desde el catálogo completo para que el select no quede en blanco.
 */
import { useMemo } from "react";
import useSWR from "swr";

import type { CatalogoEmpleadoDTO } from "../application/dtos/empleado-dto";
import { getCatalogoDependienteAction } from "../infrastructure/actions/registro-actions";

type TipoDependiente = Parameters<typeof getCatalogoDependienteAction>[0];

/** Agrega el valor ya guardado (tomado de `respaldo`) si la lista filtrada no lo trae. */
export function conValorActual(
  base: CatalogoEmpleadoDTO[],
  valorActual?: number | null,
  respaldo?: CatalogoEmpleadoDTO[],
): CatalogoEmpleadoDTO[] {
  if (!valorActual || valorActual <= 0 || base.some((o) => o.id === valorActual)) return base;
  const guardado = respaldo?.find((o) => o.id === valorActual);
  return guardado ? [guardado, ...base] : base;
}

export function useCatalogoDependiente(
  tipo: TipoDependiente,
  padreId: number | null | undefined,
  opciones?: { valorActual?: number | null; respaldo?: CatalogoEmpleadoDTO[] },
) {
  const padreValido = typeof padreId === "number" && padreId > 0 ? padreId : null;
  const { data, isLoading } = useSWR(padreValido ? ["catalogo-dependiente", tipo, padreValido] : null, () =>
    getCatalogoDependienteAction(tipo, padreValido!),
  );

  const valorActual = opciones?.valorActual;
  const respaldo = opciones?.respaldo;
  const lista = useMemo(() => conValorActual(data ?? [], valorActual, respaldo), [data, valorActual, respaldo]);

  return { opciones: lista, isLoading: padreValido !== null && isLoading };
}
