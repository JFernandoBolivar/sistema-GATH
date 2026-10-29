"use client";

import useSWR from "swr";
import { Button } from "@/components/ui/button";
import type { ClaveCatalogo } from "../../domain/value-objects/campos-seccion";
import { opcionesCatalogo } from "./opciones-catalogo";
import { cn } from "@/lib/utils";
import type { UseFormRegisterReturn } from "react-hook-form";

interface Props {
  id: string;
  etiqueta: string;
  catalogo: ClaveCatalogo;
  /** Valor del campo del que depende (cascada); sin él, las listas dependientes se deshabilitan. */
  padreId?: number | null;
  dependeDePadre?: boolean;
  requerido?: boolean;
  error?: string;
  registro: UseFormRegisterReturn;
}

export const CLASE_CONTROL =
  "min-h-11 w-full rounded-md border border-input bg-card px-3 py-2 text-base text-foreground disabled:cursor-not-allowed disabled:opacity-60";

/** Lista desplegable nativa (accesible y cómoda en móvil) alimentada por un catálogo del servidor. */
export function SelectorCatalogo({
  id,
  etiqueta,
  catalogo,
  padreId,
  dependeDePadre = false,
  requerido,
  error,
  registro,
}: Props) {
  const esperaPadre = dependeDePadre && !padreId;
  const {
    data,
    error: fallo,
    isLoading,
    mutate,
  } = useSWR(
    esperaPadre ? null : ["catalogo-autogestion", catalogo, padreId ?? 0],
    () => opcionesCatalogo(catalogo, padreId ?? undefined),
    { revalidateOnFocus: false },
  );

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-base font-medium">
        {etiqueta}
        {requerido ? <span aria-hidden> *</span> : null}
      </label>
      <select
        id={id}
        className={cn(CLASE_CONTROL, error && "border-danger")}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        disabled={esperaPadre || isLoading || Boolean(fallo)}
        {...registro}
      >
        <option value="">
          {esperaPadre
            ? "Elija primero la opción anterior"
            : isLoading
              ? "Cargando opciones…"
              : "Seleccione…"}
        </option>
        {(data ?? []).map((o) => (
          <option key={o.id} value={String(o.id)}>
            {o.nombre}
          </option>
        ))}
      </select>
      {fallo ? (
        <div role="alert" className="flex flex-wrap items-center gap-2 text-sm text-danger">
          <span>
            No se pudieron cargar las opciones. Si el problema continúa, comuníquese con Bienestar
            Social.
          </span>
          <Button type="button" size="sm" variant="outline" onClick={() => mutate()}>
            Reintentar
          </Button>
        </div>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="text-sm font-medium text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
