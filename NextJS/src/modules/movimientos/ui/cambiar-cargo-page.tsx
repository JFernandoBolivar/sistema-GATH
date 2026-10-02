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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Combobox } from "@/shared/ui/components/combobox";
import { Loading } from "@/shared/ui/components/loading";
import { EmployeeSearchForm } from "@/shared/components/employee-search-form";
import { EmployeeInfoBanner } from "@/shared/components/employee-info-banner";
import { CodeFilterForm } from "./components/code-filter-form";
import { ErrorCard } from "./components/error-card";

import { getEmpleadoPorCedulaAction } from "@/shared/infrastructure/actions/employee-actions";
import type { EmpleadoDTO } from "@/shared/types/employee-dto";
import {
  getCargosVacantesAction,
  cambiarCargoAction,
  getDependenciasAction,
  getDireccionesGeneralesAction,
  getDireccionesLineaAction,
  getCoordinacionesAction,
  getTiposNominaAction,
  getMotivosAction,
} from "@/modules/cargos/infrastructure/actions/cargos-actions";
import type {
  CargoAsignacionDTO,
  CatalogoCargoItemDTO,
  UnidadOrganizativaCargoDTO,
} from "@/modules/cargos/application/dtos/cargo-dto";
import {
  schemaFilterForm,
  type SchemaFilterFormType,
} from "@/modules/cargos/ui/schema/schema-asignar-cargo";
import {
  schemaChangeCodeUI,
  type SchemaChangeCodeUIType,
} from "./schema/schema-cambiar-cargo";

export function CambiarCargoPage() {
  const [selectedCodeId, setSelectedCodeId] = useState<number>();
  const [isPending, startTransition] = useTransition();
  const [codeList, setCodeList] = useState<CargoAsignacionDTO[] | null>(null);
  const [hasSearchedCodes, setHasSearchedCodes] = useState(false);

  // Catalogs
  const [dependencias, setDependencias] = useState<UnidadOrganizativaCargoDTO[]>([]);
  const [direccionesGenerales, setDireccionesGenerales] = useState<UnidadOrganizativaCargoDTO[]>([]);
  const [direccionesLinea, setDireccionesLinea] = useState<UnidadOrganizativaCargoDTO[]>([]);
  const [coordinaciones, setCoordinaciones] = useState<UnidadOrganizativaCargoDTO[]>([]);
  const [tiposNomina, setTiposNomina] = useState<CatalogoCargoItemDTO[]>([]);
  const [motionReasons, setMotionReasons] = useState<CatalogoCargoItemDTO[]>([]);

  const [isLoadingDependency, setIsLoadingDependency] = useState(true);
  const [isLoadingDirectionGeneral, setIsLoadingDirectionGeneral] = useState(false);
  const [isLoadingDirectionLine, setIsLoadingDirectionLine] = useState(false);
  const [isLoadingCoordination, setIsLoadingCoordination] = useState(false);
  const [isLoadingNomina, setIsLoadingNomina] = useState(true);
  const [isLoadingMotionReason, setIsLoadingMotionReason] = useState(true);

  // Search filter form
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

  // Change code form
  const formChangeCode = useForm<SchemaChangeCodeUIType>({
    resolver: zodResolver(schemaChangeCodeUI),
    defaultValues: {
      code_old: 0,
      nuevo_cargo_id: 0,
      motivo: 0,
    },
  });

  const watchedDependencia = form.watch("dependencia_id");
  const watchedDireccionGeneral = form.watch("direccion_general_id");
  const watchedDireccionLinea = form.watch("direccion_linea_id");

  // Load initial catalogs
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [deps, noms, reasons] = await Promise.all([
          getDependenciasAction(),
          getTiposNominaAction(),
          getMotivosAction("TRASLADO").catch(() => getMotivosAction()),
        ]);
        if (!active) return;
        setDependencias(deps);
        setTiposNomina(noms);
        setMotionReasons(reasons && reasons.length > 0 ? reasons : await getMotivosAction());
      } catch {
        // Silencioso
      } finally {
        if (active) {
          setIsLoadingDependency(false);
          setIsLoadingNomina(false);
          setIsLoadingMotionReason(false);
        }
      }
    })();
    return () => {
      active = false;
    };
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
    return () => {
      active = false;
    };
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
    return () => {
      active = false;
    };
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
    return () => {
      active = false;
    };
  }, [watchedDireccionLinea, form]);

  const onSearch = (values: SchemaFilterFormType) => {
    if (
      values.dependencia_id &&
      values.dependencia_id > 0 &&
      (!values.direccion_general_id || values.direccion_general_id === 0)
    ) {
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
        formChangeCode.setValue("nuevo_cargo_id", 0);
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
    formChangeCode.setValue("nuevo_cargo_id", 0);
  };

  // Employee search state
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
        formChangeCode.reset({
          code_old: 0,
          nuevo_cargo_id: 0,
          motivo: 0,
        });
        cleanFields();
      } else {
        setEmployee(null);
        const err = res && "error" in res ? res.error : "Trabajador no encontrado";
        setEmployeeError(err);
      }
    } catch {
      setEmployee(null);
      setEmployeeError("Error al consultar el trabajador");
    } finally {
      setIsLoadingSearch(false);
    }
  };

  const clearEmployee = () => {
    setEmployee(null);
    setHasSearched(false);
    setEmployeeError(null);
    formChangeCode.reset({
      code_old: 0,
      nuevo_cargo_id: 0,
      motivo: 0,
    });
    cleanFields();
  };

  useEffect(() => {
    if (!employee) {
      setCodeList(null);
      setHasSearchedCodes(false);
      setSelectedCodeId(undefined);
    }
  }, [employee]);

  const onSubmit = (data: SchemaChangeCodeUIType) => {
    startTransition(async () => {
      try {
        const response = await cambiarCargoAction({
          cargoActualId: data.code_old,
          cargoNuevoId: data.nuevo_cargo_id,
          motivoId: data.motivo,
        });
        if (response && "error" in response) {
          toast.error(response.error);
        } else {
          toast.success("Traslado realizado correctamente.");
          formChangeCode.reset({
            code_old: 0,
            nuevo_cargo_id: 0,
            motivo: 0,
          });
          cleanFields();
          clearEmployee();
        }
      } catch (error: unknown) {
        toast.error(error instanceof Error ? error.message : "Ocurrió un error al cambiar el cargo");
      }
    });
  };

  const selectedCode = codeList?.find((v) => v.id === selectedCodeId);

  return (
    <>
      {isPending ? (
        <Loading promiseMessage="Cambiando Cargo..." />
      ) : (
        <Card className="bg-white">
          <CardContent className="gap-5 flex flex-col p-6">
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

            {employee && (
              <>
                {!employee.asignaciones || employee.asignaciones.length === 0 ? (
                  <ErrorCard
                    errorMessage="El Trabajador No Posee Asignaciones De Cargo"
                    className="scale-100"
                  />
                ) : (
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
                      <Form {...formChangeCode}>
                        <form
                          onSubmit={formChangeCode.handleSubmit(onSubmit)}
                          className="space-y-4"
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
                                  value={field.value && field.value > 0 ? `${field.value}` : ""}
                                >
                                  <FormControl>
                                    <SelectTrigger className="w-full truncate">
                                      <SelectValue placeholder="Seleccione Un Cargo Del Empleado" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {employee.asignaciones?.map((codes) => (
                                      <SelectItem key={codes.id} value={`${codes.id}`}>
                                        {codes.codigo} -{" "}
                                        {codes.denominacionCargoEspecifico || codes.denominacionCargo}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          {codeList && codeList.length > 0 ? (
                            <>
                              <FormField
                                control={formChangeCode.control}
                                name="nuevo_cargo_id"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Listado De Codigos Disponibles</FormLabel>
                                    <FormControl>
                                      <Combobox
                                        options={codeList.map((codes) => ({
                                          value: `${codes.id}`,
                                          label: `${codes.codigo} - ${codes.denominacionNombre}`,
                                        }))}
                                        value={field.value ? `${field.value}` : ""}
                                        onChange={(value) => {
                                          const num = Number.parseInt(value);
                                          field.onChange(num);
                                          setSelectedCodeId(num);
                                        }}
                                        placeholder="Seleccione Un Código"
                                        searchPlaceholder="Buscar codigo o cargo..."
                                      />
                                    </FormControl>
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
                                      value={field.value && field.value > 0 ? `${field.value}` : ""}
                                    >
                                      <FormControl>
                                        <SelectTrigger className="w-full truncate">
                                          <SelectValue
                                            placeholder={
                                              isLoadingMotionReason
                                                ? "Cargando Motivos De Cambio De Cargo"
                                                : "Seleccione Un Código"
                                            }
                                          />
                                        </SelectTrigger>
                                      </FormControl>
                                      <SelectContent>
                                        {motionReasons.map((reason) => (
                                          <SelectItem key={reason.id} value={`${reason.id}`}>
                                            {reason.nombre}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />

                              {selectedCode && (
                                <div className="rounded-sm border-2 border-emerald-400/45 bg-emerald-200/40 p-2 mt-4 space-y-1 text-sm">
                                  <p>
                                    D / G / O:{" "}
                                    {selectedCode.direccionGeneralNombre ?? "N/A"}
                                  </p>
                                  <p>
                                    División / Coordinación:{" "}
                                    {selectedCode.direccionLineaNombre ?? "N/A"}
                                  </p>
                                  <p>
                                    Coordinacion:{" "}
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
                                    Cargo Especifico:{" "}
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

                              <Button className="w-full mt-2" disabled={isPending}>
                                {isPending ? "Cargando..." : "Cambiar Codigo"}
                              </Button>
                            </>
                          ) : (
                            hasSearchedCodes && (
                              <ErrorCard
                                errorMessage="Direccion Administrativa No Posee Cargos Vacantes"
                                className="scale-100"
                              />
                            )
                          )}
                        </form>
                      </Form>
                    </div>
                  </>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}
    </>
  );
}

export default CambiarCargoPage;
