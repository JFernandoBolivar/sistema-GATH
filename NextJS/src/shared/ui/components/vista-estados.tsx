"use client";

import { useEffect, useState, type ReactNode } from "react";
import { AlertTriangle, Inbox, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Estado de carga anunciado a lectores de pantalla (`role="status"`).
 * Tiene límite: pasados `limiteMs` deja de mostrar el indicador infinito y avisa de la demora,
 * con "Reintentar" si se entrega `onReintentar`.
 */
export function VistaCargando({
  mensaje = "Cargando…",
  className,
  limiteMs = 20_000,
  onReintentar,
}: {
  mensaje?: string;
  className?: string;
  limiteMs?: number;
  onReintentar?: () => void;
}) {
  const [agotado, setAgotado] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setAgotado(true), limiteMs);
    return () => clearTimeout(t);
  }, [limiteMs]);

  if (agotado) {
    return (
      <VistaError
        className={className}
        mensaje="La carga está tardando más de lo habitual. Verifique su conexión e inténtelo de nuevo."
        onReintentar={
          onReintentar
            ? () => {
                setAgotado(false);
                onReintentar();
              }
            : undefined
        }
      />
    );
  }
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex items-center justify-center gap-3 rounded-lg border bg-card p-8 text-base text-muted-foreground",
        className,
      )}
    >
      <Loader2 className="size-5 animate-spin" aria-hidden />
      <span>{mensaje}</span>
    </div>
  );
}

/** Error recuperable: mensaje claro en español y botón "Reintentar". */
export function VistaError({
  mensaje,
  onReintentar,
  className,
}: {
  mensaje: string;
  onReintentar?: () => void;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-start gap-3 rounded-lg border border-danger/40 bg-danger-soft p-5 text-danger",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden />
        <p className="text-base font-medium">{mensaje}</p>
      </div>
      {onReintentar ? (
        <Button type="button" variant="outline" onClick={onReintentar}>
          Reintentar
        </Button>
      ) : null}
    </div>
  );
}

/** Estado vacío con explicación y, opcionalmente, la acción siguiente. */
export function VistaVacia({
  titulo,
  descripcion,
  accion,
  className,
}: {
  titulo: string;
  descripcion?: string;
  accion?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 rounded-lg border border-dashed bg-card p-8 text-center",
        className,
      )}
    >
      <Inbox className="size-8 text-muted-foreground" aria-hidden />
      <p className="text-lg font-semibold">{titulo}</p>
      {descripcion ? (
        <p className="max-w-[60ch] text-base text-muted-foreground">{descripcion}</p>
      ) : null}
      {accion}
    </div>
  );
}
