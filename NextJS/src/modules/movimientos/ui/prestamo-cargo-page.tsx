"use client";

import { useState, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { formatInTimeZone } from "date-fns-tz";
import { toast } from "sonner";
import { Search, ChevronDownIcon } from "lucide-react";

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/shared/ui/components/input";
import { Button } from "@/shared/ui/components/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Combobox } from "@/shared/ui/components/combobox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/shared/ui/components/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/shared/ui/components/card";
import { Loading } from "@/shared/ui/components/loading";
import { ContratoInlineForm } from "@/shared/components/contrato-inline-form";
import { EmployeeSearchForm } from "@/shared/components/employee-search-form";
import { EmployeeInfoBanner } from "@/shared/components/employee-info-banner";
import { CodeFilterForm } from "./components/code-filter-form";
import { ErrorCard } from "./components/error-card";

import type { EmpleadoDTO } from "@/shared/types/employee-dto";
import { getEmpleadoPorCedulaAction } from "@/shared/infrastructure/actions/employee-actions";
import {
  getCargosAction,
  getDependenciasAction,
  getDireccionesGeneralesAction,
  getDireccionesLineaAction,
  getCoordinacionesAction,
  getTiposNominaAction,
  getMotivosAction,
  getPrestamosAction,
  registrarEncargaduriaAction,
  finalizarPrestamoAction,
} from "@/modules/cargos/infrastructure/actions/cargos-actions";
import type {
  CargoAsignacionDTO,
  CatalogoCargoItemDTO,
  PrestamoCargoDTO,
  UnidadOrganizativaCargoDTO,
} from "@/modules/cargos/application/dtos/cargo-dto";
import {
  schemaFilterForm,
  schemaPrestamoCargo,
  type SchemaFilterFormType,
  type PrestamoCargoFormType,
} from "@/modules/cargos/ui/schema/schema-asignar-cargo";

const STATUS_BADGE: Record<string, string> = {
  ACTIVO: "bg-green-600",
  "POR VENCER": "bg-yellow-500",
  FINALIZADA: "bg-gray-500",
};

export function PrestamoCargoPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [employee, setEmployee] = useState<EmpleadoDTO | null>(null);
  const [isLoadingSearch, setIsLoadingSearch] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [employeeError, setEmployeeError] = useState<string | null>(null);
  const [selectedCargo, setSelectedCargo] = useState<CargoAsignacionDTO | null>(null);
  const [selectedCodeId, setSelectedCodeId] = useState<number>();
  const [finalizarOpen, setFinalizarOpen] = useState<number | null>(null);
  const [fechaFinEdit, setFechaFinEdit] = useState<Date>(new Date());
  const [filterCedula, setFilterCedula] = useState("");
  const [employeeReady, setEmployeeReady] = useState(false);
  const [isLoadingCargos, setIsLoadingCargos] = useState(false);

  // Catalogs
  const [dependencias, setDependencias] = useState<UnidadOrganizativaCargoDTO[]>([]);
  const [direccionesGenerales, setDireccionesGenerales] = useState<UnidadOrganizativaCargoDTO[]>([]);
  const [direccionesLinea, setDireccionesLinea] = useState<UnidadOrganizativaCargoDTO[]>([]);
  const [coordinaciones, setCoordinaciones] = useState<UnidadOrganizativaCargoDTO[]>([]);
  const [tiposNomina, setTiposNomina] = useState<CatalogoCargoItemDTO[]>([]);
  const [motivos, setMotivos] = useState<CatalogoCargoItemDTO[]>([]);
  const [codeList, setCodeList] = useState<CargoAsignacionDTO[] | null>(null);
  const [prestamos, setPrestamos] = useState<PrestamoCargoDTO[]>([]);

  const [isLoadingDependency, setIsLoadingDependency] = useState(true);
  const [isLoadingDirectionGeneral, setIsLoadingDirectionGeneral] = useState(false);
  const [isLoadingDirectionLine, setIsLoadingDirectionLine] = useState(false);
  const [isLoadingCoordination, setIsLoadingCoordination] = useState(false);
  const [isLoadingNomina, setIsLoadingNomina] = useState(true);

  const filterForm = useForm<SchemaFilterFormType>({
    resolver: zodResolver(schemaFilterForm),
    defaultValues: {
      tipo_nomina: 0,
      dependencia_id: 0,
      direccion_general_id: 0,
      direccion_linea_id: 0,
      coordinacion_id: 0,
      codigo: "",
    },
  });

  const form = useForm<PrestamoCargoFormType>({
    resolver: zodResolver(schemaPrestamoCargo),
    defaultValues: {
      cargo_encargado: 0,
      empleado_encargado: "",
      motivo: 0,
      nueva_motivo_nombre: undefined,
      fecha_inicio: new Date(),
      fecha_fin: new Date(),
    },
  });

  const watchedDependencia = filterForm.watch("dependencia_id");
  const watchedDireccionGeneral = filterForm.watch("direccion_general_id");
  const watchedDireccionLinea = filterForm.watch("direccion_linea_id");
  const watchedMotivo = form.watch("motivo");
  const isOtherMotivo = watchedMotivo === -1;

  // Initial catalogs fetch
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [deps, noms, mots] = await Promise.all([
          getDependenciasAction(),
          getTiposNominaAction(),
          getMotivosAction("ENCARGADURIA"),
        ]);
        if (!active) return;
        setDependencias(deps);
        setTiposNomina(noms);
        setMotivos(mots);
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

  // Fetch prestamos
  const loadPrestamos = useCallback(async (cedulaFiltro?: string) => {
    try {
      const data = await getPrestamosAction(undefined, cedulaFiltro?.trim() || undefined);
      setPrestamos(data);
    } catch {
      // Silencioso
    }
  }, []);

  useEffect(() => {
    loadPrestamos();
  }, [loadPrestamos]);

  // Cascading: watchedDependencia -> direccionesGenerales
  useEffect(() => {
    if (!watchedDependencia || Number(watchedDependencia) === 0) {
      setDireccionesGenerales([]);
      filterForm.setValue("direccion_general_id", 0);
      filterForm.setValue("direccion_linea_id", 0);
      filterForm.setValue("coordinacion_id", 0);
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
  }, [watchedDependencia, filterForm]);

  // Cascading: watchedDireccionGeneral -> direccionesLinea
  useEffect(() => {
    if (!watchedDireccionGeneral || Number(watchedDireccionGeneral) === 0) {
      setDireccionesLinea([]);
      filterForm.setValue("direccion_linea_id", 0);
      filterForm.setValue("coordinacion_id", 0);
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
  }, [watchedDireccionGeneral, filterForm]);

  // Cascading: watchedDireccionLinea -> coordinaciones
  useEffect(() => {
    if (!watchedDireccionLinea || Number(watchedDireccionLinea) === 0) {
      setCoordinaciones([]);
      filterForm.setValue("coordinacion_id", 0);
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
  }, [watchedDireccionLinea, filterForm]);

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
        form.setValue("empleado_encargado", res.cedula);
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

  const handleSearchCargo = (values: SchemaFilterFormType) => {
    setIsLoadingCargos(true);
    (async () => {
      try {
        const numOrUndefined = (val: unknown) => {
          const n = Number(val);
          return n > 0 ? n : undefined;
        };

        const results = await getCargosAction({
          dependenciaId: numOrUndefined(values.dependencia_id),
          tipoNominaId: numOrUndefined(values.tipo_nomina),
          direccionGeneralId: numOrUndefined(values.direccion_general_id),
          direccionLineaId: numOrUndefined(values.direccion_linea_id),
          coordinacionId: numOrUndefined(values.coordinacion_id),
          codigo: values.codigo?.trim() || undefined,
          soloVacantes: false,
        });
        setCodeList(results);
        setSelectedCodeId(undefined);
        setSelectedCargo(null);
        form.setValue("cargo_encargado", 0);
        if (results.length === 0) {
          toast.info("No se encontraron cargos con los criterios de búsqueda.");
        }
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "Error al buscar cargos");
      } finally {
        setIsLoadingCargos(false);
      }
    })();
  };

  const handleCleanFilters = () => {
    filterForm.reset({
      tipo_nomina: 0,
      dependencia_id: 0,
      direccion_general_id: 0,
      direccion_linea_id: 0,
      coordinacion_id: 0,
      codigo: "",
    });
    setCodeList(null);
    setSelectedCodeId(undefined);
    setSelectedCargo(null);
    form.setValue("cargo_encargado", 0);
  };

  const handleSelectCargo = (id: string) => {
    const numId = Number(id);
    setSelectedCodeId(numId);
    const c = codeList?.find((item) => item.id === numId);
    if (c) {
      setSelectedCargo(c);
      form.setValue("cargo_encargado", c.id);
    }
  };

  const handleSubmit = (values: PrestamoCargoFormType) => {
    if (!selectedCargo) {
      toast.error("Debe seleccionar un cargo");
      return;
    }
    if (!employee) {
      toast.error("Debe buscar un trabajador");
      return;
    }

    setIsSubmitting(true);
    (async () => {
      try {
        const result = await registrarEncargaduriaAction({
          cargo_encargado: values.cargo_encargado,
          empleado_encargado: values.empleado_encargado,
          motivo: values.motivo,
          nueva_motivo_nombre: values.nueva_motivo_nombre,
          fecha_inicio: values.fecha_inicio.toISOString().split("T")[0],
          fecha_fin: values.fecha_fin.toISOString().split("T")[0],
        });

        if (result.success) {
          toast.success(result.message);
          setSelectedCargo(null);
          setSelectedCodeId(undefined);
          setEmployee(null);
          setHasSearched(false);
          setEmployeeError(null);
          setEmployeeReady(false);
          form.reset();
          loadPrestamos(filterCedula);
        } else {
          toast.error(result.message);
        }
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "Error al registrar la encargaduría");
      } finally {
        setIsSubmitting(false);
      }
    })();
  };

  const handleFinalizar = (id: number) => {
    setIsSubmitting(true);
    (async () => {
      try {
        const fecha = fechaFinEdit.toISOString().split("T")[0];
        const result = await finalizarPrestamoAction(id, fecha);
        if (result.success) {
          toast.success(result.message);
          setFinalizarOpen(null);
          loadPrestamos(filterCedula);
        } else {
          toast.error(result.message);
        }
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "Error al finalizar el préstamo");
      } finally {
        setIsSubmitting(false);
      }
    })();
  };

  const formatDate = (d: string | Date | null | undefined) => {
    if (!d) return "N/A";
    try {
      const date = typeof d === "string" ? new Date(d) : d;
      return formatInTimeZone(date, "UTC", "dd/MM/yyyy");
    } catch {
      return String(d);
    }
  };

  const selectedCode = codeList?.find((v) => v.id === selectedCodeId);

  if (isSubmitting) {
    return <Loading promiseMessage="Procesando Encargaduría..." />;
  }

  return (
    <div className="flex flex-col gap-6">
      <Card className="bg-white">
        <CardHeader>
          <CardTitle>Registrar Encargaduría</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <EmployeeSearchForm
            onSearch={handleSearchEmployee}
            label="Buscar Trabajador (Encargado)"
          />

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
                form={filterForm}
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
                onSearch={handleSearchCargo}
                onClean={handleCleanFilters}
              />

              {codeList !== null && (
                (() => {
                  const availableCargos = codeList.filter(
                    (c) => !employee || c.empleadoCedula !== employee.cedula
                  );
                  if (availableCargos.length === 0) {
                    return (
                      <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                        No se encontraron cargos disponibles para prestar con los filtros seleccionados.
                      </div>
                    );
                  }
                  return (
                    <div>
                      <Label>Código del Cargo</Label>
                      <Combobox
                        options={availableCargos.map((c) => ({
                          value: c.id.toString(),
                          label: `${c.codigo} - ${c.denominacionNombre} (${c.especificaNombre})${
                            c.empleadoNombre
                              ? ` — Titular: ${c.empleadoNombre}`
                              : c.empleadoCedula
                                ? ` — Titular: ${c.empleadoCedula}`
                                : " — (Vacante)"
                          }`,
                        }))}
                        onChange={handleSelectCargo}
                        placeholder="Seleccione un cargo"
                        searchPlaceholder="Buscar codigo o cargo..."
                      />
                    </div>
                  );
                })()
              )}

              {selectedCode && (
                <div className="rounded-sm border-2 border-emerald-400/45 bg-emerald-200/40 p-3 flex flex-col gap-1 text-sm">
                  <p><strong>Titular Actual:</strong> {selectedCode.empleadoNombre ? `${selectedCode.empleadoNombre} (${selectedCode.empleadoCedula})` : selectedCode.empleadoCedula ? selectedCode.empleadoCedula : "Vacante (Sin titular)"}</p>
                  <p><strong>Código:</strong> {selectedCode.codigo}</p>
                  <p><strong>Cargo:</strong> {selectedCode.denominacionNombre}</p>
                  <p><strong>Cargo Específico:</strong> {selectedCode.especificaNombre}</p>
                  <p><strong>Tipo de Nómina:</strong> {selectedCode.tipoNominaNombre}</p>
                  <p><strong>D/G/O:</strong> {selectedCode.direccionGeneralNombre ?? "N/A"}</p>
                  <p><strong>División / Coordinación:</strong> {selectedCode.direccionLineaNombre ?? "N/A"}</p>
                  <p><strong>Coordinación:</strong> {selectedCode.coordinacionNombre ?? "N/A"}</p>
                  <p><strong>Estatus:</strong> {selectedCode.estatusNombre}</p>
                </div>
              )}

              {selectedCargo && (
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col gap-4">
                    <div className="flex gap-2 items-start">
                      <FormField
                        control={form.control}
                        name="motivo"
                        render={({ field }) => (
                          <FormItem className="w-72 shrink-0">
                            <FormLabel>Motivo (ENCARGADURIA)</FormLabel>
                            <Select
                              onValueChange={(v) => {
                                if (v === "-1") {
                                  field.onChange(-1);
                                } else {
                                  field.onChange(Number(v));
                                  form.setValue("nueva_motivo_nombre", "" as never);
                                }
                              }}
                              value={field.value === -1 ? "-1" : field.value?.toString() ?? ""}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Seleccione un motivo" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {motivos.map((m) => (
                                  <SelectItem key={m.id} value={m.id.toString()}>
                                    {m.nombre}
                                  </SelectItem>
                                ))}
                                <SelectItem value="-1">Otro</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className={!isOtherMotivo ? "hidden" : "w-60 shrink-0"}>
                        <FormField
                          control={form.control}
                          name="nueva_motivo_nombre"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>&nbsp;</FormLabel>
                              <FormControl>
                                <Input placeholder="Nuevo motivo..." {...field} value={field.value ?? ""} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="fecha_inicio"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Fecha Inicio</FormLabel>
                            <Popover>
                              <PopoverTrigger asChild>
                                <FormControl>
                                  <Button variant="outline" className="w-full justify-between font-normal">
                                    {field.value ? formatDate(field.value) : "Seleccionar..."}
                                    <ChevronDownIcon />
                                  </Button>
                                </FormControl>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="start">
                                <Calendar mode="single" selected={field.value} onSelect={(d) => d && field.onChange(d)} />
                              </PopoverContent>
                            </Popover>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="fecha_fin"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Fecha Fin</FormLabel>
                            <Popover>
                              <PopoverTrigger asChild>
                                <FormControl>
                                  <Button variant="outline" className="w-full justify-between font-normal">
                                    {field.value ? formatDate(field.value) : "Seleccionar..."}
                                    <ChevronDownIcon />
                                  </Button>
                                </FormControl>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="start">
                                <Calendar mode="single" selected={field.value} onSelect={(d) => d && field.onChange(d)} />
                              </PopoverContent>
                            </Popover>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <Button type="submit" disabled={isSubmitting} className="w-full cursor-pointer">
                      {isSubmitting ? "Registrando..." : "Registrar Encargaduría"}
                    </Button>
                  </form>
                </Form>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card className="bg-white">
        <CardHeader>
          <CardTitle>Encargadurías Activas</CardTitle>
          <div className="flex gap-2">
            <Input
              placeholder="Filtrar por cédula"
              value={filterCedula}
              onChange={(e) => setFilterCedula(e.target.value)}
              className="w-44"
            />
            <Button size="sm" onClick={() => loadPrestamos(filterCedula)} className="cursor-pointer">
              <Search className="mr-1" size={14} /> Filtrar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Titular</TableHead>
                <TableHead>Cédula Titular</TableHead>
                <TableHead>Código</TableHead>
                <TableHead>Cargo</TableHead>
                <TableHead>Encargado</TableHead>
                <TableHead>Cédula Encargado</TableHead>
                <TableHead>Motivo</TableHead>
                <TableHead>Desde</TableHead>
                <TableHead>Hasta</TableHead>
                <TableHead>Estatus</TableHead>
                <TableHead>Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {prestamos.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.titularNombre || "N/A"}</TableCell>
                  <TableCell>{p.titularCedula || "N/A"}</TableCell>
                  <TableCell>{p.cargoEncargadoCodigo}</TableCell>
                  <TableCell>{p.cargoEncargadoDenominacion || p.cargoEncargadoCodigo}</TableCell>
                  <TableCell>{p.empleadoEncargadoNombre}</TableCell>
                  <TableCell>{p.empleadoEncargadoCedula}</TableCell>
                  <TableCell>{p.motivoNombre}</TableCell>
                  <TableCell>{formatDate(p.fechaInicio)}</TableCell>
                  <TableCell>{formatDate(p.fechaFin)}</TableCell>
                  <TableCell>
                    <Badge className={STATUS_BADGE[p.estatusNombre] || "bg-gray-500"}>
                      {p.estatusNombre}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {!p.estaFinalizada && p.estatusNombre !== "FINALIZADA" && (
                      <Dialog open={finalizarOpen === p.id} onOpenChange={(o) => !o && setFinalizarOpen(null)}>
                        <DialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setFinalizarOpen(p.id);
                              setFechaFinEdit(new Date());
                            }}
                          >
                            Finalizar
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Finalizar Encargaduría</DialogTitle>
                          </DialogHeader>
                          <div className="flex flex-col gap-4">
                            <p className="text-sm">
                              Establecer fecha de finalización para <strong>{p.empleadoEncargadoNombre}</strong> en <strong>{p.cargoEncargadoCodigo}</strong>.
                            </p>
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button variant="outline" className="justify-between">
                                  {formatDate(fechaFinEdit)}
                                  <ChevronDownIcon />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0">
                                <Calendar mode="single" selected={fechaFinEdit} onSelect={(d) => d && setFechaFinEdit(d)} />
                              </PopoverContent>
                            </Popover>
                            <Button onClick={() => handleFinalizar(p.id)} disabled={isSubmitting}>
                              Confirmar Finalización
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {prestamos.length === 0 && (
                <TableRow>
                  <TableCell colSpan={11} className="text-center text-gray-500">
                    No hay encargadurías activas
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

export default PrestamoCargoPage;
