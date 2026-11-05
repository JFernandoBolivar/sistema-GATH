"use client";

/**
 * O19: disposición común de los filtros de reportes. Los grupos se reparten en
 * columnas tipo masonry (1 móvil / 2 tablet / 3 escritorio) y cada uno se puede
 * plegar, mostrando cuántos filtros tiene activos.
 */
import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { useFormContext } from "react-hook-form";

import { cn } from "@/lib/utils";

/** Contenedor de todos los grupos de filtros de un reporte. */
export function PanelFiltrosReporte({ children }: { children: ReactNode }) {
  return (
    <div className="columns-1 gap-3 md:columns-2 xl:columns-3 [&>*]:break-inside-avoid">
      {children}
    </div>
  );
}

/** Grupo plegable de filtros con el número de campos que tienen valor. */
export function GrupoFiltrosReporte({
  titulo,
  campos = [],
  children,
  className,
}: {
  titulo: string;
  /** Nombres completos de los campos del grupo (p. ej. `filtros.cargo_id`). */
  campos?: string[];
  children: ReactNode;
  className?: string;
}) {
  const { watch } = useFormContext();
  const valores = campos.length > 0 ? watch(campos) : [];
  const activos = Array.isArray(valores)
    ? valores.filter((valor) => valor !== "" && valor !== null && valor !== undefined).length
    : 0;

  return (
    <details
      open
      className={cn(
        "group mb-3 rounded-lg border bg-card p-3 last:mb-0",
        "border-border/70 open:shadow-xs",
        className,
      )}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-foreground">
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate">{titulo}</span>
          {activos > 0 ? (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
              {activos}
            </span>
          ) : null}
        </span>
        <ChevronDown
          aria-hidden
          className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
        />
      </summary>
      <div className="mt-3 grid gap-3">{children}</div>
    </details>
  );
}
