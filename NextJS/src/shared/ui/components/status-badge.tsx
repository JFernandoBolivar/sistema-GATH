import type { ComponentType } from "react";
import { cn } from "@/lib/utils";

export type TonoEstado = "success" | "warning" | "danger" | "info" | "neutral";

interface StatusBadgeProps {
  texto: string;
  tono: TonoEstado;
  /** Ícono decorativo: el estado SIEMPRE se comunica también con texto (nunca solo color). */
  icono?: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  className?: string;
}

const CLASES_POR_TONO: Record<TonoEstado, string> = {
  success: "border-success/40 bg-success-soft text-success",
  warning: "border-warning/40 bg-warning-soft text-warning",
  danger: "border-danger/40 bg-danger-soft text-danger",
  info: "border-info/40 bg-info-soft text-info",
  neutral: "border-border bg-muted text-muted-foreground",
};

/** Insignia de estado: color + ícono + texto. Los estados concretos los mapea cada módulo. */
export function StatusBadge({ texto, tono, icono: Icono, className }: StatusBadgeProps) {
  return (
    <span
      data-tono={tono}
      className={cn(
        "inline-flex w-fit items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-semibold",
        CLASES_POR_TONO[tono],
        className,
      )}
    >
      {Icono ? <Icono className="size-4 shrink-0" aria-hidden /> : null}
      {texto}
    </span>
  );
}
