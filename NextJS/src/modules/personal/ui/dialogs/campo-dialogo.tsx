"use client";

/**
 * Envoltorio de campo para los diálogos de actualización que usan
 * `register`/`setValue` (sin `FormField`): etiqueta, control y mensaje de error
 * del campo (el de zod o el que devolvió el servidor con `setError`).
 */
import type { ReactNode } from "react";

import { Label } from "@/shared/ui/components/label";
import { cn } from "@/lib/utils";

export function CampoDialogo({
  id,
  label,
  error,
  children,
  className,
}: {
  id?: string;
  label: ReactNode;
  error?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-2", className)}>
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? (
        <p id={id ? `${id}-error` : undefined} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Mensaje de error de un campo de `formState.errors` (texto plano). */
export function mensajeDe(error: unknown): string | undefined {
  if (error && typeof error === "object" && "message" in error) {
    const m = (error as { message?: unknown }).message;
    return typeof m === "string" && m ? m : undefined;
  }
  return undefined;
}

/** Texto del aviso general cuando el servidor rechazó el guardado. */
export function avisoDeFallo(
  fallo: { error: string; errores?: Record<string, string[]> },
  sinUbicar: string[],
): string {
  if (sinUbicar.length) return sinUbicar.join(" ");
  if (fallo.errores && Object.keys(fallo.errores).length) {
    return "Revise los campos marcados en rojo.";
  }
  return fallo.error;
}
