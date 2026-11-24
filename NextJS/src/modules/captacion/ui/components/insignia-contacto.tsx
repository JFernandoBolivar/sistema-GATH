import { AlertTriangle, PhoneCall } from "lucide-react";
import { cn } from "@/lib/utils";
import { describirContacto } from "../../domain/contacto";

interface Props {
  contacto: { contactoPendiente: boolean; contactoPendienteDesde: string | null; contactoAtrasado: boolean };
  ahora: Date;
  className?: string;
}

/** «Por contactar · hace 2 días» y, si ya pasó el plazo, la insignia «Atrasado». No muestra nada si no hay contacto pendiente. */
export function InsigniaContacto({ contacto, ahora, className }: Props) {
  const e = describirContacto(contacto, ahora);
  if (!e.pendiente) return null;
  return (
    <span className={cn("inline-flex flex-wrap items-center gap-1.5", className)} data-testid="insignia-contacto">
      <span className="inline-flex items-center gap-1 rounded-full border border-warning/40 bg-warning-soft px-2 py-0.5 text-xs font-semibold text-warning">
        <PhoneCall className="size-3.5" aria-hidden /> Por contactar{e.antiguedad ? ` · ${e.antiguedad}` : ""}
      </span>
      {e.atrasado && (
        <span className="inline-flex items-center gap-1 rounded-full border border-danger/40 bg-danger-soft px-2 py-0.5 text-xs font-semibold text-danger">
          <AlertTriangle className="size-3.5" aria-hidden /> Atrasado
        </span>
      )}
    </span>
  );
}
