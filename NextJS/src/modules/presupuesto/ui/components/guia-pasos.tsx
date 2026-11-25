import { Check, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EstadoPaso } from "../../domain/solicitud";

/** Paso de la guía (el de Presupuesto, el del ingreso corto de Captación…). */
export interface PasoVisible {
  id: string;
  numero: number;
  titulo: string;
  estado: EstadoPaso;
  descripcion: string;
}

const TEXTO: Record<EstadoPaso, string> = { hecho: "Hecho", pendiente: "Pendiente", bloqueado: "En espera" };

const CLASE_CIRCULO: Record<EstadoPaso, string> = {
  hecho: "border-success bg-success text-white dark:text-background",
  pendiente: "border-primary bg-card text-primary",
  bloqueado: "border-control bg-muted text-muted-foreground",
};

const CLASE_TARJETA: Record<EstadoPaso, string> = {
  hecho: "border-success/40 bg-success-soft/50",
  pendiente: "border-primary/50 bg-card",
  bloqueado: "bg-muted/40",
};

/** Guía de tres pasos: cada uno dice con texto (no solo color) si está hecho, pendiente o en espera. */
export function GuiaPasos({ pasos, etiqueta = "Pasos de Presupuesto" }: { pasos: readonly PasoVisible[]; etiqueta?: string }) {
  return (
    <ol aria-label={etiqueta} className={cn("grid gap-3", pasos.length === 2 ? "md:grid-cols-2" : "md:grid-cols-3")}>
      {pasos.map((p) => (
        <li
          key={p.id}
          data-testid={`paso-${p.id}`}
          data-estado={p.estado}
          className={cn("flex items-start gap-3 rounded-xl border p-4", CLASE_TARJETA[p.estado])}
        >
          <span
            aria-hidden
            className={cn("flex size-9 shrink-0 items-center justify-center rounded-full border-2 text-base font-bold", CLASE_CIRCULO[p.estado])}
          >
            {p.estado === "hecho" ? <Check className="size-5" /> : p.estado === "bloqueado" ? <Lock className="size-4" /> : p.numero}
          </span>
          <div className="min-w-0">
            <p className="font-semibold leading-tight">
              {p.numero}. {p.titulo}
            </p>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{TEXTO[p.estado]}</p>
            <p className="mt-1 break-words text-sm text-muted-foreground">{p.descripcion}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
