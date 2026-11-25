"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { SECCIONES_VENTANA2, type AvanceVentana2, type SeccionVentana2 } from "../../domain/ventana2";

/** Pasos de la Ventana 2, clicables. En el teléfono solo se rotula el paso actual para no apretar el texto. */
export function IndicadorAvance({ avance, actual, onIr }: { avance: AvanceVentana2; actual: SeccionVentana2; onIr: (s: SeccionVentana2) => void }) {
  const indiceActual = SECCIONES_VENTANA2.findIndex((s) => s.id === actual);
  return (
    <nav aria-label="Avance de los datos complementarios" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3 text-sm">
        <p className="font-medium">
          Paso {indiceActual + 1} de {SECCIONES_VENTANA2.length} · <span className="text-primary">{SECCIONES_VENTANA2[indiceActual].etiqueta}</span>
        </p>
        <p className="text-muted-foreground" data-testid="avance-texto">
          {avance.completas} de {avance.total} listas
        </p>
      </div>
      <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={avance.porcentaje} aria-label="Avance de tus datos" className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full bg-primary transition-[width]" style={{ width: `${avance.porcentaje}%` }} />
      </div>
      {/* Teléfono: el paso actual con sus vecinos y un selector con todos los pasos (sin apretar 11 círculos). */}
      <div className="flex items-center gap-2 sm:hidden">
        <label htmlFor="ventana2-selector-paso" className="sr-only">Ir al paso</label>
        <select
          id="ventana2-selector-paso"
          value={actual}
          onChange={(e) => onIr(e.target.value as SeccionVentana2)}
          className="h-10 w-full rounded-md border bg-background px-3 text-sm"
        >
          {SECCIONES_VENTANA2.map((s, i) => {
            const sec = avance.secciones.find((x) => x.id === s.id);
            return (
              <option key={s.id} value={s.id}>
                {i + 1}. {s.etiqueta}{sec?.completa ? " (lista)" : sec ? " (pendiente)" : ""}
              </option>
            );
          })}
        </select>
      </div>
      <ol className="hidden items-start sm:flex">
        {SECCIONES_VENTANA2.map((s, i) => {
          const sec = avance.secciones.find((x) => x.id === s.id);
          const completa = sec?.completa ?? false;
          const esActual = s.id === actual;
          const conPendientes = !!sec && !sec.completa;
          return (
            <li key={s.id} className="relative flex flex-1 flex-col items-center gap-1 text-center">
              {i > 0 && <span aria-hidden className={cn("absolute top-4 right-1/2 sm:top-5 h-0.5 w-full -translate-y-1/2", i <= indiceActual ? "bg-primary" : "bg-border")} />}
              <button
                type="button"
                onClick={() => onIr(s.id)}
                aria-current={esActual ? "step" : undefined}
                aria-label={`${s.etiqueta}${completa ? " (lista)" : conPendientes ? " (pendiente)" : ""}`}
                className={cn(
                  "relative z-10 flex size-8 items-center sm:size-10 justify-center rounded-full border-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  completa && "border-primary bg-primary text-primary-foreground",
                  esActual && !completa && "border-primary bg-background text-primary ring-4 ring-primary/15",
                  !completa && !esActual && "border-border bg-background text-muted-foreground",
                )}
              >
                {completa ? <Check className="size-4" aria-hidden /> : i + 1}
              </button>
              <span className={cn("px-0.5 text-xs leading-tight", esActual ? "block font-semibold" : "hidden text-muted-foreground md:block")}>{s.etiqueta}</span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
