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
  FormMessage,
} from "@/components/ui/form";
import {
  Loader2,
  Upload,
  FileImage,
} from "lucide-react";
import type { z } from "zod";
import type { schemaPlantilla } from "../../schemas/schemaPlantilla";

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
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <InputForm<PlantillaValues>
          form={form}
          nameInput="nombre"
          label="Nombre"
          placeholder="Ej: Fondo CONATEL 2026"
          type="text"
        />

        <FormField
          control={form.control}
          name="imagen"
          render={({ field: { onChange, value: _value, onBlur: _onBlur, ref: _ref, ...fieldProps } }) => (
            <FormItem>
              <FormLabel>Imagen (JPG/PNG, máx 5MB)</FormLabel>
              <FormControl>
                <div>
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
                  <div className="flex items-center gap-2 mt-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <FileImage className="h-4 w-4 mr-1" />
                      Seleccionar Imagen
                    </Button>
                    {fileName && (
                      <span className="text-sm text-muted-foreground truncate max-w-[180px]">
                        {fileName}
                      </span>
                    )}
                  </div>
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {preview && (
          <div className="border rounded-md overflow-hidden">
            <img
              src={preview}
              alt="Preview"
              className="w-full object-cover max-h-40"
            />
          </div>
        )}

        <Button
          className="w-full"
          type="submit"
          disabled={isPending}
        >
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Upload className="h-4 w-4 mr-2" />
          )}
          {isPending ? "Subiendo..." : "Subir Plantilla"}
        </Button>
      </form>
    </Form>
  );
}
