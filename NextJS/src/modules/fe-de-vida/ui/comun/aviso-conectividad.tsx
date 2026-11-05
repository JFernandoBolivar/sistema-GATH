"use client";

import { WifiOff } from "lucide-react";
import { useConectividad } from "./use-conectividad";

interface Props {
  className?: string;
}

/**
 * Aviso visual accesible cuando se detecta desconexión a internet.
 * Garantiza tranquilidad al jubilado/pensionado informando que sus datos no se pierden.
 */
export function AvisoConectividad({ className = "" }: Props) {
  const { online } = useConectividad();

  if (online) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex items-center gap-2.5 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900 shadow-sm dark:border-amber-600/40 dark:bg-amber-950/40 dark:text-amber-200 ${className}`}
    >
      <WifiOff className="size-5 shrink-0 text-amber-700 dark:text-amber-300" aria-hidden />
      <span>Sin conexión: sus datos están guardados</span>
    </div>
  );
}
