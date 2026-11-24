"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { OpcionCatalogo } from "../../domain/ventana2";

/** Selección múltiple con chips tocables (`aria-pressed`). Vacío = ninguna. */
export function ChipsMultiples({
  etiqueta,
  ayuda,
  opciones,
  value,
  onChange,
}: {
  etiqueta: string;
  ayuda?: string;
  opciones: readonly OpcionCatalogo[];
  value: number[];
  onChange: (ids: number[]) => void;
}) {
  const alternar = (id: number) => onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  return (
    <fieldset className="flex flex-col gap-2 sm:col-span-2">
      <legend className="text-sm font-medium">{etiqueta}</legend>
      {ayuda && <p className="text-sm text-muted-foreground">{ayuda}</p>}
      <div className="mt-1 flex flex-wrap gap-2">
        {opciones.map((o) => {
          const activo = value.includes(o.id);
          return (
            <button
              key={o.id}
              type="button"
              aria-pressed={activo}
              onClick={() => alternar(o.id)}
              className={cn(
                "inline-flex min-h-11 items-center gap-1.5 rounded-full border px-4 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                activo ? "border-primary bg-primary/10 font-semibold text-primary" : "bg-background hover:bg-accent",
              )}
            >
              {activo && <Check className="size-4" aria-hidden />}
              {o.nombre}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">{value.length === 0 ? "Ninguna seleccionada." : `${value.length} seleccionada${value.length === 1 ? "" : "s"}.`}</p>
    </fieldset>
  );
}
