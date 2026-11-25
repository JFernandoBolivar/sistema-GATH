"use client";

import { Lock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { construirBarraAcciones, type ItemBarraAcciones } from "../../domain/barra-acciones";
import type { AccionExpediente } from "../../domain/expediente";

interface BarraAccionesProps {
  acciones: readonly AccionExpediente[];
  ocupado?: boolean;
  onElegir: (item: ItemBarraAcciones) => void;
  /** Oculta bajo cada botón la causa del bloqueo en teléfono (la vista ya la explica en un aviso). */
  ocultarBloqueoEnMovil?: boolean;
}

/**
 * Orden y énfasis (M4): la acción principal (la sugerida o, si no hay, la primera disponible) va con el color
 * primario; el resto, secundarias; los rechazos van al final y separados. En teléfono la barra queda fija abajo.
 */
function jerarquizar(items: ItemBarraAcciones[]) {
  const esPeligro = (i: ItemBarraAcciones) => i.variante === "peligro";
  let principal = items.findIndex((i) => i.destacada && !esPeligro(i) && !i.deshabilitada);
  if (principal < 0) principal = items.findIndex((i) => i.variante === "primaria" && !i.deshabilitada);
  const nuevos = items.map((item, idx) => ({
    item,
    nivel: esPeligro(item) ? ("peligro" as const) : idx === principal ? ("principal" as const) : ("secundaria" as const),
  }));
  const peso = { principal: 0, secundaria: 1, peligro: 2 };
  return nuevos.sort((a, b) => peso[a.nivel] - peso[b.nivel]);
}

/** Barra de acciones generada SOLO desde `acciones[]` del backend (sin reglas de la máquina de estados). */
export function BarraAcciones({ acciones, ocupado = false, onElegir, ocultarBloqueoEnMovil = false }: BarraAccionesProps) {
  const items = jerarquizar(construirBarraAcciones(acciones));
  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground" data-testid="sin-acciones">
        No hay acciones disponibles para este expediente con su perfil.
      </p>
    );
  }
  return (
    <ul
      aria-label="Acciones del expediente"
      data-testid="barra-acciones"
      className={cn(
        "flex flex-wrap items-start gap-3",
        // Teléfono: barra fija abajo; principal a ancho completo y el resto en fila.
        "max-sm:fixed max-sm:inset-x-0 max-sm:bottom-0 max-sm:z-40 max-sm:gap-2 max-sm:border-t max-sm:bg-background max-sm:p-3 max-sm:shadow-[0_-4px_12px_rgba(0,0,0,0.12)] max-sm:pb-[max(0.75rem,env(safe-area-inset-bottom))]",
      )}
    >
      {items.map(({ item, nivel }) => (
        <li
          key={item.destino}
          className={cn(
            "flex min-w-0 max-w-full flex-col gap-1",
            nivel === "principal" ? "max-sm:basis-full" : "max-sm:flex-1",
            nivel === "peligro" && "sm:ml-auto sm:border-l sm:pl-3",
          )}
        >
          <Button
            type="button"
            variant={nivel === "principal" ? "default" : nivel === "peligro" ? "destructive" : "outline"}
            disabled={item.deshabilitada || ocupado}
            aria-describedby={item.deshabilitada ? `bloqueo-${item.destino}` : undefined}
            title={item.deshabilitada ? item.motivoBloqueo : undefined}
            data-destacada={item.destacada ? "true" : undefined}
            onClick={() => onElegir(item)}
            className={cn("h-auto min-h-10 w-full whitespace-normal text-center sm:w-auto", item.destacada && "ring-2 ring-warning ring-offset-2")}
          >
            {item.deshabilitada ? <Lock aria-hidden /> : item.destacada ? <Sparkles aria-hidden /> : null}
            {item.etiqueta}
          </Button>
          {item.destacada ? <span className="text-xs font-medium text-warning max-sm:hidden">Acción sugerida</span> : null}
          {item.deshabilitada ? (
            <span id={`bloqueo-${item.destino}`} className={cn("max-w-xs text-xs text-muted-foreground", ocultarBloqueoEnMovil && "max-sm:sr-only")}>
              {item.motivoBloqueo}
            </span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
