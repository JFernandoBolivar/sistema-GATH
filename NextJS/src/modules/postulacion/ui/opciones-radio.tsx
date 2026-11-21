"use client";

import { useId } from "react";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

/**
 * Grupo de opciones como tarjetas tocables. Patrón estándar: `RadioGroupItem` con `id` y una
 * `Label htmlFor` HERMANA (no anidada), cubriendo toda la tarjeta; la anidación no cambia el
 * valor con eventos táctiles.
 */
export function OpcionesRadio({
  value,
  onChange,
  opciones,
  etiquetadoPor,
}: {
  value: string;
  onChange: (valor: string) => void;
  opciones: ReadonlyArray<readonly [string, string]>;
  etiquetadoPor: string;
}) {
  const base = useId();
  return (
    <RadioGroup value={value} onValueChange={onChange} aria-labelledby={etiquetadoPor} className="grid grid-cols-2 gap-3">
      {opciones.map(([valor, texto]) => {
        const id = `${base}-${valor}`;
        return (
          <div
            key={valor}
            className="relative flex min-h-11 items-center gap-2 rounded-md border px-3 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5"
          >
            {/* Por encima de la capa del label: tocar el círculo o la tarjeta marca la opción. */}
            <RadioGroupItem id={id} value={valor} className="relative z-10" />
            <Label htmlFor={id} className="flex-1 cursor-pointer py-3 text-base font-normal after:absolute after:inset-0">
              {texto}
            </Label>
          </div>
        );
      })}
    </RadioGroup>
  );
}
