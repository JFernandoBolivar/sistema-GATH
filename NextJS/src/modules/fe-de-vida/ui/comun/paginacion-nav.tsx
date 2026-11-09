"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  etiqueta: string;
  total: number;
  offset: number;
  limite: number;
  onOffset: (offset: number) => void;
  /** Tamaños de página permitidos (10/50). */
  tamanos?: readonly number[];
  onLimite?: (limite: number) => void;
}

/** Paginación con «Mostrando X a Y de Z», anterior/siguiente y selector de tamaño (aria-live). */
export function PaginacionNav({ etiqueta, total, offset, limite, onOffset, tamanos, onLimite }: Props) {
  const desde = total === 0 ? 0 : offset + 1;
  const hasta = Math.min(offset + limite, total);
  return (
    <nav aria-label={etiqueta} className="flex flex-wrap items-center justify-between gap-3">
      <p role="status" aria-live="polite" className="text-base text-muted-foreground">
        Mostrando {desde} a {hasta} de {total}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {tamanos && onLimite ? (
          <label className="flex items-center gap-2 text-base">
            Filas
            <select
              className="min-h-11 rounded-md border border-input bg-card px-2 text-base"
              value={limite}
              onChange={(e) => onLimite(Number(e.target.value))}
            >
              {tamanos.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          disabled={offset === 0}
          onClick={() => onOffset(Math.max(0, offset - limite))}
        >
          <ChevronLeft aria-hidden /> Anterior
        </Button>
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          disabled={offset + limite >= total}
          onClick={() => onOffset(offset + limite)}
        >
          Siguiente <ChevronRight aria-hidden />
        </Button>
      </div>
    </nav>
  );
}
