"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, X } from "lucide-react";

import { Button } from "@/components/ui/button";

interface Props {
  titulo: string;
  onCerrar?: () => void;
  children: React.ReactNode;
}

/**
 * Panel de propiedades FIJO en la parte inferior (teléfono y pantallas medianas): de altura
 * limitada, se puede colapsar y NUNCA es modal: el lienzo o la lista siguen operables encima.
 * Reserva su altura en el flujo para no tapar el final del contenido.
 */
export function PanelInferior({ titulo, onCerrar, children }: Props) {
  const [colapsado, setColapsado] = useState(false);
  return (
    <>
      <div aria-hidden style={{ height: colapsado ? "3.5rem" : "46dvh" }} />
      <section
        role="region"
        aria-label={titulo}
        data-testid="panel-inferior"
        className="fixed inset-x-0 bottom-0 z-40 border-t bg-background shadow-[0_-6px_16px_rgba(0,0,0,0.12)]"
      >
        <div className="flex items-center justify-between gap-2 px-3 py-1.5">
          <h2 className="truncate text-sm font-semibold">{titulo}</h2>
          <div className="flex items-center">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => setColapsado((c) => !c)}
              aria-expanded={!colapsado}
              aria-label={colapsado ? "Expandir propiedades" : "Colapsar propiedades"}
            >
              {colapsado ? <ChevronUp aria-hidden /> : <ChevronDown aria-hidden />}
            </Button>
            {onCerrar && (
              <Button type="button" variant="ghost" size="icon-sm" onClick={onCerrar} aria-label="Cerrar propiedades">
                <X aria-hidden />
              </Button>
            )}
          </div>
        </div>
        {!colapsado && <div className="max-h-[40dvh] overflow-y-auto overscroll-contain px-3 pb-4">{children}</div>}
      </section>
    </>
  );
}
