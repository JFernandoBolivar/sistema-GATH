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
}

const VARIANTE_BOTON = {
  primaria: "default",
  secundaria: "outline",
  peligro: "destructive",
} as const;

/** Barra de acciones generada SOLO desde `acciones[]` del backend (sin reglas de la máquina de estados). */
export function BarraAcciones({ acciones, ocupado = false, onElegir }: BarraAccionesProps) {
  const items = construirBarraAcciones(acciones);
  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground" data-testid="sin-acciones">
        No hay acciones disponibles para este expediente con su perfil.
      </p>
    );
  }
  return (
    <ul aria-label="Acciones del expediente" className="flex flex-wrap gap-3">
      {items.map((item) => (
        <li key={item.destino} className="flex min-w-0 max-w-full flex-col gap-1">
          <Button
            type="button"
            variant={VARIANTE_BOTON[item.variante]}
            disabled={item.deshabilitada || ocupado}
            aria-describedby={item.deshabilitada ? `bloqueo-${item.destino}` : undefined}
            title={item.deshabilitada ? item.motivoBloqueo : undefined}
            data-destacada={item.destacada ? "true" : undefined}
            onClick={() => onElegir(item)}
            className={cn("w-full sm:w-auto", item.destacada && "ring-2 ring-warning ring-offset-2")}
          >
            {item.deshabilitada ? <Lock aria-hidden /> : item.destacada ? <Sparkles aria-hidden /> : null}
            {item.etiqueta}
          </Button>
          {item.destacada ? (
            <span className="text-xs font-medium text-warning">Acción sugerida</span>
          ) : null}
          {item.deshabilitada ? (
            <span id={`bloqueo-${item.destino}`} className="max-w-xs text-xs text-muted-foreground">
              {item.motivoBloqueo}
            </span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
