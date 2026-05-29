"use client";

import {
  ArrowBigDownDash,
  ArrowBigUpDash,
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
import { Input } from "@/components/ui/input";
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
import { zodResolver } from "@hookform/resolvers/zod";
import { formatInTimeZone } from "date-fns-tz";
import { useTransition } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { toast } from "sonner";
import { useSWRConfig } from "swr";
import useSWR from "swr";
import { z } from "zod";
import Loading from "@/app/(protected)/dashboard/gestion-trabajadores/components/loading/loading";
import {
  schemaSupplementaryTrainingUpdate,
  SupplementaryTrainingUpdateType,
} from "@/shared/schemas/employees/update/schema-supplementary_training";
import { useSearchStore } from "@/hooks/use-search-params";
import { Badge } from "@/components/ui/badge";
import {
  getCapacitaciones,
  getGruposCapacitacion,
  getTiposProcedencia,
  getInstituciones,
} from "@/app/(protected)/dashboard/gestion-trabajadores/api/getInfoRac";

type Props = {
  defaultValues: SupplementaryTrainingUpdateType;
  idEmployee: string;
  mutate: (key: string[]) => void;
  mutateKey?: string;
    updateInfoEmployee: (...args: any[]) => Promise<{ success: boolean; message: string }>;
};
export default function FormUpdateSupplementaryTraining({
  defaultValues,
  mutate,
  mutateKey = "api/empleados",
  updateInfoEmployee,
  idEmployee,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const { data: capacitaciones } = useSWR(
    "capacitaciones",
    async () => await getCapacitaciones(),
  );
  const { data: instituciones } = useSWR(
    "instituciones",
    async () => await getInstituciones(),
  );
  const { data: tiposProcedencia } = useSWR(
    "tiposProcedencia",
    async () => await getTiposProcedencia(),
  );
  const { data: gruposCapacitacion } = useSWR(
    "gruposCapacitacion",
    async () => await getGruposCapacitacion(),
  );

  const form = useForm({
    resolver: zodResolver(schemaSupplementaryTrainingUpdate),
    values: defaultValues,
  });
  const { fields, append, remove } = useFieldArray({
    name: "formacion_complementaria",
    control: form.control,
  });
  const searchParams = useSearchStore((state) => state.searchParams);
  const onSubmitFormity = (
    values: z.infer<typeof schemaSupplementaryTrainingUpdate>,
  ) => {
    startTransition(async () => {
      const response = await updateInfoEmployee(values, idEmployee);
      if (response.success) {
        toast.success(response.message);
        mutate([mutateKey, searchParams]);
      } else {
        toast.error(response.message);
      }
    });
  };
  const isError = Object.keys(form.formState.errors).length === 0;

  return (
    <Card className="flex flex-col gap-3">
      <CardHeader>
        <CardTitle>Formación Complementaria</CardTitle>
      </CardHeader>

      <CardContent>
        <CardAction className="text-gray-600">
          Datos De Formación Complementaria
        </CardAction>
      </CardContent>

      <CardContent>
        {isPending ? (
          <Loading promiseMessage="Actualizando Información" />
        ) : (
          <Form {...form}>
            <form
              className="flex flex-col gap-2"
              onSubmit={form.handleSubmit(onSubmitFormity)}
            >
              <div className="flex justify-end gap-2 mr-4 items-center">
                <div className="flex flex-col items-center justify-center">
                  <Label htmlFor="clean">Limpiar</Label>
                  <Button
                    id="clean"
                    variant={"destructive"}
                    type="button"
                    className=" cursor-pointer"
                    onClick={() => {
                      remove(
                        fields
                          .filter((field, index) => index !== 0)
                          .map((field, index) => index + 1),
                      );
                      form.reset({
                        formacion_complementaria: [
                          {
                            fecha_inicio: undefined,
                            fecha_fin: undefined,
                            institucion_id: 0,
                            nueva_institucion_nombre: undefined,
                            capacitacion_id: 0,
                            nueva_capacitacion_nombre: undefined,
                            procedencia_id: 0,
                            grupo_id: undefined,
                            horas_completadas: undefined,
                          },
                        ],
                      } as any);
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
                      variant={"default"}
                      type="button"
                      className="cursor-pointer"
                      onClick={() => {
                        append({
                          fecha_inicio: undefined,
                          fecha_fin: undefined,
                          institucion_id: 0,
                          nueva_institucion_nombre: undefined,
                          capacitacion_id: 0,
                          nueva_capacitacion_nombre: undefined,
                          procedencia_id: 0,
                          grupo_id: undefined,
                          horas_completadas: undefined,
                        });
                      }}
                    >
                      <Cross />
                    </Button>
                  </div>
                )}
              </div>
              <ScrollArea className="h-60 rounded-md w-full border p-2">
                <h1 className="text-gray-600">
                  Opcional si no posee formación complementaria
                </h1>
                {fields.map((field, index) => {
                  const watchedCapacitacionId = form.watch(
                    `formacion_complementaria.${index}.capacitacion_id`,
                  );
                  const hasCapacitacion = watchedCapacitacionId != null && watchedCapacitacionId > 0;
                  const watchedProcedencia = form.watch(
                    `formacion_complementaria.${index}.procedencia_id`,
                  );
                  const procedenciaSeleccionada = tiposProcedencia?.data?.find(
                    (p) => p.id === watchedProcedencia,
                  );
                  const esExterna =
                    procedenciaSeleccionada?.tipo_procedencia
                      ?.toLowerCase()
                      .includes("externa") ?? true;

                  return (
                    <div
                      key={field.id}
                      className="flex flex-wrap gap-3 items-start border-b pb-3 mb-3"
                    >
                      <FormField
                        control={form.control}
                        name={`formacion_complementaria.${index}.fecha_inicio`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>
                              {" "}
                              {index + 1}. Fecha Inicio <ArrowBigDownDash />
                            </FormLabel>
                            <Popover>
                              <PopoverTrigger asChild>
                                <FormControl>
                                  <Button
                                    variant="outline"
                                    id="date-start"
                                    className="w-48 justify-between font-normal"
                                  >
                                    {field.value ? (
                                      formatInTimeZone(
                                        field.value,
                                        "UTC",
                                        "dd/MM/yyy",
                                      )
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
                                  selected={field.value ?? new Date()}
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
                        name={`formacion_complementaria.${index}.fecha_fin`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>
                              {index + 1}. Fecha Culminacion <ArrowBigUpDash />
                            </FormLabel>
                            <Popover>
                              <PopoverTrigger asChild>
                                <FormControl>
                                  <Button
                                    variant="outline"
                                    id="date-start"
                                    className="w-48 justify-between font-normal"
                                  >
                                    {field.value ? (
                                      formatInTimeZone(
                                        field.value,
                                        "UTC",
                                        "dd/MM/yyy",
                                      )
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
                                  selected={field.value ?? new Date()}
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
                      <div className="flex items-start gap-2">
                        <FormField
                          control={form.control}
                          name={`formacion_complementaria.${index}.capacitacion_id`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Capacitación</FormLabel>
                              <Select
                                onValueChange={(v) => {
                                  if (v === "-1") {
                                    field.onChange(-1);
                                  } else {
                                    field.onChange(Number(v));
                                    form.setValue(
                                      `formacion_complementaria.${index}.nueva_capacitacion_nombre` as never,
                                      "" as never,
                                    );
                                  }
                                }}
                                value={
                                  field.value === -1
                                    ? "-1"
                                    : field.value?.toString() ?? ""
                                }
                              >
                                <FormControl>
                                  <SelectTrigger className="w-48">
                                    <SelectValue placeholder="Seleccione" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {capacitaciones?.data?.map((c) => (
                                    <SelectItem
                                      key={c.id}
                                      value={c.id.toString()}
                                    >
                                      {c.nombre_capacitacion}
                                    </SelectItem>
                                  ))}
                                  <SelectItem value="-1">Otra</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <div
                          className={
                            form.watch(
                              `formacion_complementaria.${index}.capacitacion_id`,
                            ) === -1
                              ? ""
                              : "hidden"
                          }
                        >
                          <FormField
                            control={form.control}
                            name={`formacion_complementaria.${index}.nueva_capacitacion_nombre`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>&nbsp;</FormLabel>
                                <FormControl>
                                  <Input
                                    placeholder="Nueva capacitación..."
                                    {...field}
                                    value={field.value ?? ""}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                      <FormField
                        control={form.control}
                        name={`formacion_complementaria.${index}.institucion_id`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>
                              Institución {hasCapacitacion ? <span className="text-red-500">*</span> : ""}
                            </FormLabel>
                            <Select
                              onValueChange={(v) => {
                                if (v === "-1") {
                                  field.onChange(-1);
                                } else {
                                  const numV = Number(v);
                                  field.onChange(numV);
                                  form.setValue(
                                    `formacion_complementaria.${index}.nueva_institucion_nombre` as never,
                                    "" as never,
                                  );
                                }
                              }}
                              value={
                                field.value === -1
                                  ? "-1"
                                  : field.value?.toString() ?? ""
                              }
                            >
                              <FormControl>
                                <SelectTrigger className="w-48">
                                  <SelectValue placeholder="Seleccione" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {instituciones?.data?.map((i) => (
                                  <SelectItem
                                    key={i.id}
                                    value={i.id.toString()}
                                  >
                                    {i.nombre_institucion}
                                  </SelectItem>
                                ))}
                                <SelectItem value="-1">Otra</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div
                        className={
                          form.watch(
                            `formacion_complementaria.${index}.institucion_id`,
                        ) === -1
                          ? ""
                          : "hidden"
                        }
                      >
                        <FormField
                          control={form.control}
                          name={`formacion_complementaria.${index}.nueva_institucion_nombre`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>&nbsp;</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="Nueva institución..."
                                  {...field}
                                  value={field.value ?? ""}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      </div>
                      <FormField
                        control={form.control}
                        name={`formacion_complementaria.${index}.procedencia_id`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Procedencia</FormLabel>
                            <Select
                              onValueChange={(v) => {
                                field.onChange(Number(v));
                                form.setValue(
                                  `formacion_complementaria.${index}.grupo_id`,
                                  undefined,
                                );
                              }}
                              value={field.value?.toString() ?? ""}
                            >
                              <FormControl>
                                <SelectTrigger className="w-48">
                                  <SelectValue placeholder="Seleccione" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {tiposProcedencia?.data?.map((p) => (
                                  <SelectItem
                                    key={p.id}
                                    value={p.id.toString()}
                                  >
                                    {p.tipo_procedencia}
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
                            <FormItem>
                              <FormLabel>Grupo</FormLabel>
                              <Select
                                onValueChange={(v) => field.onChange(Number(v))}
                                value={field.value?.toString() ?? ""}
                              >
                                <FormControl>
                                  <SelectTrigger className="w-25">
                                    <SelectValue placeholder="Seleccione" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {gruposCapacitacion?.data?.map((g) => (
                                    <SelectItem
                                      key={g.id}
                                      value={g.id.toString()}
                                    >
                                      {g.nombre_grupo}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}
                      <FormField
                        control={form.control}
                        name={`formacion_complementaria.${index}.horas_completadas`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Horas</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Ej: 40"
                                {...field}
                                value={field.value ?? ""}
                              />
                            </FormControl>
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
                        >
                          <X />
                      </Button>
                      </div>
                    </div>
                  );
                })}
              </ScrollArea>
              {!isError && (
                <Badge
                  className="animate-pulse text-lg font-bold text-white w-full flex justify-center items-center text-center h-auto py-2 whitespace-normal"
                  variant={"destructive"}
                >
                  {" "}
                  Por favor, corrija los campos marcados o complete la
                  información pendiente antes de agregar una nueva formación
                  complementaria.
                </Badge>
              )}
              <Button
                className="mt-4 w-full cursor-pointer"
                disabled={isPending}
              >
                {isPending ? "Actualizando Información" : "Actualizar"}
              </Button>
            </form>
          </Form>
        )}
      </CardContent>
    </Card>
  );
}
