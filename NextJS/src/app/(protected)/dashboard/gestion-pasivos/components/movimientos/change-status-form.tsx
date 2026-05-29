"use client";

import {
  getEmployeeById,
  getInternalReason,
  getPasiveById,
  getStatusNomina,
} from "@/app/(protected)/dashboard/gestion-trabajadores/api/getInfoRac";
import ChangeStatusAction from "@/app/(protected)/dashboard/gestion-trabajadores/movimientos/cambiar-estatus/actions/actions-change-status";
import { schemaStatusChange } from "@/app/(protected)/dashboard/gestion-trabajadores/movimientos/cambiar-estatus/schema/schemaChangeStatus";
import { ApiResponse, EmployeeData } from "@/app/types/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { zodResolver } from "@hookform/resolvers/zod";
import { Search } from "lucide-react";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
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
import Error from "../../../gestion-trabajadores/components/error/error";
import { getInternalReasonPasive } from "../../api/getInfoPasive";
export function ChangeStatusPasiveForm() {
  const [isPending, startTransition] = useTransition();
  const [employee, setEmployee] = useState<EmployeeData>();

  const { data: statusNomina, isLoading: isLoadingStatusNomina } = useSWR(
    "statusNomina",
    async () => await getStatusNomina(),
  );
  const { data: internalReason, isLoading: isLoadingInternalReason } = useSWR(
    "motionReasonPasive",
    async () => await getInternalReasonPasive(),
  );
  const form = useForm({
    resolver: zodResolver(schemaStatusChange),
    defaultValues: {
      estatus_id: 0,
      cargo: 0,
      motivo: 0,
    },
  });

  const schemaSearchEmployee = z.object({
    searchEmployeeForm: z.string(),
  });
  const handleSearch = async (values: z.infer<typeof schemaSearchEmployee>) => {
    if (!values.searchEmployeeForm) return;
    const response = await getPasiveById(values.searchEmployeeForm);
    if (response.data && response.data !== undefined) {
      setEmployee(response.data);
    }
  };
  const formSearch = useForm({
    defaultValues: {
      searchEmployeeForm: "",
    },
    resolver: zodResolver(schemaSearchEmployee),
  });
  const onSubmit = (data: z.infer<typeof schemaStatusChange>) => {
    startTransition(async () => {
      const response = await ChangeStatusAction(data);
      if (response.success) {
        toast.success(response.message);
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
        <CardContent className="space-y-5">
          <Form {...formSearch}>
            <form
              className="flex flex-row justify-between  gap-2"
              onSubmit={formSearch.handleSubmit(handleSearch)}
            >
              <FormField
                name="searchEmployeeForm"
                control={formSearch.control}
                render={({ field }) => (
                  <FormItem className="flex-1 ">
                    <FormLabel>Buscar Personal Pasivo/Jubilado</FormLabel>
                    <FormControl>
                      <Input placeholder="00000000" type="number" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <Button className="self-baseline-last cursor-pointer">
                <Search className="h-4 w-4" />
              </Button>
            </form>
          </Form>
          {employee && (
            <div className={` rounded-sm p-2 `}>
              {!Array.isArray(employee) ? (
                <div className="flex flex-row gap-2  border-2 border-blue-400/45 bg-blue-200/40 p-2 rounded-sm">
                  <p>Nombres: {employee.nombres}</p>
                  <p>Cedula: {employee.cedulaidentidad}</p>
                </div>
              ) : (
                <Error errorMessage="Cédula Invalida" />
              )}
            </div>
          )}
          {employee && !Array.isArray(employee) && (
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
                                    {cargo.denominacioncargoespecifico.cargo}
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
                      <FormField
                        control={form.control}
                        name="motivo"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Motivo De Cambio De Cargo</FormLabel>
                            <Select
                              onValueChange={(values) => {
                                field.onChange(Number.parseInt(values));
                              }}
                            >
                              <FormControl>
                                <SelectTrigger className="w-full truncate">
                                  <SelectValue
                                    placeholder={`${isLoadingInternalReason ? "Cargando Motivos De Cambio De Cargo" : "Seleccione Un Motivo De Cambio de Cargo"}`}
                                  />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {internalReason?.data.map((reason, i) => (
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
