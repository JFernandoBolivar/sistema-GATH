"use client";

import type { ReactNode } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Sección del inspector: etiqueta xs/medium y espaciado uniforme. */
export function SeccionPropiedades({
  titulo,
  children,
}: {
  titulo?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2 border-t pt-3">
      {titulo && <Label className="text-xs font-medium text-muted-foreground">{titulo}</Label>}
      {children}
    </div>
  );
}

/** Input numérico h-9 con el sufijo de unidad (mm, %, pt) dentro del campo. */
export function CampoNumerico({
  etiqueta,
  sufijo,
  ...props
}: {
  etiqueta?: string;
  sufijo: string;
} & Omit<React.ComponentProps<"input">, "type" | "className">) {
  return (
    <div className="space-y-1">
      {etiqueta && <Label className="text-xs font-medium">{etiqueta}</Label>}
      <div className="relative">
        <Input type="number" className="h-9 pr-9 font-mono text-xs" {...props} />
        <span className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-[11px] text-muted-foreground">
          {sufijo}
        </span>
      </div>
    </div>
  );
}
