"use client";

import React, { useState } from "react";
import { ChevronDown, Filter } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/shared/ui/components/badge";
import { Button } from "@/shared/ui/components/button";
import { Card, CardContent } from "@/shared/ui/components/card";

interface FiltrosColapsablesProps {
  children: React.ReactNode;
  conteoActivos?: number;
  titulo?: string;
  className?: string;
  inicialmenteAbierto?: boolean;
}

/**
 * Patrón común y accesible para bloques de filtros en móvil (TLF-D).
 * - En móvil (< 640px): se presenta como una barra compacta con el título,
 *   un contador de filtros activos y un botón para desplegar u ocultar los campos.
 *   Si hay filtros activos, se abre por defecto para no ocultar el contexto.
 * - En pantallas medianas y grandes (>= 640px): los filtros siempre están visibles.
 */
export function FiltrosColapsables({
  children,
  conteoActivos = 0,
  titulo = "Filtros de búsqueda",
  className,
  inicialmenteAbierto,
}: FiltrosColapsablesProps) {
  const [abierto, setAbierto] = useState<boolean>(() => {
    if (inicialmenteAbierto !== undefined) return inicialmenteAbierto;
    return conteoActivos > 0;
  });

  return (
    <Card className={cn("bg-card border-border/60 shadow-sm", className)}>
      {/* Cabecera solo móvil (< 640px) */}
      <div className="flex sm:hidden items-center justify-between p-3 border-b border-border/40">
        <div className="flex items-center gap-2 min-w-0">
          <Filter className="size-4 text-primary shrink-0" aria-hidden />
          <span className="font-semibold text-sm truncate">{titulo}</span>
          {conteoActivos > 0 && (
            <Badge
              variant="secondary"
              className="px-1.5 py-0 text-xs font-semibold bg-primary/10 text-primary border-primary/20 shrink-0"
            >
              {conteoActivos} activo{conteoActivos > 1 ? "s" : ""}
            </Badge>
          )}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 px-2 text-xs font-medium cursor-pointer"
          onClick={() => setAbierto((prev) => !prev)}
          aria-expanded={abierto}
          aria-label={abierto ? "Ocultar filtros" : "Mostrar filtros"}
        >
          {abierto ? "Ocultar" : "Mostrar"}
          <ChevronDown
            className={cn("size-3.5 ml-1 transition-transform duration-200", abierto && "rotate-180")}
            aria-hidden
          />
        </Button>
      </div>

      {/* Contenido: colapsable en móvil, siempre visible en desktop */}
      <CardContent
        className={cn(
          "p-3 sm:p-4",
          !abierto && "hidden sm:block",
        )}
      >
        {children}
      </CardContent>
    </Card>
  );
}

/**
 * Agrupador en pares para rangos de fechas (desde / hasta).
 * En móvil se distribuyen 2 columnas compactas en una sola fila.
 */
export function FiltroFechasPar({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("grid grid-cols-2 gap-2 sm:col-span-2 min-w-0", className)}>
      {children}
    </div>
  );
}
