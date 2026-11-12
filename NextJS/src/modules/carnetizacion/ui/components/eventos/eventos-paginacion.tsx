"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/shared/ui/components/button";

interface Props {
  pagina: number;
  totalPaginas: number;
  total: number;
  tamano: number;
  onPagina: (pagina: number) => void;
}

export function EventosPaginacion({ pagina, totalPaginas, total, tamano, onPagina }: Props) {
  const desde = total === 0 ? 0 : (pagina - 1) * tamano + 1;
  const hasta = Math.min(pagina * tamano, total);
  return (
    <nav aria-label="Paginación de eventos" className="flex flex-wrap items-center justify-between gap-3">
      <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
        Mostrando {desde} a {hasta} de {total}
      </p>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" className="h-10 gap-1" disabled={pagina <= 1} onClick={() => onPagina(pagina - 1)}>
          <ChevronLeft className="size-4" aria-hidden />
          Anterior
        </Button>
        <span className="text-sm tabular-nums text-muted-foreground">
          Página {pagina} de {totalPaginas}
        </span>
        <Button variant="outline" size="sm" className="h-10 gap-1" disabled={pagina >= totalPaginas} onClick={() => onPagina(pagina + 1)}>
          Siguiente
          <ChevronRight className="size-4" aria-hidden />
        </Button>
      </div>
    </nav>
  );
}
