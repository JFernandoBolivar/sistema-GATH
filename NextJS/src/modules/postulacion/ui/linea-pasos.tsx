import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { PASOS_POSTULACION } from "../domain/expediente";

/** Línea de pasos del proceso. En el teléfono solo se rotula el paso actual para no apretar el texto. */
export function LineaPasos({ pasoActual }: { pasoActual: number }) {
  return (
    <nav aria-label="Avance de tu postulación">
      <ol className="flex items-start">
        {PASOS_POSTULACION.map((nombre, i) => {
          const hecho = i < pasoActual;
          const actual = i === pasoActual;
          return (
            <li
              key={nombre}
              aria-current={actual ? "step" : undefined}
              className={cn("relative flex flex-1 flex-col items-center gap-1.5 text-center", i === 0 && "items-start text-left sm:items-center sm:text-center")}
            >
              {i > 0 && (
                <span
                  aria-hidden
                  className={cn(
                    "absolute top-4 right-1/2 h-0.5 w-full -translate-y-1/2",
                    i <= pasoActual ? "bg-primary" : "bg-border",
                  )}
                />
              )}
              <span
                className={cn(
                  "relative z-10 flex size-8 items-center justify-center rounded-full border-2 text-sm font-semibold",
                  hecho && "border-primary bg-primary text-primary-foreground",
                  actual && "border-primary bg-background text-primary ring-4 ring-primary/15",
                  !hecho && !actual && "border-border bg-background text-muted-foreground",
                )}
              >
                {hecho ? <Check className="size-4" aria-hidden /> : i + 1}
              </span>
              <span
                className={cn(
                  "px-1 text-xs leading-tight sm:text-sm",
                  actual ? "font-semibold text-foreground" : "hidden text-muted-foreground sm:block",
                )}
              >
                {nombre}
                {hecho && <span className="sr-only"> (listo)</span>}
                {actual && <span className="sr-only"> (paso actual)</span>}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
