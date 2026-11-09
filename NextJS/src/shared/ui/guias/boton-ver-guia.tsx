"use client";

import { HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface BotonVerGuiaProps {
  onClick: () => void;
  titulo?: string;
  className?: string;
  disabled?: boolean;
}

/**
 * Botón accesible para relanzar la guía interactiva de la pantalla actual.
 */
export function BotonVerGuia({
  onClick,
  titulo = "Ver guía",
  className,
  disabled = false,
}: BotonVerGuiaProps) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={onClick}
      disabled={disabled}
      aria-label={titulo}
      className={cn(
        "gap-1.5 text-xs font-semibold rounded-lg border-primary/30 text-primary hover:bg-primary/10 hover:text-primary transition-colors",
        className,
      )}
    >
      <HelpCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />
      <span>{titulo}</span>
    </Button>
  );
}
