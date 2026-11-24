"use client";

import type { Control, FieldPath, FieldValues } from "react-hook-form";
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { OpcionesRadio } from "../opciones-radio";
import { ASTERISCO } from "./comun";

interface Base<T extends FieldValues> {
  control: Control<T>;
  name: FieldPath<T>;
  etiqueta: string;
  requerido?: boolean;
  ayuda?: React.ReactNode;
  className?: string;
}

export function CampoTexto<T extends FieldValues>({
  control,
  name,
  etiqueta,
  requerido,
  ayuda,
  className,
  ...entrada
}: Base<T> & Omit<React.ComponentProps<typeof Input>, "name" | "defaultValue" | "value" | "onChange" | "onBlur" | "ref">) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          <FormLabel>
            {etiqueta}
            {requerido && ASTERISCO}
          </FormLabel>
          <FormControl>
            <Input {...entrada} {...field} value={field.value ?? ""} className="h-11 text-base" />
          </FormControl>
          {ayuda && <FormDescription>{ayuda}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

export function CampoSelect<T extends FieldValues>({
  control,
  name,
  etiqueta,
  requerido,
  ayuda,
  className,
  opciones,
  placeholder = "Elige una opción",
  deshabilitado,
  onCambio,
}: Base<T> & {
  opciones: ReadonlyArray<{ valor: string; texto: string }>;
  placeholder?: string;
  deshabilitado?: boolean;
  onCambio?: (valor: string) => void;
}) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={className}>
          <FormLabel>
            {etiqueta}
            {requerido && ASTERISCO}
          </FormLabel>
          <Select
            value={field.value ?? ""}
            disabled={deshabilitado}
            onValueChange={(v) => {
              field.onChange(v);
              onCambio?.(v);
            }}
          >
            <FormControl>
              <SelectTrigger className="h-11 w-full text-base">
                <SelectValue placeholder={placeholder} />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {opciones.map((o) => (
                <SelectItem key={o.valor} value={o.valor}>
                  {o.texto}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {ayuda && <FormDescription>{ayuda}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

export function CampoOpciones<T extends FieldValues>({
  control,
  name,
  etiqueta,
  requerido,
  ayuda,
  className,
  opciones,
  idEtiqueta,
}: Base<T> & { opciones: ReadonlyArray<readonly [string, string]>; idEtiqueta: string }) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className={cn(className)}>
          <FormLabel id={idEtiqueta}>
            {etiqueta}
            {requerido && ASTERISCO}
          </FormLabel>
          <FormControl>
            <OpcionesRadio value={field.value ?? ""} onChange={field.onChange} etiquetadoPor={idEtiqueta} opciones={opciones} />
          </FormControl>
          {ayuda && <FormDescription>{ayuda}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
