"use client";

import {
  getCodeListSearchFree,
  getCoordination,
  getDependency,
  getDirectionGeneralById,
  getDirectionLine,
  getEmployeeInfo,
  getNomina,
} from "@/app/(protected)/dashboard/gestion-trabajadores/api/getInfoRac";
import { AsignCode } from "@/app/(protected)/dashboard/gestion-trabajadores/movimientos/asignar-codigo/actions/asign-code";
import { schemaAsignCode } from "@/app/(protected)/dashboard/gestion-trabajadores/movimientos/asignar-codigo/schema/schema-asign-code";
import { EmployeeInfo } from "@/app/types/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eraser, Search } from "lucide-react";
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
import { Input } from "../../../../../../components/ui/input";
import Error from "../error/error";
import Loading from "../loading/loading";
import EmployeeSearchForm from "../employees/employee-search-form";
import { EmployeeInfoBanner } from "@/shared/components/employee-info-banner";
import { ContratoInlineForm } from "@/shared/components/contrato-inline-form";
import { useEmployeeSearch } from "@/shared/hooks/useEmployeeSearch";
export function AsigCode() {
  const [selectedCodeId, setSelectedCodeId] = useState<number>();
  const [selecteIdDirectionGeneral, setSelecteIdDirectionGeneral] =
    useState<string>();
  const [selecteIdDirectionLine, setSelecteIdDirectionLine] =
    useState<string>();
  const [isPending, startTransition] = useTransition();
  const [employeeReady, setEmployeeReady] = useState(false);
  const [dependencyId, setDependencyId] = useState<number>(0);

  const { data: directionGeneral, isLoading: isLoadingDirectionGeneral } =
    useSWR(
      dependencyId ? ["directionGeneral", dependencyId] : null,
      async () => await getDirectionGeneralById(dependencyId),
    );
  const { data: dependency, isLoading: isLoadingDependency } = useSWR(
    "dependency",
    async () => await getDependency(),
  );
  const { data: directionLine, isLoading: isLoadingDirectionLine } = useSWR(
    selecteIdDirectionGeneral
      ? ["directionLine", selecteIdDirectionGeneral]
      : "",
    async () => await getDirectionLine(selecteIdDirectionGeneral!),
  );
  const { data: coordination, isLoading: isLoadingCoordination } = useSWR(
    selecteIdDirectionLine ? ["coordination", selecteIdDirectionLine] : null,
    async () => await getCoordination(selecteIdDirectionLine!),
  );
  const [searchParams, setSearchParams] = useState<string>();
  const { data: codeList, isLoading: isLoadingSearchCode } = useSWR(
    searchParams,
    async () => await getCodeListSearchFree({ searchParams }),
  );
  const { data: nomina, isLoading: isLoadingNomina } = useSWR(
    "nominaGeneral",
    async () => await getNomina(),
  );

  const schemaSearch = z.object({
    tipo_nomina: z.coerce.number().optional(),
    codigo: z.string().optional(),
    dependencia_id: z.coerce.number().optional(),
    direccion_general_id: z.coerce.number().optional(),
    direccion_linea_id: z.coerce.number().optional(),
    coordinacion_id: z.coerce.number().optional(),
  });
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

  const formAsig = useForm({
    resolver: zodResolver(schemaAsignCode),
    defaultValues: {
      code: 0,
      employee: "",
    },
  });

  const onSubmit = (data: z.infer<typeof schemaAsignCode>) => {
    startTransition(async () => {
      const response = await AsignCode(data);
      if (response.success) {
        toast.success(response.message);
        clear();
      } else {
        toast.error(response.message);
      }
    });
  };

  const { employee, isLoading: isLoadingSearch, hasSearched, search, clear } =
    useEmployeeSearch<EmployeeInfo>({
      searchFn: getEmployeeInfo,
      onFound: (emp) => {
        formAsig.setValue("employee", emp.cedulaidentidad, {
          shouldValidate: true,
          shouldDirty: true,
        });
      },
    });

  return (
    <>
      {isPending ? (
        <Loading promiseMessage="Asigando Cargo" />
      ) : (
        <Card>
          <CardContent className="gap-5">
            <EmployeeSearchForm onSearch={search} />

            <EmployeeInfoBanner
              employee={employee}
              hasSearched={hasSearched}
              isLoading={isLoadingSearch}
            />

            <ContratoInlineForm
              employee={employee ? { id: employee.id, cedulaidentidad: employee.cedulaidentidad } : undefined}
              onSuccess={() => setEmployeeReady(true)}
            />

            {employee && employeeReady && (
              <div>
                <Form {...formAsig}>
                  <form onSubmit={formAsig.handleSubmit(onSubmit)}>
                    {codeList?.data.length! > 0 && (
                      <>
                        <FormField
                          control={formAsig.control}
                          name="code"
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
                                      placeholder={"Seleccione Un Codigo"}
                                    />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {codeList?.data.map((codes, i) => (
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
                        {codeList?.data.find(
                          (v) => v.id === selectedCodeId,
                        ) && (
                          <div className="rounded-sm border-2 border-b-emerald-400-400/45 bg-emerald-200/40 p-2 mt-4">
                            <p>
                              D / G / O:{" "}
                              {codeList?.data.find(
                                (v) => v.id === selectedCodeId,
                              )?.DireccionGeneral?.direccion_general ?? "N/A"}
                            </p>
                            <p>
                              {" "}
                              División / Coordinación:{" "}
                              {codeList?.data.find(
                                (v) => v.id === selectedCodeId,
                              )?.DireccionLinea?.direccion_linea ?? "N/A"}
                            </p>
                            <p>
                              {" "}
                              Coordinación:{" "}
                              {codeList?.data.find(
                                (v) => v.id === selectedCodeId,
                              )?.Coordinacion?.coordinacion
                                ? codeList?.data.find(
                                    (v) => v.id === selectedCodeId,
                                  )?.Coordinacion?.coordinacion
                                : "N/A"}
                            </p>
                            <p>
                              Organismo Adscrito:{" "}
                              {codeList?.data.find(
                                (v) => v.id === selectedCodeId,
                              )?.OrganismoAdscrito
                                ? codeList?.data.find(
                                    (v) => v.id === selectedCodeId,
                                  )?.OrganismoAdscrito?.Organismoadscrito
                                : "N/A"}
                            </p>
                            <p>
                              Grado:{" "}
                              {codeList?.data.find(
                                (v) => v.id === selectedCodeId,
                              )?.grado?.grado
                                ? codeList?.data.find(
                                    (v) => v.id === selectedCodeId,
                                  )?.grado?.grado
                                : "N/A"}
                            </p>
                            <p>
                              Cargo:{" "}
                              {
                                codeList?.data.find(
                                  (v) => v.id === selectedCodeId,
                                )?.denominacioncargo.cargo
                              }
                            </p>
                            <p>
                              Cargo Específico:{" "}
                              {
                                codeList?.data.find(
                                  (v) => v.id === selectedCodeId,
                                )?.denominacioncargoespecifico.cargo
                              }
                            </p>
                            <p>
                              Estatus:{" "}
                              {
                                codeList?.data.find(
                                  (v) => v.id === selectedCodeId,
                                )?.estatusid.estatus
                              }
                            </p>
                            <p>
                              Tipo De Nomina:{" "}
                              {
                                codeList?.data.find(
                                  (v) => v.id === selectedCodeId,
                                )?.tiponomina.nomina
                              }
                            </p>
                          </div>
                        )}

                        <Button
                          className="w-full mt-2 cursor-pointer"
                          disabled={isPending}
                        >
                          {isPending ? "Asignando Código" : "Asignar Código"}
                        </Button>
                      </>
                    )}

                    {codeList?.data.length! < 1 && (
                      <Error errorMessage="No Hay Codigos Vacantes Disponibles" />
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
