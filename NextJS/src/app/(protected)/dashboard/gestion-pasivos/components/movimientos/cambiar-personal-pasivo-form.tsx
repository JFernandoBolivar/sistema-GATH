"use client";

import {
  getPasiveById,
  getReasonLeavingPasive,
  getStatusEmployee,
} from "@/app/(protected)/dashboard/gestion-trabajadores/api/getInfoRac";
import { ApiResponse, EmployeeData } from "@/app/types/types";
import { SelectForm } from "@/components/select-form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Search } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { toast } from "sonner";
import useSWR from "swr";
import z from "zod";
import { Button } from "../../../../../../components/ui/button";
import { Card, CardContent } from "../../../../../../components/ui/card";
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
import Error from "../../../gestion-trabajadores/components/error/error";
import { getFamilyPasiveOne } from "../../api/getInfoPasive";
import GestionAction from "../../movimientos/cambiar-pasivo/actions/gestion-persona-action";
import { schemaPasivo } from "../../movimientos/cambiar-pasivo/schema/schemaPasivo";
export function PasivoPasiveForm() {
  const [surivor, setSurvivor] = useState<boolean>(false);
  const [employee, setEmployee] = useState<ApiResponse<EmployeeData>>();
  const [isPending, startTransition] = useTransition();
  const { data: familyPasive, isLoading: isLoadingFamilyPasive } = useSWR(
    employee?.data.id ? "api/family/pasive" : null,
    async () => await getFamilyPasiveOne(employee?.data.id!),
  );
  const { data: statusEmployee, isLoading: isLoadingStatusEmployee } = useSWR(
    "statusEmployee",
    async () => await getStatusEmployee(),
  );
  const { data: reasonLeaving, isLoading: isLoadingReasonLeaving } = useSWR(
    "reasonLeavingF",
    async () => await getReasonLeavingPasive(),
  );

  const form = useForm({
    resolver: zodResolver(schemaPasivo),
    defaultValues: {
      estatus_id: 0,
      usuario_id: 0,
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
      setEmployee(response);
    }
  };
  const formSearch = useForm({
    defaultValues: {
      searchEmployeeForm: "",
    },
    resolver: zodResolver(schemaSearchEmployee),
  });
  const { append, remove, fields } = useFieldArray<
    z.infer<typeof schemaPasivo>
  >({
    name: "sobrevivientes",
    control: form.control,
  });
  const onSubmit = (data: z.infer<typeof schemaPasivo>) => {
    startTransition(async () => {
      if (!Array.isArray(employee) && employee?.data.cedulaidentidad) {
        const response = await GestionAction(
          data,
          employee.data.cedulaidentidad,
        );
        if (response.success) {
          toast.success(response.message);
        } else {
          toast.error(response.message);
        }
      }
    });
  };
  useEffect(() => {
    if (!surivor && fields.length > 0) {
      remove();
    }
  }, [surivor, fields.length, remove]);
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
                    <FormLabel>Buscar Personal Jubilado/Pasivo</FormLabel>
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
          {employee && employee?.status !== "error" && (
            <div className={` rounded-sm p-2 `}>
              {!Array.isArray(employee) && (
                <div className="flex flex-row gap-2  border-2 border-blue-400/45 bg-blue-200/40 p-2 rounded-sm">
                  <p>Nombres: {employee.data.nombres}</p>
                  <p>Cedula: {employee.data.cedulaidentidad}</p>
                </div>
              )}
            </div>
          )}
          {employee && employee?.status == "error" && (
            <Error errorMessage="Cédula Invalida" />
          )}

          {employee &&
            !Array.isArray(employee) &&
            employee?.status !== "error" && (
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
                          <FormLabel>Egresar</FormLabel>
                          <Select
                            onValueChange={(values) => {
                              field.onChange(Number.parseInt(values));
                            }}
                          >
                            <FormControl>
                              <SelectTrigger className="w-full truncate">
                                <SelectValue
                                  placeholder={`${isLoadingStatusEmployee ? "Cargando Listado" : "Seleccione Un Elemento"}  `}
                                />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {statusEmployee?.data
                                .filter((v) => v.estatus === "EGRESADO")
                                .map((status, i) => (
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
                    <div className="flex flex-col gap-2">
                      <FormField
                        control={form.control}
                        name="motivo"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Motivo De Egreso</FormLabel>
                            <Select
                              onValueChange={(values) => {
                                field.onChange(Number.parseInt(values));
                              }}
                            >
                              <FormControl>
                                <SelectTrigger className="w-full truncate">
                                  <SelectValue
                                    placeholder={`${isLoadingReasonLeaving ? "Cargando Motivos De Cambio De Cargo" : "Seleccione Un Código"}`}
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
                      <div className="self-end flex flex-row gap-2 items-center">
                        <Label>
                          <Switch onCheckedChange={setSurvivor} />
                          Seleccionar Pensionado Sobreviviente
                        </Label>
                      </div>
                    </div>
                    {surivor && (
                      <div className="flex flex-col">
                        <div className="self-end flex flex-row gap-2">
                          <Button
                            onClick={() =>
                              append({
                                cedula_familiar: "",
                              })
                            }
                            type="button"
                          >
                            <Plus />
                            Agregar
                          </Button>
                        </div>
                        <div>
                              {fields.map((_, i) => (
                            <div className="flex flex-row gap-2" key={i}>
                              <SelectForm
                                form={form}
                                Formlabel="Seleccionar un familiar"
                                isLoading={isLoadingFamilyPasive}
                                nameSalect={`sobrevivientes.${i}.cedula_familiar`}
                                placeholder="Seleccionar un familiar"
                                SelectLabelItem="Seleccionar un familiar"
                                options={familyPasive?.data ?? []}
                                labelKey={`primer_nombre`}
                                valueKey="cedulaFamiliar"
                                classNameItem="grow"
                              />
                              <Button
                                variant={"destructive"}
                                className="self-baseline-last"
                                onClick={() => remove(i)}
                              >
                                Eliminar
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
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
