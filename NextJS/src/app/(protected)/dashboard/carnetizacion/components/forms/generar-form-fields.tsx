"use client";
import { UseFormReturn } from "react-hook-form";
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { SelectForm } from "@/components/select-form";
import type { MotivoOption } from "../../types/carnetizacion";
import type { z } from "zod";
import type { schemaGenerar } from "../../schemas/schemaGenerar";

type GenerarValues = z.infer<typeof schemaGenerar>;

interface Props {
  form: UseFormReturn<GenerarValues>;
  motivos: MotivoOption[] | undefined;
  onNombreBlur: () => void;
}

export default function GenerarFormFields({
  form,
  motivos,
  onNombreBlur,
}: Props) {
  return (
    <>
      <FormField
        control={form.control}
        name="nombre"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Nombre completo</FormLabel>
            <FormControl>
              <Input
                {...field}
                onBlur={() => {
                  field.onBlur();
                  onNombreBlur();
                }}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <SelectForm<GenerarValues, MotivoOption>
        form={form}
        nameSalect="motivo_id"
        Formlabel="Motivo"
        SelectLabelItem="Seleccione un motivo"
        placeholder="Seleccione..."
        options={motivos || []}
        isLoading={!motivos}
        valueKey="id"
        labelKey="nombre"
      />
    </>
  );
}
