"use client";

import {
  getEmployeeById,
  getInternalReason,
  getStatusNomina,
} from "@/app/(protected)/dashboard/gestion-trabajadores/api/getInfoRac";
import ChangeStatusAction from "@/app/(protected)/dashboard/gestion-trabajadores/movimientos/cambiar-estatus/actions/actions-change-status";
import { schemaStatusChange } from "@/app/(protected)/dashboard/gestion-trabajadores/movimientos/cambiar-estatus/schema/schemaChangeStatus";
import { EmployeeData } from "@/app/types/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { zodResolver } from "@hookform/resolvers/zod";
import z from "zod";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import useSWR from "swr";
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
import Error from "../error/error";
import EmployeeSearchForm from "../employees/employee-search-form";
import { EmployeeInfoBanner } from "@/shared/components/employee-info-banner";
import { useEmployeeSearch } from "@/shared/hooks/useEmployeeSearch";
export function ChangeStatusForm() {
  const [isPending, startTransition] = useTransition();

  const { data: statusNomina, isLoading: isLoadingStatusNomina } = useSWR(
    "statusNomina",
    async () => await getStatusNomina(),
  );
  const { data: internalReason, isLoading: isLoadingInternalReason } = useSWR(
    "motionReason",
    async () => await getInternalReason(),
  );
  const form = useForm({
    resolver: zodResolver(schemaStatusChange),
    defaultValues: {
      estatus_id: 0,
      cargo: 0,
      motivo: 0,
    },
  });

  const { employee, isLoading, hasSearched, search, clear } =
    useEmployeeSearch<EmployeeData>({
      searchFn: getEmployeeById,
    });

  const onSubmit = (data: z.infer<typeof schemaStatusChange>) => {
    startTransition(async () => {
      const response = await ChangeStatusAction(data);
      if (response.success) {
        toast.success(response.message);
        clear();
        form.reset({
          cargo: 0,
          estatus_id: 0,
          motivo: 0,
        });
      } else {
        toast.error(response.message);
      }
    });
  };

  return (
    <>
      <Card>
        <CardHeader></CardHeader>
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
                  className="space-y-5"
                >
                  {employee !== null &&
                      employee.asignaciones != undefined &&
                      employee.asignaciones.length > 0 ? (
                        <>
                          <FormField
                            control={form.control}
                            name="cargo"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>
                                  Listado De Cargos Del Empleado
                                </FormLabel>
                                <Select
                                  onValueChange={(values) => {
                                    field.onChange(Number.parseInt(values));
                                  }}
                                >
                                  <FormControl>
                                    <SelectTrigger className="w-full truncate">
                                      <SelectValue
                                        placeholder={"Seleccione Un Código"}
                                      />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {employee.asignaciones.map((cargo, i) => (
                                      <SelectItem key={i} value={`${cargo.id}`}>
                                        {
                                          cargo.denominacioncargoespecifico
                                            .cargo
                                        }
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>

                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="estatus_id"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Listado De Estatus</FormLabel>
                                <Select
                                  onValueChange={(values) => {
                                    field.onChange(Number.parseInt(values));
                                  }}
                                >
                                  <FormControl>
                                    <SelectTrigger className="w-full truncate">
                                      <SelectValue
                                        placeholder={`${isLoadingStatusNomina ? "Cargando Estatus De Codigos" : "Seleccione Un Código"}`}
                                      />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {statusNomina?.data.map((status, i) => (
                                      <SelectItem
                                        key={i}
                                        value={`${status.id}`}
                                      >
                                        {status.estatus}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>

                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name="motivo"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>
                                  Motivo De Cambio De Estatus
                                </FormLabel>
                                <Select
                                  onValueChange={(values) => {
                                    field.onChange(Number.parseInt(values));
                                  }}
                                >
                                  <FormControl>
                                    <SelectTrigger className="w-full truncate">
                                      <SelectValue
                                        placeholder={`${isLoadingInternalReason ? "Cargando Motivos De Cambio De Estatus" : "Seleccione Un Motivo De Cambio de Estatus"}`}
                                      />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {internalReason?.data.map((reason, i) => (
                                      <SelectItem
                                        key={i}
                                        value={`${reason.id}`}
                                      >
                                        {reason.movimiento}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>

                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </>
                      ) : (
                        <Error errorMessage="El Trabajador No Posee Asignaciones De Cargo" />
                      )}
                  <Button disabled={isPending} className="w-full mt-2">
                    {isPending ? "Cargando..." : "Cambiar Estatus"}
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
