"use client";

import {
  getEmployeeById,
  getNominaPasivo,
  getReasonLeaving,
  getStatusEmployee,
} from "@/app/(protected)/dashboard/gestion-trabajadores/api/getInfoRac";
import GestionAction from "@/app/(protected)/dashboard/gestion-trabajadores/movimientos/cambiar-pasivo/actions/gestion-persona-action";
import { schemaPasivo } from "@/app/(protected)/dashboard/gestion-trabajadores/movimientos/cambiar-pasivo/schema/schemaPasivo";
import { EmployeeData } from "@/app/types/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import useSWR from "swr";
import z from "zod";
import { Button } from "../../../../../../components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
} from "../../../../../../components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "../../../../../../components/ui/form";
import { Input } from "../../../../../../components/ui/input";
import { Label } from "../../../../../../components/ui/label";
import { Switch } from "../../../../../../components/ui/switch";
import EmployeeSearchForm from "../employees/employee-search-form";
import { EmployeeInfoBanner } from "@/shared/components/employee-info-banner";
import { useEmployeeSearch } from "@/shared/hooks/useEmployeeSearch";
export function PasivoForm() {
  const [isPending, startTransition] = useTransition();

  const { data: nominaPasivo, isLoading: isLoadingNominaPasivo } = useSWR(
    "nominaPasivo",
    async () => await getNominaPasivo(),
  );
  const { data: statusEmployee, isLoading: isLoadingStatusEmployee } = useSWR(
    "statusEmployee",
    async () => await getStatusEmployee(),
  );
  const { data: reasonLeaving, isLoading: isLoadingReasonLeaving } = useSWR(
    "reasonLeaving",
    async () => await getReasonLeaving(),
  );

  const form = useForm({
    resolver: zodResolver(schemaPasivo),
    defaultValues: {
      estatus_id: 0,
      usuario_id: 0,
      motivo: 0,
      tiponominaid: 0,
      liberar_activos: false,
    },
  });

  const { employee, isLoading, hasSearched, search, clear } = useEmployeeSearch<EmployeeData>({
    searchFn: getEmployeeById,
  });

  const onSubmit = (data: z.infer<typeof schemaPasivo>) => {
    startTransition(async () => {
      if (employee && employee.cedulaidentidad) {
        const response = await GestionAction(
          data,
          employee.cedulaidentidad,
        );
        if (response.success) {
          toast.success(response.message);
          form.reset();
          clear();
        } else {
          toast.error(response.message);
        }
      }
    });
  };
  const estatusId = useWatch({
    control: form.control,
    name: "estatus_id",
  });

  const validatePeace =
    estatusId === statusEmployee?.data.find((v) => v.estatus === "PASIVO")?.id;
  return (
    <>
      <Card>
        <CardContent className="space-y-5">
          <EmployeeSearchForm onSearch={search} />

          <EmployeeInfoBanner
            employee={employee}
            hasSearched={hasSearched}
            isLoading={isLoading}
          />

          {employee && (
              <div>
                <Form {...form}>
                  <form
                    onSubmit={form.handleSubmit(onSubmit)}
                    className="space-y-2"
                  >
                    <FormField
                      control={form.control}
                      name="estatus_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Egresado/Pasivo</FormLabel>
                          <Select
                            onValueChange={(values) => {
                              field.onChange(Number.parseInt(values));
                            }}
                          >
                            <FormControl>
                              <SelectTrigger className="w-full truncate">
                                <SelectValue
                                  placeholder={`${isLoadingStatusEmployee ? "Cargando Listado" : "Seleccione Un Item"}  `}
                                />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {statusEmployee?.data.map((status, i) => (
                                <SelectItem key={i} value={`${status.id}`}>
                                  {status.estatus}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>

                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    {validatePeace && (
                      <>
                        <FormField
                          control={form.control}
                          name="tiponominaid"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>
                                Listado De Nominas De Jubilados
                              </FormLabel>
                              <Select
                                onValueChange={(values) => {
                                  field.onChange(Number.parseInt(values));
                                }}
                              >
                                <FormControl>
                                  <SelectTrigger className="w-full truncate">
                                    <SelectValue
                                      placeholder={`${isLoadingNominaPasivo ? "Cargando Nominas" : "Seleccione Una Nomina"}`}
                                    />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {nominaPasivo?.data.map((nomina, i) => (
                                    <SelectItem key={i} value={`${nomina.id}`}>
                                      {nomina.nomina}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>

                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <div className="flex flex-row gap-2 justify-end">
                          <Label>Desea Liberar El Cargo Activo</Label>
                          <Switch
                            onCheckedChange={(boolean) => {
                              form.setValue("liberar_activos", boolean);
                            }}
                          />
                        </div>
                      </>
                    )}
                    <FormField
                      control={form.control}
                      name="motivo"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Motivo De Egreso/Pasivo</FormLabel>
                          <Select
                            onValueChange={(values) => {
                              field.onChange(Number.parseInt(values));
                            }}
                          >
                            <FormControl>
                              <SelectTrigger className="w-full truncate">
                                <SelectValue
                                  placeholder={`${isLoadingReasonLeaving ? "Cargando Motivos De Egreso/Pasivo" : "Seleccione Un Motivo de Egreso/Pasivo"}`}
                                />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {reasonLeaving?.data.map((reason, i) => (
                                <SelectItem key={i} value={`${reason.id}`}>
                                  {reason.movimiento}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>

                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button className="w-full mt-2" disabled={isPending}>
                      {isPending ? "Cargando" : "Ejecutar Cambio"}
                    </Button>
                  </form>
                </Form>
              </div>
            )}
        </CardContent>
      </Card>
    </>
  );
}
