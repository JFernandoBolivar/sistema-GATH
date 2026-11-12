"use client";
import { UseFormReturn } from "react-hook-form";
import { Button } from "@/components/ui/button";
import InputForm from "@/components/input-form";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
  FormMessage,
} from "@/components/ui/form";
import { Loader2, Upload, FileImage } from "lucide-react";
import type { z } from "zod";
import type { schemaPlantilla } from "../schema/schema-carnet";

type PlantillaValues = z.infer<typeof schemaPlantilla>;

interface Props {
  form: UseFormReturn<PlantillaValues>;
  isPending: boolean;
  fileInputKey: number;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  preview: string | null;
  fileName: string;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSubmit: (values: PlantillaValues) => void;
}

/** Formulario de subida de un fondo fijo: etiquetas separadas de sus controles y controles de 44 px. */
export default function PlantillaUploadForm({
  form,
  isPending,
  fileInputKey,
  fileInputRef,
  preview,
  fileName,
  onFileChange,
  onSubmit,
}: Props) {
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <InputForm<PlantillaValues>
          form={form}
          nameInput="nombre"
          label="Nombre del fondo"
          placeholder="Ej: Fondo CONATEL 2026"
          type="text"
          className="space-y-1.5 gap-0"
        />

        <FormField
          control={form.control}
          name="imagen"
          render={({ field: { onChange, value: _value, onBlur: _onBlur, ref: _ref, ...fieldProps } }) => (
            <FormItem className="space-y-1.5 gap-0">
              <FormLabel>Imagen de fondo</FormLabel>
              <FormControl>
                <div className="flex flex-col gap-3">
                  <input
                    key={fileInputKey}
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      onFileChange(e);
                      onChange(e.target.files?.[0]);
                    }}
                    {...fieldProps}
                  />
                  <div className="flex flex-wrap items-center gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-11"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <FileImage className="size-4" aria-hidden="true" />
                      {fileName ? "Cambiar imagen" : "Seleccionar imagen"}
                    </Button>
                    {fileName && (
                      <span className="max-w-[180px] truncate text-sm text-muted-foreground" title={fileName}>
                        {fileName}
                      </span>
                    )}
                  </div>
                </div>
              </FormControl>
              <FormDescription>JPG o PNG, máximo 5 MB.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {preview && (
          <div className="overflow-hidden rounded-md border bg-muted/30">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="Vista previa del fondo" className="max-h-40 w-full object-contain" />
          </div>
        )}

        <Button className="h-11 w-full" type="submit" disabled={isPending}>
          {isPending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Upload className="size-4" aria-hidden="true" />
          )}
          {isPending ? "Subiendo..." : "Subir fondo"}
        </Button>
      </form>
    </Form>
  );
}
