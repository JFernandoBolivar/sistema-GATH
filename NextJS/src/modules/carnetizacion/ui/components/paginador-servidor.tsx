"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TAMANOS_PAGINA } from "../../domain/entities/carnet";

interface PaginadorServidorProps {
  /** Identificador único del selector de filas (varios paginadores pueden convivir en la pantalla). */
  id: string;
  pagina: number;
  totalPaginas: number;
  tamano: number;
  total: number;
  cargando?: boolean;
  onPagina: (pagina: number) => void;
  onTamano: (tamano: number) => void;
}

/** Controles de página del servidor: mismos que el listado de Usuarios (Filas 12/24/48, Anterior/Siguiente). */
export function PaginadorServidor({
  id,
  pagina,
  totalPaginas,
  tamano,
  total,
  cargando = false,
  onPagina,
  onTamano,
}: PaginadorServidorProps) {
  if (total === 0) return null;
  return (
    <nav
      aria-label="Paginación"
      className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4"
    >
      <div className="flex items-center gap-2">
        <Label htmlFor={id} className="text-sm">
          Filas
        </Label>
        <Select value={String(tamano)} onValueChange={(v) => onTamano(Number(v))}>
          <SelectTrigger id={id} className="w-24">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TAMANOS_PAGINA.map((t) => (
              <SelectItem key={t} value={String(t)}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">{total} en total</span>
      </div>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onPagina(pagina - 1)}
          disabled={pagina <= 1 || cargando}
        >
          Anterior
        </Button>
        <span className="text-sm text-muted-foreground" role="status" aria-live="polite">
          Página {pagina} de {totalPaginas}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onPagina(pagina + 1)}
          disabled={pagina >= totalPaginas || cargando}
        >
          Siguiente
        </Button>
      </div>
    </nav>
  );
}
