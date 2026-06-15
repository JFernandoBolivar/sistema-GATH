"use client";

import {
  getCodeListSearchFree,
  getCoordination,
  getDependency,
  getDirectionGeneralById,
  getDirectionLine,
  getEmployeeById,
  getMotionReason,
  getNomina,
} from "@/app/(protected)/dashboard/gestion-trabajadores/api/getInfoRac";
import { schemaChangeCode } from "@/app/(protected)/dashboard/gestion-trabajadores/movimientos/cambiar-codigo/schema/schemaChangeCode";
import { EmployeeData } from "@/app/types/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
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
import ChangeCodeActions from "../../movimientos/cambiar-codigo/actions/actions-change-code";
import Error from "../error/error";
import Loading from "../loading/loading";
import EmployeeSearchForm from "../employees/employee-search-form";
import { EmployeeInfoBanner } from "@/shared/components/employee-info-banner";
import { useEmployeeSearch } from "@/shared/hooks/useEmployeeSearch";
import { CodeFilterForm } from "./code-filter-form";
export function ChangeCodeForm() {
  const schemaSearch = z.object({
    tipo_nomina: z.coerce.number().optional(),
    codigo: z.string().optional(),
    dependencia_id: z.coerce.number().optional(),
    direccion_general_id: z.coerce.number().optional(),
    direccion_linea_id: z.coerce.number().optional(),
    coordinacion_id: z.coerce.number().optional(),
  });

  const [selectedCodeId, setSelectedCodeId] = useState<number>();
  const [isPending, startTransition] = useTransition();
  const [searchParams, setSearchParams] = useState<string>();

  const form = useForm({
    defaultValues: {
      codigo: "",
      tipo_nomina: undefined,
      dependencia_id: 0,
      direccion_general_id: 0,
      direccion_linea_id: 0,
      coordinacion_id: 0,
    },
    resolver: zodResolver(schemaSearch),
  });

  const formChangeCode = useForm({
    resolver: zodResolver(schemaChangeCode),
    defaultValues: {
      nuevo_cargo_id: 0,
      motivo: 0,
      code_old: 0,
    },
  });

  const watchedDependencia = form.watch("dependencia_id");
  const watchedDireccionGeneral = form.watch("direccion_general_id");
  const watchedDireccionLinea = form.watch("direccion_linea_id");

  const { data: directionGeneral, isLoading: isLoadingDirectionGeneral } =
    useSWR(
      watchedDependencia ? ["directionGeneral", watchedDependencia] : null,
      async () => await getDirectionGeneralById(watchedDependencia!),
    );
  const { data: dependency, isLoading: isLoadingDependency } = useSWR(
    "dependency",
    async () => await getDependency(),
  );
  const { data: directionLine, isLoading: isLoadingDirectionLine } = useSWR(
    watchedDireccionGeneral
      ? ["directionLine", watchedDireccionGeneral]
      : null,
    async () => await getDirectionLine(String(watchedDireccionGeneral)),
  );
  const { data: coordination, isLoading: isLoadingCoordination } = useSWR(
    watchedDireccionLinea ? ["coordination", watchedDireccionLinea] : null,
    async () => await getCoordination(String(watchedDireccionLinea)),
  );
  const { data: motionReason, isLoading: isLoadingMotionReason } = useSWR(
    "motionReason",
    async () => await getMotionReason(),
  );
  const { data: nomina, isLoading: isLoadingNomina } = useSWR(
    "nominaGeneral",
    async () => await getNomina(),
  );

  const { data: codeList } = useSWR(
    searchParams,
    async () => await getCodeListSearchFree({ searchParams }),
  );

  const onSearch = (values: z.infer<typeof schemaSearch>) => {
    if (values.dependencia_id && values.dependencia_id > 0 && (!values.direccion_general_id || values.direccion_general_id === 0)) {
      toast.error("Debe seleccionar una Gerencia u Oficina (Dirección General)");
      return;
    }
    const filteredEntries = Object.entries(values).filter(
      ([_, v]) => v !== "" && v !== 0 && v !== undefined && v !== null,
    );
    const params = new URLSearchParams(filteredEntries as unknown as string);
    setSearchParams(params.toString());
  };

  const cleanFields = () => {
    form.reset({
      codigo: "",
      tipo_nomina: undefined,
      coordinacion_id: undefined,
      dependencia_id: undefined,
      direccion_general_id: undefined,
      direccion_linea_id: undefined,
    });
  };

  const { employee, isLoading: isLoadingSearch, hasSearched, search, clear } =
    useEmployeeSearch<EmployeeData>({
      searchFn: getEmployeeById,
      namespace: "cambiar-codigo",
    });

  const onSubmit = (data: z.infer<typeof schemaChangeCode>) => {
    startTransition(async () => {
      const response = await ChangeCodeActions(data);
      if (response.success) {
        toast.success(response.message);
        formChangeCode.reset({
          code_old: 0,
          motivo: 0,
          nuevo_cargo_id: 0,
        });
        form.reset({
          codigo: "",
          tipo_nomina: undefined,
          coordinacion_id: 0,
          dependencia_id: 0,
          direccion_general_id: 0,
          direccion_linea_id: 0,
        });
        clear();
      } else {
        toast.error(response.message);
      }
    });
  };

  return (
    <>
      {isPending ? (
        <Loading promiseMessage="Cambiando Cargo..." />
      ) : (
        <Card className="bg-white">
          <CardContent className="gap-5">
            <EmployeeSearchForm onSearch={search} />

            <EmployeeInfoBanner
              employee={employee}
              hasSearched={hasSearched}
              isLoading={isLoadingSearch}
            />

            {employee && (
              <>
                <CodeFilterForm
                  form={form}
                  dependencyData={dependency?.data}
                  directionGeneralData={directionGeneral?.data}
                  directionLineData={directionLine?.data}
                  coordinationData={coordination?.data}
                  nominaData={nomina?.data}
                  isLoadingDependency={isLoadingDependency}
                  isLoadingDirectionGeneral={isLoadingDirectionGeneral}
                  isLoadingDirectionLine={isLoadingDirectionLine}
                  isLoadingCoordination={isLoadingCoordination}
                  isLoadingNomina={isLoadingNomina}
                  onSearch={onSearch}
                  onClean={cleanFields}
                />
              </>
            )}
            {employee && (
              <div>
                <Form {...formChangeCode}>
                  <form
                    onSubmit={formChangeCode.handleSubmit(onSubmit)}
                    className="gap-5"
                  >
                    <FormField
                      control={formChangeCode.control}
                      name="code_old"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Listado De Cargos Del Empleado</FormLabel>
                          <Select
                            onValueChange={(values) => {
                              field.onChange(Number.parseInt(values));
                            }}
                          >
                            <FormControl>
                              <SelectTrigger className="w-full truncate">
                                <SelectValue
                                  placeholder={
                                    "Seleccione Un Cargo Del Empleado"
                                  }
                                />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {employee.asignaciones?.map((codes, i) => (
                                <SelectItem key={i} value={`${codes.id}`}>
                                  {codes.codigo} -{" "}
                                  {codes.denominacioncargoespecifico.cargo}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>

                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    {codeList?.data && codeList.data.length > 0 ? (
                      <>
                        <FormField
                          control={formChangeCode.control}
                          name="nuevo_cargo_id"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>
                                Listado De Codigos Disponibles
                              </FormLabel>
                              <Select
                                onValueChange={(values) => {
                                  field.onChange(Number.parseInt(values));
                                  setSelectedCodeId(Number.parseInt(values));
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
                                  {codeList.data.map((codes, i) => (
                                    <SelectItem key={i} value={`${codes.id}`}>
                                      {codes.codigo} -{" "}
                                      {codes.denominacioncargo.cargo}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>

                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={formChangeCode.control}
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
                                      placeholder={`${
                                        isLoadingMotionReason
                                          ? "Cargando Motivos De Cambio De Cargo"
                                          : "Seleccione Un Código"
                                      }`}
                                    />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {motionReason?.data.map((reason, i) => (
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
                        {codeList.data.find(
                          (v) => v.id === selectedCodeId,
                        ) && (
                          <div className="rounded-sm border-2 border-b-emerald-400-400/45 bg-emerald-200/40 p-2 mt-4">
                            <p>
                              D / G / O:{" "}
                              {codeList.data.find(
                                (v) => v.id === selectedCodeId,
                              )?.DireccionGeneral?.direccion_general ?? "N/A"}
                            </p>
                            <p>
                              {" "}
                              División / Coordinación:{" "}
                              {codeList.data.find(
                                (v) => v.id === selectedCodeId,
                              )?.DireccionLinea?.direccion_linea ?? "N/A"}
                            </p>
                            <p>
                              {" "}
                              Coordinacion:{" "}
                              {codeList.data.find(
                                (v) => v.id === selectedCodeId,
                              )?.Coordinacion?.coordinacion
                                ? codeList.data.find(
                                    (v) => v.id === selectedCodeId,
                                  )?.Coordinacion?.coordinacion
                                : "N/A"}
                            </p>
                            <p>
                              Organismo Adscrito:{" "}
                              {codeList.data.find(
                                (v) => v.id === selectedCodeId,
                              )?.OrganismoAdscrito
                                ? codeList.data.find(
                                    (v) => v.id === selectedCodeId,
                                  )?.OrganismoAdscrito?.Organismoadscrito
                                : "N/A"}
                            </p>
                            <p>
                              Grado:{" "}
                              {codeList.data.find(
                                (v) => v.id === selectedCodeId,
                              )?.grado?.grado
                                ? codeList.data.find(
                                    (v) => v.id === selectedCodeId,
                                  )?.grado?.grado
                                : "N/A"}
                            </p>
                            <p>
                              Cargo:{" "}
                              {
                                codeList.data.find(
                                  (v) => v.id === selectedCodeId,
                                )?.denominacioncargo.cargo
                              }
                            </p>
                            <p>
                              Cargo Especifico:{" "}
                              {
                                codeList.data.find(
                                  (v) => v.id === selectedCodeId,
                                )?.denominacioncargoespecifico.cargo
                              }
                            </p>
                            <p>
                              Estatus:{" "}
                              {
                                codeList.data.find(
                                  (v) => v.id === selectedCodeId,
                                )?.estatusid.estatus
                              }
                            </p>
                            <p>
                              Tipo De Nomina:{" "}
                              {
                                codeList.data.find(
                                  (v) => v.id === selectedCodeId,
                                )?.tiponomina.nomina
                              }
                            </p>
                          </div>
                        )}
                        <Button className="w-full mt-2" disabled={isPending}>
                          {isPending ? "Cargando..." : "Cambiar Codigo"}
                        </Button>
                      </>
                    ) : (
                      <Error
                        errorMessage="Direccion Administrativa No Posee Cargos Vacantes"
                        className="scale-100"
                      />
                    )}
                  </form>
                </Form>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </>
  );
}
