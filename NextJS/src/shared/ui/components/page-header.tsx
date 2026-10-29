import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  titulo: string;
  descripcion?: string;
  /** Acción primaria de la pantalla (una sola, según la regla de usuarios mayores). */
  accion?: ReactNode;
  /** Migas o enlace "Volver" que se muestra sobre el título. */
  migas?: ReactNode;
  className?: string;
}

/** Cabecera de pantalla: un único `<h1>`, descripción corta y la acción principal. */
export function PageHeader({ titulo, descripcion, accion, migas, className }: PageHeaderProps) {
  return (
    <header className={cn("flex flex-col gap-3", className)}>
      {migas ? <div className="text-sm text-muted-foreground">{migas}</div> : null}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-[1.75rem]">
            {titulo}
          </h1>
          {descripcion ? (
            <p className="mt-1 max-w-[70ch] text-base text-muted-foreground">{descripcion}</p>
          ) : null}
        </div>
        {accion ? <div className="shrink-0">{accion}</div> : null}
      </div>
    </header>
  );
}
