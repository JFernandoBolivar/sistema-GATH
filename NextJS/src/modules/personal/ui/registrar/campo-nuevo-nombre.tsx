"use client";

/**
 * Input que aparece al elegir "Otra" en un catálogo académico (paridad con el
 * legado: mismo `&nbsp;` de label, placeholder y descripción).
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
}: {
  control: Control<T>;
  name: FieldPath<T>;
  visible: boolean;
  placeholder: string;
  descripcion?: string;
  className?: string;
}) {
  return (
    <div className={visible ? "" : "hidden"}>
      <FormField
        control={control}
        name={name}
        render={({ field }) => (
          <FormItem>
            <FormLabel>&nbsp;</FormLabel>
            <FormControl>
              <Input className={className} placeholder={placeholder} {...field} value={field.value ?? ""} />
            </FormControl>
            {descripcion && <FormDescription className="text-xs">{descripcion}</FormDescription>}
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}
