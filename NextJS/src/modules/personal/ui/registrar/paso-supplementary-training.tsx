"use client";

/**
 * Paso 3 del wizard de registro: Formación Complementaria (paridad con
 * `form-supplementary_training.tsx` del legado).
 *
 * Cada curso es una tarjeta con una grilla alineada y responsive (1 columna en
 * teléfono, 2 en tablet, 3 en pantallas anchas); los campos ocupan el ancho de
 * su celda, sin anchos fijos.
 */
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowBigDownDash, ArrowBigUpDash, Cross, Trash, X } from "lucide-react";

import { Badge } from "@/shared/ui/components/badge";
import { Button } from "@/shared/ui/components/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/shared/ui/components/card";
import { Combobox } from "@/shared/ui/components/combobox";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/shared/ui/components/form";
import { Input } from "@/shared/ui/components/input";
import { Label } from "@/shared/ui/components/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/components/select";

import type { CatalogosExpedienteDTO } from "../../application/dtos/empleado-dto";
import { pasoSupplementaryTrainingSchema, type PasoSupplementaryTrainingType } from "../schema/schema-registro-pasos";
import { ID_OTRA, OPCION_OTRA } from "../catalogo-otra";
import { CampoFecha } from "./campo-fecha";
import { CampoNuevoNombre } from "./campo-nuevo-nombre";
import { useErroresDelPaso, type ErroresServidor } from "./errores-registro";

const filaVacia = {
  fecha_inicio: undefined,
  fecha_fin: undefined,
  institucion_id: 0,
  capacitacion_id: 0,
  procedencia_id: 0,
  horas_completadas: undefined,
};

export function PasoSupplementaryTraining({
  defaultValues,
  onSubmit,
  catalogos,
  erroresServidor,
}: {
  defaultValues: PasoSupplementaryTrainingType;
  onSubmit: (values: PasoSupplementaryTrainingType) => void;
  catalogos: CatalogosExpedienteDTO | null;
  erroresServidor?: ErroresServidor | null;
}) {
  const form = useForm<PasoSupplementaryTrainingType>({
    resolver: zodResolver(pasoSupplementaryTrainingSchema),
    defaultValues,
  });
  useErroresDelPaso(form, erroresServidor, 2);
  const { fields, append, remove } = useFieldArray({ name: "formacion_complementaria", control: form.control });
  const isError = Object.keys(form.formState.errors).length === 0;

  return (
    <Card className="flex flex-col gap-3">
      <CardHeader>
        <CardTitle>Formación Complementaria</CardTitle>
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
                  onClick={() => form.reset({ formacion_complementaria: [{ ...filaVacia }] })}
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
              <h1 className="text-gray-600">Opcional si no posee formación complementaria</h1>
              {fields.map((item, index) => {
                const watchedCapacitacionId = form.watch(`formacion_complementaria.${index}.capacitacion_id`);
                const hasCapacitacion = watchedCapacitacionId != null && watchedCapacitacionId > 0;
                const watchedProcedencia = form.watch(`formacion_complementaria.${index}.procedencia_id`);
                const procedencia = catalogos?.tiposProcedencia.find((p) => p.id === watchedProcedencia);
                const esExterna = procedencia?.nombre?.toLowerCase().includes("externa") ?? true;

                return (
                  <div key={item.id} className="flex flex-col gap-4 rounded-lg border p-3 sm:p-4">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">Curso {index + 1}</span>
                      <Button
                        type="button"
                        variant={"destructive"}
                        size="icon"
                        className={`${index === 0 ? "invisible" : ""} size-8 cursor-pointer`}
                        onClick={() => remove(index)}
                        aria-label={`Quitar formación complementaria ${index + 1}`}
                      >
                        <X />
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
                      <FormField
                        control={form.control}
                        name={`formacion_complementaria.${index}.fecha_inicio`}
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
                        name={`formacion_complementaria.${index}.fecha_fin`}
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
                        name={`formacion_complementaria.${index}.horas_completadas`}
                        render={({ field }) => (
                          <FormItem className="min-w-0">
                            <FormLabel>Horas Completadas</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Ej: 40"
                                inputMode="numeric"
                                maxLength={5}
                                {...field}
                                value={field.value ?? ""}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="flex min-w-0 flex-col gap-2">
                        <FormField
                          control={form.control}
                          name={`formacion_complementaria.${index}.capacitacion_id`}
                          render={({ field }) => (
                            <FormItem className="min-w-0">
                              <FormLabel>Capacitación</FormLabel>
                              <FormControl>
                                <Combobox
                                  options={[
                                    ...(catalogos?.capacitaciones ?? []).map((c) => ({ value: c.id.toString(), label: c.nombre })),
                                    OPCION_OTRA,
                                  ]}
                                  value={field.value ? field.value.toString() : ""}
                                  onChange={(v) => {
                                    field.onChange(Number(v));
                                    if (Number(v) !== ID_OTRA) {
                                      form.setValue(`formacion_complementaria.${index}.nueva_capacitacion_nombre`, "");
                                    }
                                  }}
                                  placeholder="Seleccione"
                                  searchPlaceholder="Buscar capacitación..."
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <CampoNuevoNombre
                          control={form.control}
                          name={`formacion_complementaria.${index}.nueva_capacitacion_nombre`}
                          visible={watchedCapacitacionId === ID_OTRA}
                          placeholder="Nueva capacitación..."
                          sinEtiqueta
                        />
                      </div>
                      <div className="flex min-w-0 flex-col gap-2">
                        <FormField
                          control={form.control}
                          name={`formacion_complementaria.${index}.institucion_id`}
                          render={({ field }) => (
                            <FormItem className="min-w-0">
                              <FormLabel>
                                Institución {hasCapacitacion ? <span className="text-red-500">*</span> : ""}
                              </FormLabel>
                              <FormControl>
                                <Combobox
                                  options={[
                                    ...(catalogos?.instituciones ?? []).map((i) => ({ value: i.id.toString(), label: i.nombre })),
                                    OPCION_OTRA,
                                  ]}
                                  value={field.value ? field.value.toString() : ""}
                                  onChange={(v) => {
                                    field.onChange(Number(v));
                                    if (Number(v) !== ID_OTRA) {
                                      form.setValue(`formacion_complementaria.${index}.nueva_institucion_nombre`, "");
                                    }
                                  }}
                                  placeholder="Seleccione"
                                  searchPlaceholder="Buscar institución..."
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <CampoNuevoNombre
                          control={form.control}
                          name={`formacion_complementaria.${index}.nueva_institucion_nombre`}
                          visible={form.watch(`formacion_complementaria.${index}.institucion_id`) === ID_OTRA}
                          placeholder="Nueva institución..."
                          sinEtiqueta
                        />
                      </div>
                      <FormField
                        control={form.control}
                        name={`formacion_complementaria.${index}.procedencia_id`}
                        render={({ field }) => (
                          <FormItem className="min-w-0">
                            <FormLabel>Procedencia</FormLabel>
                            <Select
                              onValueChange={(v) => {
                                field.onChange(Number(v));
                                form.setValue(`formacion_complementaria.${index}.grupo_id`, 0);
                              }}
                              value={field.value ? field.value.toString() : ""}
                            >
                              <FormControl>
                                <SelectTrigger className="w-full truncate">
                                  <SelectValue placeholder="Seleccione" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {(catalogos?.tiposProcedencia ?? []).map((p) => (
                                  <SelectItem key={p.id} value={p.id.toString()}>
                                    {p.nombre}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      {!esExterna && (
                        <FormField
                          control={form.control}
                          name={`formacion_complementaria.${index}.grupo_id`}
                          render={({ field }) => (
                            <FormItem className="min-w-0">
                              <FormLabel>Grupo</FormLabel>
                              <Select onValueChange={(v) => field.onChange(Number(v))} value={field.value ? field.value.toString() : ""}>
                                <FormControl>
                                  <SelectTrigger className="w-full truncate">
                                    <SelectValue placeholder="Seleccione" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {(catalogos?.gruposCapacitacion ?? []).map((g) => (
                                    <SelectItem key={g.id} value={g.id.toString()}>
                                      {g.nombre}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            {!isError && (
              <Badge
                className="animate-pulse text-lg font-bold text-white w-full flex justify-center items-center text-center h-auto py-2 whitespace-normal"
                variant={"destructive"}
              >
                Por favor, corrija los campos marcados o complete la información pendiente antes de agregar una nueva
                formación complementaria.
              </Badge>
            )}
            <Button className="mt-2 w-full cursor-pointer">Siguiente</Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
