"use client";

import {
  ArrowBigDownDash,
  CalendarIcon,
  ChevronDownIcon,
  Cross,
  Trash,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { zodResolver } from "@hookform/resolvers/zod";
import { formatInTimeZone } from "date-fns-tz";
import { useFieldArray, useForm } from "react-hook-form";
import useSWR from "swr";
import { z } from "zod";
import { getPoliticas } from "@/app/(protected)/dashboard/gestion-trabajadores/api/getInfoRac";
import { ContratoType, schemaContrato } from "@/shared/schemas/employees/register/schema-contrato";

type Props = {
  onSubmit: (values: ContratoType) => void;
  defaultValues: ContratoType;
};

export default function FormContrato({ onSubmit, defaultValues }: Props) {
  const { data: politicas, isLoading: isLoadingPoliticas } = useSWR(
    "politicas",
    async () => await getPoliticas(),
  );

  const form = useForm({
    resolver: zodResolver(schemaContrato),
    defaultValues,
    mode: "onChange",
  });

  const { fields, append, remove } = useFieldArray({
    name: "contrato",
    control: form.control,
  });

  const onSubmitFormity = (data: z.infer<typeof schemaContrato>) => {
    onSubmit(data);
  };

  const isError = Object.keys(form.formState.errors).length === 0;

  return (
    <Card className="flex flex-col gap-3">
      <CardHeader>
        <CardTitle>Contratos</CardTitle>
      </CardHeader>

      <CardContent>
        <CardAction className="text-gray-600">
          Paso 2: Datos del Contrato
        </CardAction>
      </CardContent>

      <CardContent>
        <Form {...form}>
          <form
            className="flex flex-row flex-wrap gap-2"
            onSubmit={form.handleSubmit(onSubmitFormity)}
          >
            <div className="flex justify-center gap-2 mr-4 items-center">
              <div className="flex flex-col items-center justify-center">
                <Label htmlFor="clean">Limpiar</Label>
                <Button
                  id="clean"
                  variant="destructive"
                  type="button"
                  className="cursor-pointer"
                  onClick={() => {
                    remove();
                    form.reset({ contrato: [] });
                  }}
                >
                  <Trash />
                </Button>
              </div>
              {isError && (
                <div className="flex flex-col items-center justify-center">
                  <Label htmlFor="add">Agregar</Label>
                  <Button
                    id="add"
                    variant="default"
                    type="button"
                    className="cursor-pointer"
                    onClick={() => {
                      append({
                        n_contrato: "",
                        fecha_ingreso: undefined as unknown as Date,
                        politica_id: 0,
                        fecha_culminacion: undefined,
                      });
                    }}
                  >
                    <Cross />
                  </Button>
                </div>
              )}
            </div>
            <ScrollArea className="h-60 rounded-md w-full border p-2">
              {fields.length === 0 && (
                <h1 className="text-gray-600 text-center py-4">
                  No hay contratos registrados. Agregue uno nuevo.
                </h1>
              )}
              {fields.map((field, index) => (
                <div
                  key={field.id}
                  className="flex flex-row gap-5 space-y-5 items-center justify-around w-full"
                >
                  <FormField
                    control={form.control}
                    name={`contrato.${index}.n_contrato`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          {index + 1}. N° Contrato
                        </FormLabel>
                        <FormControl>
                          <input
                            {...field}
                            className="flex h-9 w-48 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                            placeholder="CTR-2024-001"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`contrato.${index}.fecha_ingreso`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          {index + 1}. Fecha Inicio <ArrowBigDownDash />
                        </FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                className="w-48 justify-between font-normal"
                              >
                                {field.value ? (
                                  formatInTimeZone(field.value, "UTC", "dd/MM/yyy")
                                ) : (
                                  <span>Selecciona una fecha</span>
                                )}
                                <ChevronDownIcon />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent
                            className="w-auto overflow-hidden p-0"
                            align="start"
                          >
                            <Calendar
                              mode="single"
                              selected={field.value}
                              captionLayout="dropdown"
                              disabled={(date) =>
                                date > new Date() ||
                                date < new Date("1930-01-01")
                              }
                              onSelect={(date) => {
                                field.onChange(date);
                              }}
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`contrato.${index}.fecha_culminacion`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          {index + 1}. Fecha Culminación
                        </FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                className="w-48 justify-between font-normal"
                              >
                                {field.value ? (
                                  formatInTimeZone(field.value, "UTC", "dd/MM/yyy")
                                ) : (
                                  <span>Selecciona una fecha</span>
                                )}
                                <ChevronDownIcon />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent
                            className="w-auto overflow-hidden p-0"
                            align="start"
                          >
                            <Calendar
                              mode="single"
                              selected={field.value}
                              captionLayout="dropdown"
                              disabled={(date) => date < new Date("1930-01-01")}
                              onSelect={(date) => {
                                field.onChange(date);
                              }}
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`contrato.${index}.politica_id`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Política</FormLabel>
                        <Select
                          onValueChange={(v) => field.onChange(Number(v))}
                          value={field.value ? field.value.toString() : ""}
                        >
                          <FormControl>
                            <SelectTrigger className="w-48">
                              <SelectValue
                                placeholder={
                                  isLoadingPoliticas
                                    ? "Cargando..."
                                    : "Seleccione"
                                }
                              />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {politicas?.data?.map((p) => (
                              <SelectItem key={p.id} value={p.id.toString()}>
                                {p.tipo_politica}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    className="cursor-pointer"
                    onClick={() => remove(index)}
                  >
                    <X />
                  </Button>
                </div>
              ))}
            </ScrollArea>
            {!isError && (
              <Badge
                className="animate-pulse text-lg font-bold text-white w-full flex justify-center items-center text-center h-auto py-2 whitespace-normal"
                variant="destructive"
              >
                Por favor, corrija los campos marcados o complete la
                información pendiente antes de agregar un nuevo contrato.
              </Badge>
            )}
            <Button className="mt-4 w-full cursor-pointer">Siguiente</Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
