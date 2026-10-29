"use client";

import useSWR from "swr";
import type { CambioEntity } from "../../domain/entities/solicitud-actualizacion";
import type { ClaveCatalogo } from "../../domain/value-objects/campos-seccion";
import { catalogoDeCampo, type NombresCatalogo } from "../formato-solicitud";
import { opcionesCatalogo } from "./opciones-catalogo";

type CambioMinimo = Pick<CambioEntity, "campo" | "valorPropuesto">;

function clavesNecesarias(cambios: CambioMinimo[]): string[] {
  const claves = new Set<string>();
  for (const c of cambios) {
    const direct = catalogoDeCampo(c.campo);
    if (direct) claves.add(direct);
    for (const campo of Object.keys(
      typeof c.valorPropuesto === "object" && c.valorPropuesto ? c.valorPropuesto : {},
    )) {
      const k = catalogoDeCampo(campo);
      if (k) claves.add(k);
    }
  }
  return [...claves].sort();
}

/** Nombres de catálogo para mostrar «Libertador» en vez de «Código 5». Si un catálogo falla, se muestra el código. */
export function useNombresCatalogo(cambios: CambioMinimo[]): NombresCatalogo {
  const claves = clavesNecesarias(cambios);
  const { data } = useSWR(
    claves.length ? ["nombres-catalogo", claves.join(",")] : null,
    async () => {
      const pares = await Promise.all(
        claves.map(async (clave) => {
          try {
            const opciones = await opcionesCatalogo(clave as ClaveCatalogo);
            return [clave, Object.fromEntries(opciones.map((o) => [o.id, o.nombre]))] as const;
          } catch {
            return [clave, {}] as const;
          }
        }),
      );
      return Object.fromEntries(pares) as NombresCatalogo;
    },
    { revalidateOnFocus: false },
  );
  return data ?? {};
}
