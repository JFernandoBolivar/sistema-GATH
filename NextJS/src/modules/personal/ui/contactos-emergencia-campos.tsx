"use client";

/**
 * Lista editable de contactos de emergencia (nombres, apellidos, teléfono y
 * parentesco). Compartida por el paso 1 del wizard de registro y el diálogo
 * de actualización de /personal/consultar; requiere un `<Form>` (FormProvider)
 * cuyo schema incluya `contacto_emergencia` (`schema-contacto-emergencia.ts`).
 */
import { useFieldArray, useFormContext, type FieldValues } from "react-hook-form";
import { Plus, X } from "lucide-react";

import { Button } from "@/shared/ui/components/button";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/shared/ui/components/form";
import { Input } from "@/shared/ui/components/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/components/select";

import type { CatalogoEmpleadoDTO } from "../application/dtos/empleado-dto";
import { contactoEmergenciaVacio } from "./schema/schema-contacto-emergencia";

const NOMBRE = "contacto_emergencia";
const MAXIMO = 5;

export function ContactosEmergenciaCampos({
  parentescos,
  isLoading = false,
}: {
  parentescos: CatalogoEmpleadoDTO[];
  isLoading?: boolean;
}) {
  // El formulario anfitrión es distinto en cada uso (wizard/diálogo); solo se
  // exige que tenga el arreglo `contacto_emergencia`.
  const { control } = useFormContext<FieldValues>();
  const { fields, append, remove } = useFieldArray({ control, name: NOMBRE });

  return (
    <div className="flex flex-col gap-3">
      {fields.length === 0 && (
        <p className="text-sm text-muted-foreground">No se registran contactos de emergencia.</p>
      )}
      {fields.map((item, index) => (
        <div key={item.id} className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1fr_1fr_auto] gap-2 items-start border rounded-lg p-3">
          <FormField
            control={control}
            name={`${NOMBRE}.${index}.nombres`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>{index + 1}. Nombres *</FormLabel>
                <FormControl>
                  <Input placeholder="Maria Jose" {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name={`${NOMBRE}.${index}.apellidos`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Apellidos *</FormLabel>
                <FormControl>
                  <Input placeholder="Perez Gutierrez" {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name={`${NOMBRE}.${index}.telefono`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Teléfono *</FormLabel>
                <FormControl>
                  <Input placeholder="04160000000" inputMode="numeric" {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name={`${NOMBRE}.${index}.relacion_id`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Parentesco *</FormLabel>
                <Select
                  value={field.value ? String(field.value) : ""}
                  onValueChange={(v) => field.onChange(Number.parseInt(v))}
                >
                  <FormControl>
                    <SelectTrigger className="w-full truncate" aria-label={`Parentesco del contacto ${index + 1}`}>
                      <SelectValue placeholder={isLoading ? "Cargando..." : "Seleccione"} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {parentescos.map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {p.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="flex flex-col items-center gap-2">
            <span className="text-sm font-medium leading-none invisible">X</span>
            <Button
              type="button"
              variant="destructive"
              size="icon"
              className="cursor-pointer"
              onClick={() => remove(index)}
              aria-label={`Quitar contacto de emergencia ${index + 1}`}
            >
              <X />
            </Button>
          </div>
        </div>
      ))}
      {fields.length < MAXIMO && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="self-start cursor-pointer"
          onClick={() => append(contactoEmergenciaVacio())}
        >
          <Plus className="size-4" /> Agregar contacto de emergencia
        </Button>
      )}
    </div>
  );
}
