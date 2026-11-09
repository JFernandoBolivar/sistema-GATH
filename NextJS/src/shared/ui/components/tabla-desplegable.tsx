"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

/**
 * Contenedor con las barras de ScrollArea de shadcn para tablas, listas y
 * paneles largos. Evita el scroll nativo visible y conserva el foco/teclado.
 */
export function TablaDesplegable({
  children,
  className,
  etiqueta = "Contenido desplazable",
  horizontal = true,
}: {
  children: ReactNode;
  className?: string;
  etiqueta?: string;
  horizontal?: boolean;
}) {
  return (
    <div
      role="region"
      aria-label={etiqueta}
      tabIndex={0}
      className={cn("relative w-full max-w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", className)}
    >
      <ScrollArea className="h-full w-full">
        {children}
        {horizontal ? <ScrollBar orientation="horizontal" /> : null}
      </ScrollArea>
    </div>
  );
}
