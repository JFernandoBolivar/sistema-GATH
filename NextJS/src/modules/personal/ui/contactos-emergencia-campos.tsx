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
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/shared/ui/components/form";
import { CampoTelefono } from "@/shared/ui/components/campo-telefono";
import { Input } from "@/shared/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/components/select";

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
        <div key={item.id} className="@container flex flex-col gap-4 rounded-lg border p-3 sm:p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium">Contacto {index + 1}</span>
            <Button
              type="button"
              variant="destructive"
              size="icon"
              className="size-8 cursor-pointer"
              onClick={() => remove(index)}
              aria-label={`Quitar contacto de emergencia ${index + 1}`}
            >
              <X />
            </Button>
          </div>
          {/* Fila 1: nombres y apellidos. Fila 2: teléfono (país + código + número) y parentesco. */}
          <div className="grid grid-cols-1 gap-4 @lg:grid-cols-2">
            <FormField
              control={control}
              name={`${NOMBRE}.${index}.nombres`}
              render={({ field }) => (
                <FormItem className="min-w-0">
                  <FormLabel>Nombres *</FormLabel>
                  <FormControl>
                    <Input placeholder="Maria Jose" maxLength={60} {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={control}
              name={`${NOMBRE}.${index}.apellidos`}
              render={({ field }) => (
                <FormItem className="min-w-0">
                  <FormLabel>Apellidos *</FormLabel>
                  <FormControl>
                    <Input placeholder="Perez Gutierrez" maxLength={60} {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 @2xl:grid-cols-2">
            <FormField
              control={control}
              name={`${NOMBRE}.${index}.telefono`}
              render={({ field, fieldState }) => (
                <FormItem className="min-w-0">
                  <FormLabel>Teléfono *</FormLabel>
                  <FormControl>
                    <CampoTelefono
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      invalido={!!fieldState.error}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={control}
              name={`${NOMBRE}.${index}.relacion_id`}
              render={({ field }) => (
                <FormItem className="min-w-0">
                  <FormLabel>Parentesco *</FormLabel>
                  <Select
                    value={field.value ? String(field.value) : ""}
                    onValueChange={(v) => field.onChange(Number.parseInt(v))}
                  >
                    <FormControl>
                      <SelectTrigger
                        className="w-full truncate"
                        aria-label={`Parentesco del contacto ${index + 1}`}
                      >
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
