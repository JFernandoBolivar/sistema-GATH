import { Button } from "@/components/ui/button";

interface Props {
  pagina: number;
  totalPaginas: number;
  total: number;
  cargando?: boolean;
  onPagina: (pagina: number) => void;
}

/** Anterior / Siguiente con el total; se oculta si no hay filas. */
export function Paginador({ pagina, totalPaginas, total, cargando = false, onPagina }: Props) {
  if (total === 0) return null;
  return (
    <nav aria-label="Paginación" className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
      <span className="text-sm text-muted-foreground">{total} en total</span>
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => onPagina(pagina - 1)} disabled={pagina <= 1 || cargando}>
          Anterior
        </Button>
        <span className="text-sm text-muted-foreground" role="status" aria-live="polite">
          Página {pagina} de {totalPaginas}
        </span>
        <Button type="button" variant="outline" size="sm" onClick={() => onPagina(pagina + 1)} disabled={pagina >= totalPaginas || cargando}>
          Siguiente
        </Button>
      </div>
    </nav>
  );
}
