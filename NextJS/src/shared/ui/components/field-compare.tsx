import type { ReactNode } from "react";
import { ArrowRightLeft, Equal, FilePlus2, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

export type TipoDiferencia = "difiere" | "coincide" | "nuevo";

interface FieldCompareProps {
  /** Nombre legible del campo («Teléfono móvil»). */
  etiqueta: string;
  /** Valor vigente hoy en la ficha, ya formateado. */
  actual: ReactNode;
  /** Valor propuesto por el trabajador, ya formateado. */
  propuesto: ReactNode;
  diferencia: TipoDiferencia;
  /** La ficha cambió después de la propuesta: el campo solo puede rechazarse. */
  conflicto?: boolean;
  /** Controles de decisión (aprobar/rechazar) o estado de la decisión. */
  decision?: ReactNode;
  id?: string;
  className?: string;
}

const TEXTO_DIFERENCIA: Record<TipoDiferencia, string> = {
  difiere: "Difiere de lo registrado",
  coincide: "Coincide con lo registrado",
  nuevo: "Registro nuevo",
};

const ICONO_DIFERENCIA = { difiere: ArrowRightLeft, coincide: Equal, nuevo: FilePlus2 } as const;

/**
 * Fila del visor comparativo: valor actual frente a valor propuesto, apilados en móvil y en dos
 * columnas en escritorio. La diferencia se comunica con ícono y texto, nunca solo con color.
 */
export function FieldCompare({
  etiqueta,
  actual,
  propuesto,
  diferencia,
  conflicto = false,
  decision,
  id,
  className,
}: FieldCompareProps) {
  const Icono = ICONO_DIFERENCIA[diferencia];
  return (
    <section
      aria-labelledby={id ? `${id}-etiqueta` : undefined}
      className={cn(
        "rounded-lg border bg-card p-4 shadow-xs",
        conflicto && "border-warning/60",
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id={id ? `${id}-etiqueta` : undefined} className="text-base font-semibold">
          {etiqueta}
        </h3>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 text-sm font-medium",
            diferencia === "coincide" ? "text-muted-foreground" : "text-info",
          )}
        >
          <Icono className="size-4" aria-hidden />
          {TEXTO_DIFERENCIA[diferencia]}
        </span>
      </div>

      <dl className="mt-3 grid gap-3 md:grid-cols-2">
        <div className="rounded-md bg-muted p-3">
          <dt className="text-sm font-medium text-muted-foreground">Valor actual en la ficha</dt>
          <dd className="mt-1 break-words text-base">{actual}</dd>
        </div>
        <div
          className={cn(
            "rounded-md border p-3",
            diferencia === "coincide" ? "bg-muted" : "border-info/40 bg-info-soft",
          )}
        >
          <dt className="text-sm font-medium text-muted-foreground">Valor propuesto</dt>
          <dd className="mt-1 break-words text-base font-medium">{propuesto}</dd>
        </div>
      </dl>

      {conflicto ? (
        <p
          role="note"
          className="mt-3 flex items-start gap-2 rounded-md bg-warning-soft p-3 text-sm text-warning"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          La ficha cambió después de esta propuesta. Este campo no puede aprobarse tal cual: solo
          puede rechazarse y el trabajador debe proponerlo de nuevo.
        </p>
      ) : null}

      {decision ? <div className="mt-3 border-t pt-3">{decision}</div> : null}
    </section>
  );
}
