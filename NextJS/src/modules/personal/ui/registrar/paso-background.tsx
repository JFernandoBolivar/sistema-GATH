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
import { ScrollArea } from "@/shared/ui/components/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/components/select";

import type { CatalogosExpedienteDTO } from "../../application/dtos/empleado-dto";
import { pasoBackgroundSchema, type PasoBackgroundType } from "../schema/schema-registro-pasos";
import { CampoFecha } from "./campo-fecha";

const filaVacia = { fecha_ingreso: undefined, fecha_egreso: undefined, organismo_id: undefined };

export function PasoBackground({
  defaultValues,
  onSubmit,
  catalogos,
}: {
  defaultValues: PasoBackgroundType;
  onSubmit: (values: PasoBackgroundType) => void;
  catalogos: CatalogosExpedienteDTO | null;
}) {
  const form = useForm<PasoBackgroundType>({
    resolver: zodResolver(pasoBackgroundSchema),
    defaultValues,
  });
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
          <form className="flex flex-row flex-wrap gap-2" onSubmit={form.handleSubmit(onSubmit)}>
            <div className="flex justify-end  gap-2  mr-4 items-center ">
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
            <ScrollArea className="h-60   rounded-md w-full border p-2">
              <h1 className="text-gray-600">Opcional si no posee antecedentes</h1>
              {fields.map((item, index) => (
                <div key={item.id} className="flex flex-row gap-5 items-center justify-around w-full">
                  <FormField
                    control={form.control}
                    name={`antecedentes.${index}.fecha_ingreso`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          {" "}
                          {index + 1}. Fecha Inicio <ArrowBigDownDash />
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
                      <FormItem>
                        <FormLabel>
                          {index + 1}. Fecha Culminacion <ArrowBigUpDash />
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
                      <FormItem>
                        <FormLabel>Organismo</FormLabel>
                        <Select onValueChange={(v) => field.onChange(Number(v))} value={field.value ? field.value.toString() : ""}>
                          <FormControl>
                            <SelectTrigger className="w-48">
                              <SelectValue placeholder="Seleccione un Organismo" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {(catalogos?.organismos ?? []).map((o) => (
                              <SelectItem key={o.id} value={o.id.toString()}>
                                {o.nombre}
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
                      variant={"destructive"}
                      size="icon"
                      className={`${index === 0 ? "invisible" : ""} cursor-pointer`}
                      onClick={() => remove(index)}
                      aria-label={`Quitar antecedente ${index + 1}`}
                    >
                      <X />
                    </Button>
                  </div>
                </div>
              ))}
            </ScrollArea>
            {!isError && (
              <Badge
                className="animate-pulse text-lg font-bold text-white w-full flex justify-center items-center text-center h-auto py-2 whitespace-normal"
                variant={"destructive"}
              >
                Por favor, corrija los campos marcados o complete la información pendiente antes de agregar un nuevo
                antecedente.
              </Badge>
            )}
            <Button className="mt-4 w-full cursor-pointer">Siguiente</Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
