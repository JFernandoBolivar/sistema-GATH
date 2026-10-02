"use client";

import { useState, useTransition, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { Button } from "@/shared/ui/components/button";
import { Card, CardContent } from "@/shared/ui/components/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Combobox } from "@/shared/ui/components/combobox";
import { Loading } from "@/shared/ui/components/loading";
import { EmployeeSearchForm } from "@/shared/components/employee-search-form";
import { EmployeeInfoBanner } from "@/shared/components/employee-info-banner";
import { ContratoInlineForm } from "@/shared/components/contrato-inline-form";
import { CodeFilterForm } from "./components/code-filter-form";
import { ErrorCard } from "./components/error-card";

import { getEmpleadoPorCedulaAction } from "@/shared/infrastructure/actions/employee-actions";
import type { EmpleadoDTO } from "@/shared/types/employee-dto";
import {
  getCargosVacantesAction,
  asignarCargoAction,
  getDependenciasAction,
  getDireccionesGeneralesAction,
  getDireccionesLineaAction,
  getCoordinacionesAction,
  getTiposNominaAction,
} from "@/modules/cargos/infrastructure/actions/cargos-actions";
import type {
  CargoAsignacionDTO,
  CatalogoCargoItemDTO,
  UnidadOrganizativaCargoDTO,
} from "@/modules/cargos/application/dtos/cargo-dto";
import {
  schemaAsignCode,
  schemaFilterForm,
  type SchemaAsignCodeType,
  type SchemaFilterFormType,
} from "@/modules/cargos/ui/schema/schema-asignar-cargo";

export function AsignarCargoPage() {
  const [selectedCodeId, setSelectedCodeId] = useState<number>();
  const [isPending, startTransition] = useTransition();
  const [employeeReady, setEmployeeReady] = useState(false);
  const [codeList, setCodeList] = useState<CargoAsignacionDTO[] | null>(null);
  const [hasSearchedCodes, setHasSearchedCodes] = useState(false);

  // Catalog state
  const [dependencias, setDependencias] = useState<UnidadOrganizativaCargoDTO[]>([]);
  const [direccionesGenerales, setDireccionesGenerales] = useState<UnidadOrganizativaCargoDTO[]>([]);
  const [direccionesLinea, setDireccionesLinea] = useState<UnidadOrganizativaCargoDTO[]>([]);
  const [coordinaciones, setCoordinaciones] = useState<UnidadOrganizativaCargoDTO[]>([]);
  const [tiposNomina, setTiposNomina] = useState<CatalogoCargoItemDTO[]>([]);

  const [isLoadingDependency, setIsLoadingDependency] = useState(true);
  const [isLoadingDirectionGeneral, setIsLoadingDirectionGeneral] = useState(false);
  const [isLoadingDirectionLine, setIsLoadingDirectionLine] = useState(false);
  const [isLoadingCoordination, setIsLoadingCoordination] = useState(false);
  const [isLoadingNomina, setIsLoadingNomina] = useState(true);

  const form = useForm<SchemaFilterFormType>({
    resolver: zodResolver(schemaFilterForm),
    defaultValues: {
      codigo: "",
      tipo_nomina: undefined,
      dependencia_id: 0,
      direccion_general_id: 0,
      direccion_linea_id: 0,
      coordinacion_id: 0,
    },
  });

  const formAsig = useForm<SchemaAsignCodeType>({
    resolver: zodResolver(schemaAsignCode),
    defaultValues: {
      code: 0,
      employee: "",
    },
  });

  const watchedDependencia = form.watch("dependencia_id");
  const watchedDireccionGeneral = form.watch("direccion_general_id");
  const watchedDireccionLinea = form.watch("direccion_linea_id");

  // Load initial catalogs (dependencias, nominas)
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [deps, noms] = await Promise.all([
          getDependenciasAction(),
          getTiposNominaAction(),
        ]);
        if (!active) return;
        setDependencias(deps);
        setTiposNomina(noms);
      } catch {
        // Silencioso
      } finally {
        if (active) {
          setIsLoadingDependency(false);
          setIsLoadingNomina(false);
        }
      }
    })();
    return () => { active = false; };
  }, []);

  // Cascading: watchedDependencia -> direccionesGenerales
  useEffect(() => {
    if (!watchedDependencia || Number(watchedDependencia) === 0) {
      setDireccionesGenerales([]);
      form.setValue("direccion_general_id", 0);
      form.setValue("direccion_linea_id", 0);
      form.setValue("coordinacion_id", 0);
      return;
    }
    let active = true;
    setIsLoadingDirectionGeneral(true);
    getDireccionesGeneralesAction(Number(watchedDependencia))
      .then((data) => {
        if (active) setDireccionesGenerales(data);
      })
      .finally(() => {
        if (active) setIsLoadingDirectionGeneral(false);
      });
    return () => { active = false; };
  }, [watchedDependencia, form]);

  // Cascading: watchedDireccionGeneral -> direccionesLinea
  useEffect(() => {
    if (!watchedDireccionGeneral || Number(watchedDireccionGeneral) === 0) {
      setDireccionesLinea([]);
      form.setValue("direccion_linea_id", 0);
      form.setValue("coordinacion_id", 0);
      return;
    }
    let active = true;
    setIsLoadingDirectionLine(true);
    getDireccionesLineaAction(Number(watchedDireccionGeneral))
      .then((data) => {
        if (active) setDireccionesLinea(data);
      })
      .finally(() => {
        if (active) setIsLoadingDirectionLine(false);
      });
    return () => { active = false; };
  }, [watchedDireccionGeneral, form]);

  // Cascading: watchedDireccionLinea -> coordinaciones
  useEffect(() => {
    if (!watchedDireccionLinea || Number(watchedDireccionLinea) === 0) {
      setCoordinaciones([]);
      form.setValue("coordinacion_id", 0);
      return;
    }
    let active = true;
    setIsLoadingCoordination(true);
    getCoordinacionesAction(Number(watchedDireccionLinea))
      .then((data) => {
        if (active) setCoordinaciones(data);
      })
      .finally(() => {
        if (active) setIsLoadingCoordination(false);
      });
    return () => { active = false; };
  }, [watchedDireccionLinea, form]);

  const onSearch = (values: SchemaFilterFormType) => {
    if (values.dependencia_id && values.dependencia_id > 0 && (!values.direccion_general_id || values.direccion_general_id === 0)) {
      toast.error("Debe seleccionar una Gerencia u Oficina (Dirección General)");
      return;
    }

    startTransition(async () => {
      try {
        const results = await getCargosVacantesAction({
          dependenciaId: values.dependencia_id ? Number(values.dependencia_id) : undefined,
          tipoNominaId: values.tipo_nomina ? Number(values.tipo_nomina) : undefined,
          direccionGeneralId: values.direccion_general_id ? Number(values.direccion_general_id) : undefined,
          direccionLineaId: values.direccion_linea_id ? Number(values.direccion_linea_id) : undefined,
          coordinacionId: values.coordinacion_id ? Number(values.coordinacion_id) : undefined,
          codigo: values.codigo?.trim() || undefined,
        });
        setCodeList(results);
        setHasSearchedCodes(true);
        setSelectedCodeId(undefined);
        formAsig.setValue("code", 0);
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "Error al buscar cargos vacantes");
      }
    });
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
    setCodeList(null);
    setHasSearchedCodes(false);
    setSelectedCodeId(undefined);
    formAsig.setValue("code", 0);
  };

  const [employee, setEmployee] = useState<EmpleadoDTO | null>(null);
  const [isLoadingSearch, setIsLoadingSearch] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [employeeError, setEmployeeError] = useState<string | null>(null);

  const handleSearchEmployee = async (cedula: string) => {
    const term = cedula.trim();
    if (!term) return;
    setIsLoadingSearch(true);
    setHasSearched(true);
    setEmployeeError(null);
    try {
      const res = await getEmpleadoPorCedulaAction(term);
      if (res && "cedula" in res) {
        setEmployee(res);
        formAsig.setValue("employee", res.cedula, {
          shouldValidate: true,
          shouldDirty: true,
        });
        const hasContratoActivo =
          !!res.contratoActual &&
          res.contratoActual.estatusNombre !== "VENCIDO" &&
          res.contratoActual.estatusNombre !== "CULMINADO";
        setEmployeeReady(hasContratoActivo);
      } else {
        setEmployee(null);
        setEmployeeReady(false);
        const err = res && "error" in res ? res.error : "Trabajador no encontrado";
        setEmployeeError(err);
      }
    } catch {
      setEmployee(null);
      setEmployeeReady(false);
      setEmployeeError("Error al consultar el trabajador");
    } finally {
      setIsLoadingSearch(false);
    }
  };

  const clearEmployee = () => {
    setEmployee(null);
    setHasSearched(false);
    setEmployeeReady(false);
    setEmployeeError(null);
    formAsig.setValue("employee", "");
  };

  useEffect(() => {
    if (!employee) {
      setEmployeeReady(false);
      setCodeList(null);
      setHasSearchedCodes(false);
      setSelectedCodeId(undefined);
    }
  }, [employee]);

  const onSubmit = (data: SchemaAsignCodeType) => {
    startTransition(async () => {
      const response = await asignarCargoAction(data.code, data.employee);
      if ("error" in response) {
        toast.error(response.error);
      } else {
        toast.success("Código asignado exitosamente");
        clearEmployee();
        formAsig.reset();
        cleanFields();
      }
    });
  };

  const selectedCode = codeList?.find((v) => v.id === selectedCodeId);

  return (
    <>
      {isPending ? (
        <Loading promiseMessage="Asignando Cargo" />
      ) : (
        <Card className="bg-white">
          <CardContent className="gap-5">
            <EmployeeSearchForm onSearch={handleSearchEmployee} />

            <EmployeeInfoBanner
              employee={
                employee
                  ? {
                      nombres: employee.nombres,
                      apellidos: employee.apellidos,
                      cedulaidentidad: employee.cedula,
                      cedula: employee.cedula,
                    }
                  : null
              }
              hasSearched={hasSearched}
              isLoading={isLoadingSearch}
              errorMessage={employeeError ?? undefined}
            />

            <ContratoInlineForm
              employee={
                employee
                  ? {
                      id: employee.id,
                      cedulaidentidad: employee.cedula,
                      contratoActual: employee.contratoActual,
                    }
                  : undefined
              }
              onSuccess={() => setEmployeeReady(true)}
            />

            {employee && employeeReady && (
              <>
                <CodeFilterForm
                  form={form}
                  dependencyData={dependencias}
                  directionGeneralData={direccionesGenerales}
                  directionLineData={direccionesLinea}
                  coordinationData={coordinaciones}
                  nominaData={tiposNomina}
                  isLoadingDependency={isLoadingDependency}
                  isLoadingDirectionGeneral={isLoadingDirectionGeneral}
                  isLoadingDirectionLine={isLoadingDirectionLine}
                  isLoadingCoordination={isLoadingCoordination}
                  isLoadingNomina={isLoadingNomina}
                  onSearch={onSearch}
                  onClean={cleanFields}
                />

                <div>
                  <Form {...formAsig}>
                    <form onSubmit={formAsig.handleSubmit(onSubmit)}>
                      {codeList && codeList.length > 0 && (
                        <>
                          <FormField
                            control={formAsig.control}
                            name="code"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>
                                  Listado De Codigos Disponibles
                                </FormLabel>
                                <FormControl>
                                  <Combobox
                                    options={codeList.map((codes) => ({
                                      value: `${codes.id}`,
                                      label: `${codes.codigo} - ${codes.especificaNombre || codes.denominacionNombre}`,
                                    }))}
                                    value={field.value ? `${field.value}` : ""}
                                    onChange={(value) => {
                                      field.onChange(Number.parseInt(value));
                                      setSelectedCodeId(Number.parseInt(value));
                                    }}
                                    placeholder="Seleccione Un Codigo"
                                    searchPlaceholder="Buscar codigo o cargo..."
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          {selectedCode && (
                            <div className="rounded-sm border-2 border-emerald-400/45 bg-emerald-200/40 p-2 mt-4">
                              <p>
                                D / G / O:{" "}
                                {selectedCode.direccionGeneralNombre ?? "N/A"}
                              </p>
                              <p>
                                División / Coordinación:{" "}
                                {selectedCode.direccionLineaNombre ?? "N/A"}
                              </p>
                              <p>
                                Coordinación:{" "}
                                {selectedCode.coordinacionNombre ?? "N/A"}
                              </p>
                              <p>
                                Organismo Adscrito:{" "}
                                {selectedCode.organismoNombre ?? "N/A"}
                              </p>
                              <p>
                                Grado:{" "}
                                {selectedCode.gradoNombre ?? "N/A"}
                              </p>
                              <p>
                                Cargo:{" "}
                                {selectedCode.denominacionNombre}
                              </p>
                              <p>
                                Cargo Específico:{" "}
                                {selectedCode.especificaNombre}
                              </p>
                              <p>
                                Estatus:{" "}
                                {selectedCode.estatusNombre}
                              </p>
                              <p>
                                Tipo De Nomina:{" "}
                                {selectedCode.tipoNominaNombre}
                              </p>
                            </div>
                          )}

                          <Button
                            type="submit"
                            className="w-full mt-2 cursor-pointer"
                            disabled={isPending}
                          >
                            {isPending ? "Asignando Código" : "Asignar Código"}
                          </Button>
                        </>
                      )}

                      {hasSearchedCodes && codeList && codeList.length < 1 && (
                        <ErrorCard errorMessage="No Hay Codigos Vacantes Disponibles" />
                      )}
                    </form>
                  </Form>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </>
  );
}

export default AsignarCargoPage;
