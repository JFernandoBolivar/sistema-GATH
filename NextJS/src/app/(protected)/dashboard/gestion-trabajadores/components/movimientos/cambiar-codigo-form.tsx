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
import ChangeCodeActions from "../../movimientos/cambiar-codigo/actions/actions-change-code";
import Error from "../error/error";
import Loading from "../loading/loading";
import EmployeeSearchForm from "../employees/employee-search-form";
import { EmployeeInfoBanner } from "@/shared/components/employee-info-banner";
import { useEmployeeSearch } from "@/shared/hooks/useEmployeeSearch";
export function ChangeCodeForm() {
  const [searchParams, setSearchParams] = useState<string>();
  const schemaSearch = z.object({
    tipo_nomina: z.coerce.number().optional(),
    codigo: z.string().optional(),
    dependencia_id: z.coerce.number().optional(),
    direccion_general_id: z.coerce.number().optional(),
    direccion_linea_id: z.coerce.number().optional(),
    coordinacion_id: z.coerce.number().optional(),
  });
  const [dependencyId, setDependencyId] = useState<number>(0);

  const [selectedCodeId, setSelectedCodeId] = useState<number>();
  const [selecteIdDirectionGeneral, setSelecteIdDirectionGeneral] =
    useState<string>();
  const [selecteIdDirectionLine, setSelecteIdDirectionLine] =
    useState<string>();
  const [isPending, startTransition] = useTransition();
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

  const { data: motionReason, isLoading: isLoadingMotionReason } = useSWR(
    "motionReason",
    async () => await getMotionReason(),
  );
  const { data: nomina, isLoading: isLoadingNomina } = useSWR(
    "nominaGeneral",
    async () => await getNomina(),
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
  const { data: codeList, isLoading: isLoadingSearchCode } = useSWR(
    searchParams,
    async () => await getCodeListSearchFree({ searchParams }),
  );
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

  const { employee, isLoading: isLoadingSearch, hasSearched, search, clear } =
    useEmployeeSearch<EmployeeData>({
      searchFn: getEmployeeById,
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
  const formChangeCode = useForm({
    resolver: zodResolver(schemaChangeCode),
    defaultValues: {
      nuevo_cargo_id: 0,
      motivo: 0,
      code_old: 0,
    },
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

  return (
    <>
      {isPending ? (
        <Loading promiseMessage="Cambiando Cargo..." />
      ) : (
        <Card>
          <CardContent className="space-y-5">
            <EmployeeSearchForm onSearch={search} />

            <EmployeeInfoBanner
              employee={employee}
              hasSearched={hasSearched}
              isLoading={isLoadingSearch}
            />

            {employee && (
              <div className="space-y-5">
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSearch)}>
                    <div className="flex flex-row items-center gap-2 w-full flex-1">
                      <div className="grid grid-cols-2 gap-2 w-full">
                        <FormField
                          name="codigo"
                          control={form.control}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Buscar Código </FormLabel>
                              <FormControl>
                                <Input
                                  type="text"
                                  placeholder="buscar codigo..."
                                  {...field}
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="tipo_nomina"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Tipo de Nomina</FormLabel>
                              <Select
                                onValueChange={(values) => {
                                  field.onChange(Number.parseInt(values));
                                }}
                              >
                                <FormControl>
                                  <SelectTrigger className="w-full truncate">
                                    <SelectValue
                                      placeholder={`${
                                        isLoadingNomina
                                          ? "Cargando Nominas"
                                          : "Seleccione un Tipo de Nomina"
                                      }`}
                                    />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="0">Ninguno</SelectItem>
                                  {nomina?.data.map((nomina, i) => (
                                    <SelectItem key={i} value={`${nomina.id}`}>
                                      {nomina.nomina}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />{" "}
                        <FormField
                          control={form.control}
                          name="dependencia_id"
                          render={({ field }) => (
                            <FormItem className="col-span-2">
                              <FormLabel>Nivel</FormLabel>
                              <Select
                                onValueChange={(values) => {
                                  field.onChange(Number.parseInt(values));
                                  setDependencyId(Number.parseInt(values));
                                }}
                              >
                                <FormControl>
                                  <SelectTrigger className="w-full truncate">
                                    <SelectValue
                                      placeholder={`${
                                        isLoadingDependency
                                          ? "Cargando Niveles"
                                          : "Seleccione un Nivel"
                                      }`}
                                    />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {dependency?.data.map((dependencia, i) => (
                                    <SelectItem
                                      key={i}
                                      value={`${dependencia.id}`}
                                    >
                                      {dependencia.dependencia}
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
                          name="direccion_general_id"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>
                                Dirección / Gerencia / Oficina
                              </FormLabel>
                              <Select
                                onValueChange={(values) => {
                                  field.onChange(Number.parseInt(values));
                                  setSelecteIdDirectionGeneral(values);
                                }}
                              >
                                <FormControl>
                                  <SelectTrigger className="w-full truncate">
                                    <SelectValue
                                      placeholder={`${
                                        isLoadingDirectionGeneral
                                          ? "Cargando Direcciones"
                                          : "Seleccione una Dirección"
                                      }`}
                                    />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {directionGeneral?.data.map((general, i) => (
                                    <SelectItem key={i} value={`${general.id}`}>
                                      {general.Codigo}-
                                      {general.direccion_general}
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
                          name="direccion_linea_id"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>División / Coordinación</FormLabel>
                              <Select
                                onValueChange={(values) => {
                                  field.onChange(Number.parseInt(values));
                                  setSelecteIdDirectionLine(values);
                                }}
                              >
                                <FormControl>
                                  <SelectTrigger className="w-full truncate">
                                    <SelectValue
                                      placeholder={`${
                                        isLoadingDirectionLine
                                          ? "Cargando Dirección"
                                          : "Seleccione una Dirección"
                                      }`}
                                    />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {directionLine?.data.map((line, i) => (
                                    <SelectItem key={i} value={`${line.id}`}>
                                      {line.Codigo}-{line.direccion_linea}
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
                          name="coordinacion_id"
                          render={({ field }) => (
                            <FormItem className="col-span-2">
                              <FormLabel>Coordinación</FormLabel>
                              <Select
                                onValueChange={(values) => {
                                  field.onChange(Number.parseInt(values));
                                }}
                              >
                                <FormControl>
                                  <SelectTrigger className="w-full truncate">
                                    <SelectValue
                                      placeholder={`${
                                        isLoadingCoordination
                                          ? "Cargando Coordinaciones"
                                          : "Seleccione una Coordinación"
                                      }`}
                                    />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {coordination?.data.map((coord, i) => (
                                    <SelectItem key={i} value={`${coord.id}`}>
                                      {coord.Codigo}-{coord.coordinacion}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>

                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <Button className="cursor-pointer self-baseline-last">
                          Buscar <Search />
                        </Button>
                        <Button
                          variant={"outline"}
                          className="cursor-pointer self-baseline-last"
                          type="button"
                          onClick={cleanFields}
                        >
                          Limpiar <Eraser />
                        </Button>
                      </div>
                    </div>
                  </form>
                </Form>
              </div>
            )}
            {employee && (
              <div>
                <Form {...formChangeCode}>
                  <form
                    onSubmit={formChangeCode.handleSubmit(onSubmit)}
                    className="space-y-5"
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
                              {employee.asignaciones.map((codes, i) => (
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
                    {codeList?.data?.length! > 0 ? (
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
                                  {codeList?.data.map((codes, i) => (
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
