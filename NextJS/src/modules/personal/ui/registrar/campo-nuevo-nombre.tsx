"use client";

/**
 * Input que aparece al elegir "Otra" en un catálogo académico (paridad con el
 * legado: mismo placeholder y descripción). Con `sinEtiqueta` va debajo de su
 * selector (sin el `&nbsp;` de relleno que alineaba filas en una sola línea).
 */
import type { Control, FieldPath, FieldValues } from "react-hook-form";

import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/shared/ui/components/form";
import { Input } from "@/shared/ui/components/input";

export function CampoNuevoNombre<T extends FieldValues>({
  control,
  name,
  visible,
  placeholder,
  descripcion,
  className,
  sinEtiqueta = false,
}: {
  control: Control<T>;
  name: FieldPath<T>;
  visible: boolean;
  placeholder: string;
  descripcion?: string;
  className?: string;
  sinEtiqueta?: boolean;
}) {
  return (
    <div className={visible ? "min-w-0" : "hidden"}>
      <FormField
        control={control}
        name={name}
        render={({ field }) => (
          <FormItem className="min-w-0">
            {!sinEtiqueta && <FormLabel>&nbsp;</FormLabel>}
            <FormControl>
              <Input
                className={className}
                maxLength={200}
                placeholder={placeholder}
                {...field}
                value={field.value ?? ""}
              />
            </FormControl>
            {descripcion && <FormDescription className="text-xs">{descripcion}</FormDescription>}
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
