import type { ReactNode } from "react";
import { Check, Circle, CircleDot, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type EstadoHito = "hecho" | "actual" | "pendiente" | "fallido";

export interface HitoLineaTiempo {
  id: string;
  titulo: string;
  /** Fecha ya formateada para mostrar. */
  fecha?: string | null;
  /** Actor o nota breve ("Por Bienestar Social"). */
  detalle?: ReactNode;
  estado: EstadoHito;
}

const ICONO: Record<EstadoHito, typeof Check> = {
  hecho: Check,
  actual: CircleDot,
  pendiente: Circle,
  fallido: X,
};

const CLASE_ICONO: Record<EstadoHito, string> = {
  hecho: "border-success bg-success text-white dark:text-background",
  actual: "border-primary bg-card text-primary",
  pendiente: "border-control bg-card text-muted-foreground",
  fallido: "border-danger bg-danger text-white dark:text-background",
};

const TEXTO_ESTADO: Record<EstadoHito, string> = {
  hecho: "Completado",
  actual: "Paso actual",
  pendiente: "Pendiente",
  fallido: "No aprobado",
};

/** Línea de tiempo vertical (`<ol>`): cada hito lleva ícono, texto y fecha; `aria-current="step"` en el vigente. */
export function LineaTiempo({
  hitos,
  etiqueta,
  className,
}: {
  hitos: HitoLineaTiempo[];
  etiqueta: string;
  className?: string;
}) {
  return (
    <ol aria-label={etiqueta} className={cn("flex flex-col", className)}>
      {hitos.map((hito, i) => {
        const Icono = ICONO[hito.estado];
        const ultimo = i === hitos.length - 1;
        return (
          <li
            key={hito.id}
            aria-current={hito.estado === "actual" ? "step" : undefined}
            className="relative flex gap-3 pb-5 last:pb-0"
          >
            {!ultimo ? (
              <span
                aria-hidden
                className={cn(
                  "absolute left-[0.9rem] top-8 h-[calc(100%-1.5rem)] w-0.5",
                  hito.estado === "hecho" ? "bg-success" : "bg-border",
                )}
              />
            ) : null}
            <span
              className={cn(
                "z-10 flex size-8 shrink-0 items-center justify-center rounded-full border-2",
                CLASE_ICONO[hito.estado],
              )}
            >
              <Icono className="size-4" aria-hidden />
            </span>
            <div className="min-w-0 pt-0.5">
              <p className="text-base font-semibold leading-snug">
                {hito.titulo}
                <span className="sr-only"> ({TEXTO_ESTADO[hito.estado]})</span>
              </p>
              {hito.fecha ? <p className="text-sm text-muted-foreground">{hito.fecha}</p> : null}
              {hito.detalle ? (
                <div className="mt-0.5 text-sm text-muted-foreground">{hito.detalle}</div>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
