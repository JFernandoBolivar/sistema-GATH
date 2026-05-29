"use client";

import {
  ArrowBigDownDash,
  CalendarIcon,
  ChevronDownIcon,
  Cross,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Card,
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
import { useTransition } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { toast } from "sonner";
import useSWR from "swr";
import { z } from "zod";
import { getPoliticas } from "@/app/(protected)/dashboard/gestion-trabajadores/api/getInfoRac";
import { Contrato, EmployeeData } from "@/app/types/types";
import Loading from "@/app/(protected)/dashboard/gestion-trabajadores/components/loading/loading";
import { useSearchStore } from "@/hooks/use-search-params";
import { schemaContratoItem } from "@/shared/schemas/employees/register/schema-contrato";

const schemaUpdateContrato = z.object({
  contrato: z.array(schemaContratoItem).optional(),
});

type Props = {
  employee: EmployeeData;
  mutate: (key: string[]) => void;
  mutateKey?: string;
    updateInfoEmployee: (...args: any[]) => Promise<{ success: boolean; message: string }>;
};

export default function FormUpdateContrato({ employee, mutate, mutateKey = "api/empleados", updateInfoEmployee }: Props) {
  const [isPending, startTransition] = useTransition();
  const searchParams = useSearchStore((state) => state.searchParams);

  const { data: politicas, isLoading: isLoadingPoliticas } = useSWR(
    "politicas",
    async () => await getPoliticas(),
  );

  const form = useForm({
    resolver: zodResolver(schemaUpdateContrato),
    defaultValues: {
      contrato: (employee.contrato ?? []).map((c) => ({
        n_contrato: c.n_contrato ?? "",
        fecha_ingreso: c.fecha_ingreso ? new Date(c.fecha_ingreso) : (undefined as unknown as Date),
        politica_id: c.politica?.id ?? 0,
        fecha_culminacion: c.fecha_culminacion
          ? new Date(c.fecha_culminacion)
          : undefined,
      })),
    },
  });

  const { fields, append, remove } = useFieldArray({
    name: "contrato",
    control: form.control,
  });

  const onSubmitFormity = (data: z.infer<typeof schemaUpdateContrato>) => {
    startTransition(async () => {
      const response = await updateInfoEmployee(
        { contrato: data.contrato?.map((c) => ({
          n_contrato: c.n_contrato,
          fecha_ingreso: c.fecha_ingreso,
          politica_id: c.politica_id,
          fecha_culminacion: c.fecha_culminacion ?? null,
        })) ?? [] },
        employee.id.toString(),
      );
      if (response.success) {
        toast.success(response.message);
        mutate([mutateKey, searchParams]);
      } else {
        toast.error(response.message);
      }
    });
  };

  const originalContratos = employee.contrato ?? [];

  return (
    <Card className="flex flex-col gap-3">
      <CardHeader>
        <CardTitle>Gestión de Contratos</CardTitle>
      </CardHeader>

      <CardContent>
        {isPending ? (
          <Loading promiseMessage="Actualizando Contratos" />
        ) : (
          <Form {...form}>
            <form
              className="flex flex-col gap-2"
              onSubmit={form.handleSubmit(onSubmitFormity)}
            >
              <div className="flex justify-end gap-2 mr-4 items-center">
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
              </div>
              <ScrollArea className="h-80 rounded-md w-full border p-2">
                {fields.length === 0 && (
                  <h1 className="text-gray-600 text-center py-4">
                    No hay contratos registrados.
                  </h1>
                )}
                {fields.map((field, index) => {
                  const isVencido =
                    originalContratos[index]?.estatus?.estatus === "VENCIDO";
                  const isExisting = !!originalContratos[index];
                  return (
                    <div
                      key={field.id}
                      className="flex flex-row gap-3 items-center justify-around w-full py-2 border-b"
                    >
                      {isVencido && (
                        <Badge className="bg-red-600 text-white text-xs absolute -top-1 left-1">
                          VENCIDO - Solo lectura
                        </Badge>
                      )}
                      <FormField
                        control={form.control}
                        name={`contrato.${index}.n_contrato`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">
                              {index + 1}. N° Contrato
                            </FormLabel>
                            <FormControl>
                              <input
                                {...field}
                                readOnly={isExisting}
                                className={`flex h-8 w-40 rounded-md border border-input bg-transparent px-2 py-1 text-sm ${isExisting ? 'opacity-50 cursor-not-allowed bg-muted' : ''}`}
                                placeholder="CTR-001"
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
                            <FormLabel className="text-xs">
                              Fecha Inicio
                            </FormLabel>
                            <Popover>
                              <PopoverTrigger asChild>
                                <FormControl>
                                  <Button
                                    variant="outline"
                                    disabled={isVencido}
                                    className="w-36 h-8 justify-between font-normal text-xs"
                                  >
                                    {field.value ? (
                                      formatInTimeZone(field.value, "UTC", "dd/MM/yyy")
                                    ) : (
                                      <span>Seleccione</span>
                                    )}
                                    <ChevronDownIcon className="h-3 w-3" />
                                  </Button>
                                </FormControl>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                  mode="single"
                                  selected={field.value}
                                  captionLayout="dropdown"
                                  disabled={(date) =>
                                    date > new Date() || date < new Date("1930-01-01")
                                  }
                                  onSelect={(date) => field.onChange(date)}
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
                            <FormLabel className="text-xs">
                              Fecha Culminación
                            </FormLabel>
                            <Popover>
                              <PopoverTrigger asChild>
                                <FormControl>
                                  <Button
                                    variant="outline"
                                    disabled={isVencido}
                                    className="w-36 h-8 justify-between font-normal text-xs"
                                  >
                                    {field.value ? (
                                      formatInTimeZone(field.value, "UTC", "dd/MM/yyy")
                                    ) : (
                                      <span>Seleccione</span>
                                    )}
                                    <ChevronDownIcon className="h-3 w-3" />
                                  </Button>
                                </FormControl>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                  mode="single"
                                  selected={field.value}
                                  captionLayout="dropdown"
                                  disabled={(date) => date < new Date("1930-01-01")}
                                  onSelect={(date) => field.onChange(date)}
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
                            <FormLabel className="text-xs">Política</FormLabel>
                            <Select
                              onValueChange={(v) => field.onChange(Number(v))}
                              value={field.value ? field.value.toString() : ""}
                              disabled={isVencido}
                            >
                              <FormControl>
                                <SelectTrigger className="w-36 h-8 text-xs">
                                  <SelectValue
                                    placeholder={
                                      isLoadingPoliticas ? "..." : "Seleccione"
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
                      {!isVencido && (
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          className="cursor-pointer mt-4"
                          onClick={() => remove(index)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  );
                })}
              </ScrollArea>
              <Button className="w-full cursor-pointer" disabled={isPending}>
                {isPending ? "Actualizando..." : "Guardar Cambios"}
              </Button>
            </form>
          </Form>
        )}
      </CardContent>
    </Card>
  );
}
