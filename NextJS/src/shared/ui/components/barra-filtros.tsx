"use client";

import React from "react";
import { Filter, RotateCcw, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/shared/ui/components/badge";
import { Button } from "@/shared/ui/components/button";
import { Card, CardContent } from "@/shared/ui/components/card";
import { Input } from "@/shared/ui/components/input";
import { FiltrosColapsables } from "@/shared/ui/components/filtros-movil-colapsable";

export interface FiltroActivoChip {
  id: string;
  label: string;
  valorLegible: string;
  onRemover: () => void;
}

export interface BarraFiltrosProps {
  /** Valor del campo de búsqueda rápida (opcional) */
  busqueda?: string;
  /** Callback al cambiar el texto de búsqueda */
  onBusquedaChange?: (valor: string) => void;
  /** Texto placeholder de la búsqueda */
  placeholderBusqueda?: string;

  /** Total de registros/resultados tras aplicar los filtros */
  totalResultados?: number;
  /** Etiqueta descriptiva del conteo (p. ej. "reportes", "resultados") */
  etiquetaResultados?: string;

  /** Indica si hay al menos un filtro o búsqueda activa */
  hayFiltrosActivos?: boolean;
  /** Callback para restablecer todos los filtros a su estado inicial */
  onLimpiarFiltros?: () => void;

  /** Lista de chips de filtros activos para mostrar y permitir deseleccionar individualmente */
  chipsActivos?: FiltroActivoChip[];

  /** Campos de filtro (selects, fechas, toggles) estructurados */
  children?: React.ReactNode;

  /** Acciones adicionales en la fila superior (p. ej. botón actualizar o exportar) */
  accionesSuperiores?: React.ReactNode;

  /** Título del bloque de filtros en vista móvil colapsable */
  tituloFiltrosMovil?: string;

  /** Clases CSS adicionales para el contenedor principal */
  className?: string;
}

/**
 * Componente compartido BarraFiltros (FIX-DIS1).
 *
 * Provee un diseño unificado y profesional para bandejas de consulta:
 *  - Fila superior: Búsqueda rápida con icono + Contador de resultados + Botón «Limpiar filtros»
 *  - Fila de filtros: Grilla responsive (1 col teléfono, 2 tablet, 4 PC) con altura estandarizada (h-10)
 *  - Chips removibles: Indicador visual de los filtros actualmente aplicados bajo la barra
 *  - Soporte móvil: Integrado con FiltrosColapsables para optimizar espacio en pantallas táctiles
 */
export function BarraFiltros({
  busqueda,
  onBusquedaChange,
  placeholderBusqueda = "Buscar por cédula, nombre o descripción…",
  totalResultados,
  etiquetaResultados = "resultados",
  hayFiltrosActivos = false,
  onLimpiarFiltros,
  chipsActivos = [],
  children,
  accionesSuperiores,
  tituloFiltrosMovil = "Filtros de consulta",
  className,
}: BarraFiltrosProps) {
  const tieneBusqueda = onBusquedaChange !== undefined;
  const conteoChips = chipsActivos.length;

  return (
    <div className={cn("space-y-3", className)}>
      <Card className="border-border/60 shadow-sm bg-card">
        <CardContent className="p-4 space-y-4">
          {/* Fila superior: Búsqueda ancha + Contador + Limpiar filtros + Acciones */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            {tieneBusqueda ? (
              <div className="relative flex-1 min-w-0">
                <Search
                  className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
                  aria-hidden="true"
                />
                <Input
                  type="search"
                  value={busqueda ?? ""}
                  onChange={(e) => onBusquedaChange(e.target.value)}
                  placeholder={placeholderBusqueda}
                  className="pl-9 pr-8 h-10 w-full text-sm bg-background border-input"
                  aria-label={placeholderBusqueda}
                />
                {busqueda && busqueda.length > 0 && (
                  <button
                    type="button"
                    onClick={() => onBusquedaChange("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 rounded-sm focus:outline-none focus:ring-1 focus:ring-ring"
                    aria-label="Borrar texto de búsqueda"
                  >
                    <X className="size-3.5" aria-hidden="true" />
                  </button>
                )}
              </div>
            ) : null}

            {/* Acciones y Conteo en fila superior */}
            <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
              {totalResultados !== undefined && (
                <Badge
                  variant="outline"
                  className="h-8 px-2.5 text-xs font-medium text-muted-foreground bg-muted/30 border-border/60 whitespace-nowrap"
                >
                  <span className="font-semibold text-foreground mr-1">
                    {totalResultados}
                  </span>{" "}
                  {etiquetaResultados}
                </Badge>
              )}

              {hayFiltrosActivos && onLimpiarFiltros && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={onLimpiarFiltros}
                  className="h-8 px-2.5 text-xs font-medium text-muted-foreground hover:text-destructive gap-1.5 transition-colors cursor-pointer"
                  title="Restablecer todos los filtros a sus valores iniciales"
                  aria-label="Limpiar todos los filtros"
                >
                  <RotateCcw className="size-3.5" aria-hidden="true" />
                  <span>Limpiar filtros</span>
                </Button>
              )}

              {accionesSuperiores}
            </div>
          </div>

          {/* Fila de controles de filtros: Colapsable en móvil (<640px) y grilla directa en escritorio */}
          {children ? (
            <div>
              {/* Vista Móvil (< 640px): colapsable mediante FiltrosColapsables */}
              <div className="block sm:hidden">
                <FiltrosColapsables
                  conteoActivos={conteoChips}
                  titulo={tituloFiltrosMovil}
                  className="border-0 shadow-none bg-transparent p-0"
                >
                  <div className="grid grid-cols-1 gap-3 pt-3">
                    {children}
                  </div>
                </FiltrosColapsables>
              </div>

              {/* Vista Escritorio / Tablet (>= 640px): grilla fija y legible */}
              <div className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-1">
                {children}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Fila inferior: Chips de filtros activos removibles */}
      {chipsActivos.length > 0 && (
        <div
          className="flex flex-wrap items-center gap-1.5 px-1 py-0.5 text-xs"
          role="region"
          aria-label="Filtros aplicados actualmente"
        >
          <span className="text-muted-foreground font-medium flex items-center gap-1 mr-1">
            <Filter className="size-3 text-primary" aria-hidden="true" />
            Filtros aplicados:
          </span>
          {chipsActivos.map((chip) => (
            <Badge
              key={chip.id}
              variant="secondary"
              className="inline-flex items-center gap-1.5 py-1 px-2.5 text-xs font-normal bg-secondary/80 hover:bg-secondary text-secondary-foreground border border-border/40 shadow-2xs transition-colors"
            >
              <span className="font-semibold text-foreground/80">{chip.label}:</span>
              <span>{chip.valorLegible}</span>
              <button
                type="button"
                onClick={chip.onRemover}
                className="ml-0.5 rounded-full p-0.5 hover:bg-background/80 hover:text-destructive focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer transition-colors"
                aria-label={`Quitar filtro ${chip.label}: ${chip.valorLegible}`}
                title={`Quitar filtro ${chip.label}`}
              >
                <X className="size-3" aria-hidden="true" />
              </button>
            </Badge>
          ))}
          {hayFiltrosActivos && onLimpiarFiltros && (
            <button
              type="button"
              onClick={onLimpiarFiltros}
              className="text-xs text-muted-foreground hover:text-destructive underline decoration-dotted underline-offset-2 ml-1 cursor-pointer focus:outline-none"
            >
              Borrar todos
            </button>
          )}
        </div>
      )}
    </div>
  );
}
