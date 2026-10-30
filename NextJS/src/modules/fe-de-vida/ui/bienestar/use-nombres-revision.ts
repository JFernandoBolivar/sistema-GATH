"use client";

import useSWR from "swr";
import type { NombresCatalogo } from "@/modules/autogestion/ui/formato-solicitud";
import { useNombresCatalogo } from "@/modules/autogestion/ui/solicitudes/use-nombres-catalogo";
import { opcionesCatalogo } from "@/modules/autogestion/ui/solicitudes/opciones-catalogo";
import type { CambioEntity, FichaPasivoEntity } from "../../domain/entities/fe-de-vida";

function declarado(cambios: readonly CambioEntity[], campo: string): number | null {
  for (const c of cambios) {
    if (c.entidad !== "datos_vivienda") continue;
    const v =
      c.campo === campo
        ? c.valorPropuesto
        : c.campo === "*" && c.valorPropuesto && typeof c.valorPropuesto === "object"
          ? (c.valorPropuesto as Record<string, unknown>)[campo]
          : undefined;
    if (typeof v === "number") return v;
  }
  return null;
}

/**
 * Nombres de catálogo para mostrar «Libertador» en vez de «Código 5». Municipio y parroquia dependen de su
 * padre: se resuelven con el estado y el municipio declarados o, si no cambian, los vigentes de la ficha.
 */
export function useNombresRevision(
  cambios: readonly CambioEntity[],
  ficha: FichaPasivoEntity | null,
): NombresCatalogo {
  const planos = useNombresCatalogo(
    cambios.flatMap((c) => [
      { campo: c.campo, valorPropuesto: c.valorPropuesto },
      { campo: c.campo, valorPropuesto: c.valorActual },
    ]) as Array<{ campo: string; valorPropuesto: never }>,
  );
  const estadoId = declarado(cambios, "estado_id") ?? ficha?.vivienda?.estadoId ?? null;
  const municipioId = declarado(cambios, "municipio_id") ?? ficha?.vivienda?.municipioId ?? null;
  const pide = cambios.some((c) => c.entidad === "datos_vivienda");
  const { data } = useSWR(
    pide ? ["nombres-vivienda", estadoId, municipioId] : null,
    async () => {
      const cargar = async (clave: "municipios" | "parroquias", padre: number | null) => {
        if (padre === null) return {};
        try {
          const ops = await opcionesCatalogo(clave, padre);
          return Object.fromEntries(ops.map((o) => [o.id, o.nombre]));
        } catch {
          return {};
        }
      };
      return {
        municipios: await cargar("municipios", estadoId),
        parroquias: await cargar("parroquias", municipioId),
      } as NombresCatalogo;
    },
    { revalidateOnFocus: false },
  );
  return {
    ...planos,
    municipios: { ...planos.municipios, ...data?.municipios },
    parroquias: { ...planos.parroquias, ...data?.parroquias },
  };
}
