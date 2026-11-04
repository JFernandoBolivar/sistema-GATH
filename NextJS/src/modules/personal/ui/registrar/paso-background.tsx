"use client";

/**
 * Paso 4 del wizard de registro: Antecedentes En La Administración Pública
 * (paridad con `form-background.tsx` del legado).
 */
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowBigDownDash, ArrowBigUpDash, Cross, Trash, X } from "lucide-react";

import { Badge } from "@/shared/ui/components/badge";
import { Button } from "@/shared/ui/components/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/shared/ui/components/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/shared/ui/components/form";
import { Label } from "@/shared/ui/components/label";
import { Combobox } from "@/shared/ui/components/combobox";

import type { CatalogosExpedienteDTO } from "../../application/dtos/empleado-dto";
import { pasoBackgroundSchema, type PasoBackgroundType } from "../schema/schema-registro-pasos";
import { CampoFecha } from "./campo-fecha";
import { useErroresDelPaso, type ErroresServidor } from "./errores-registro";

const filaVacia = { fecha_ingreso: undefined, fecha_egreso: undefined, organismo_id: undefined };

export function PasoBackground({
  defaultValues,
  onSubmit,
  catalogos,
  erroresServidor,
}: {
  defaultValues: PasoBackgroundType;
  onSubmit: (values: PasoBackgroundType) => void;
  catalogos: CatalogosExpedienteDTO | null;
  erroresServidor?: ErroresServidor | null;
}) {
  const form = useForm<PasoBackgroundType>({
    resolver: zodResolver(pasoBackgroundSchema),
    defaultValues,
  });
  useErroresDelPaso(form, erroresServidor, 3);
  const { fields, append, remove } = useFieldArray({ name: "antecedentes", control: form.control });
  const isError = Object.keys(form.formState.errors).length === 0;

  return (
    <Card className="flex flex-col gap-3">
      <CardHeader>
        <CardTitle>Antecedentes En La Administracion Publica</CardTitle>
      </CardHeader>

      <CardContent>
        <CardAction className="text-gray-600">Paso 3: Datos Laborales</CardAction>
      </CardContent>

      <CardContent className="">
        <Form {...form}>
          <form className="flex flex-col gap-4" onSubmit={form.handleSubmit(onSubmit)}>
            <div className="flex items-center justify-end gap-2">
              <div className="flex flex-col items-center justify-center">
                <Label htmlFor="clean">Limpiar</Label>
                <Button
                  id="clean"
                  variant={"destructive"}
                  type="button"
                  className=" cursor-pointer"
                  onClick={() => form.reset({ antecedentes: [{ ...filaVacia }] })}
                >
                  <Trash />
                </Button>
              </div>
              {isError && (
                <div className="flex flex-col items-center justify-center">
                  <Label htmlFor="add">Agregar</Label>
                  <Button id="add" variant={"default"} type="button" className="cursor-pointer" onClick={() => append({ ...filaVacia })}>
                    <Cross />
                  </Button>
                </div>
              )}
            </div>
            <div className="flex w-full flex-col gap-4">
              <h1 className="text-gray-600">Opcional si no posee antecedentes</h1>
              {fields.map((item, index) => (
                <div key={item.id} className="flex flex-col gap-4 rounded-lg border p-3 sm:p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">Antecedente {index + 1}</span>
                    <Button
                      type="button"
                      variant={"destructive"}
                      size="icon"
                      className={`${index === 0 ? "invisible" : ""} size-8 cursor-pointer`}
                      onClick={() => remove(index)}
                      aria-label={`Quitar antecedente ${index + 1}`}
                    >
                      <X />
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name={`antecedentes.${index}.fecha_ingreso`}
                      render={({ field }) => (
                        <FormItem className="min-w-0">
                          <FormLabel>
                            Fecha Inicio <ArrowBigDownDash />
                          </FormLabel>
                          <CampoFecha value={field.value} onChange={field.onChange} />
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`antecedentes.${index}.fecha_egreso`}
                      render={({ field }) => (
                        <FormItem className="min-w-0">
                          <FormLabel>
                            Fecha Culminacion <ArrowBigUpDash />
                          </FormLabel>
                          <CampoFecha value={field.value} onChange={field.onChange} />
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`antecedentes.${index}.organismo_id`}
                      render={({ field }) => (
                        <FormItem className="min-w-0 md:col-span-2">
                          <FormLabel>Organismo</FormLabel>
                          <FormControl>
                            <Combobox
                              options={(catalogos?.organismos ?? []).map((o) => ({
                                value: o.id.toString(),
                                label: o.nombre,
                              }))}
                              value={field.value ? field.value.toString() : ""}
                              onChange={(v) => field.onChange(Number(v))}
                              placeholder="Seleccione un Organismo"
                              searchPlaceholder="Buscar organismo..."
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              ))}
            </div>
            {!isError && (
              <Badge
                className="animate-pulse text-lg font-bold text-white w-full flex justify-center items-center text-center h-auto py-2 whitespace-normal"
                variant={"destructive"}
              >
                Por favor, corrija los campos marcados o complete la información pendiente antes de agregar un nuevo
                antecedente.
              </Badge>
            )}
            <Button className="mt-2 w-full cursor-pointer">Siguiente</Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
