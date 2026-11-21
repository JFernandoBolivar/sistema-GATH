/**
 * Barra vertical de íconos de navegación de paneles izquierdos (escritorio ≥ 1024 px).
 * Muestra tres botones: Agregar · Fondo · Capas.
 * Cada botón tiene texto corto, ícono, aria-label y aria-pressed.
 */
"use client";

import { Image as ImageIcon, Layers, PlusSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export type PanelIzquierdo = "agregar" | "fondo" | "capas";

interface DisenadorPanelNavIzquierdoProps {
  panelActivo: PanelIzquierdo;
  onCambiarPanel: (panel: PanelIzquierdo) => void;
}

const PANELES: { id: PanelIzquierdo; label: string; aria: string; Icono: React.ElementType }[] = [
  {
    id: "agregar",
    label: "Agregar",
    aria: "Panel de herramientas para agregar elementos",
    Icono: PlusSquare,
  },
  {
    id: "fondo",
    label: "Fondo",
    aria: "Panel de fondo del carnet",
    Icono: ImageIcon,
  },
  {
    id: "capas",
    label: "Capas",
    aria: "Panel de capas del carnet",
    Icono: Layers,
  },
];

export function DisenadorPanelNavIzquierdo({
  panelActivo,
  onCambiarPanel,
}: DisenadorPanelNavIzquierdoProps) {
  return (
    <TooltipProvider delayDuration={300}>
      <nav
        className="flex flex-col items-center gap-1 py-2 px-1 h-full border-r bg-muted/30"
        aria-label="Navegación de paneles del diseñador"
      >
        {PANELES.map(({ id, label, aria, Icono }) => {
          const activo = panelActivo === id;
          return (
            <Tooltip key={id}>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant={activo ? "secondary" : "ghost"}
                  size="sm"
                  className={cn(
                    "flex flex-col items-center gap-0.5 h-14 w-14 py-1 px-0 text-[10px] font-medium rounded-md",
                    activo && "bg-primary/10 text-primary hover:bg-primary/15",
                  )}
                  aria-label={aria}
                  aria-pressed={activo}
                  onClick={() => onCambiarPanel(id)}
                >
                  <Icono className="size-5" aria-hidden />
                  <span>{label}</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p>{aria}</p>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </nav>
    </TooltipProvider>
  );
}
