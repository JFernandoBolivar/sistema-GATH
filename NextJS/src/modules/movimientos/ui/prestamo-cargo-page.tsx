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
import { MotivoSelect } from "@/modules/cargos/ui/components/motivo-select";
import { aplicarErroresServidor } from "@/shared/ui/forms/aplicar-errores-servidor";
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
  ESTATUS_PRESTAMO_ACTIVO,
  ESTATUS_PRESTAMO_FINALIZADA,
  ESTATUS_PRESTAMO_POR_VENCER,
} from "@/shared/domain/catalogos";
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
import { CargoBuscador } from "./components/cargo-buscador";
import { ErrorCard } from "./components/error-card";

import type { EmpleadoDTO } from "@/shared/types/employee-dto";
import { getEmpleadoPorCedulaAction } from "@/shared/infrastructure/actions/employee-actions";
import {
  getPrestamosAction,
  registrarEncargaduriaAction,
  finalizarPrestamoAction,
} from "@/modules/cargos/infrastructure/actions/cargos-actions";
import type {
  CargoAsignacionDTO,
  PrestamoCargoDTO,
} from "@/modules/cargos/application/dtos/cargo-dto";
import {
  schemaPrestamoCargo,
  type PrestamoCargoFormType,
} from "@/modules/cargos/ui/schema/schema-asignar-cargo";

const STATUS_BADGE: Record<string, string> = {
  [ESTATUS_PRESTAMO_ACTIVO]: "bg-green-600",
  [ESTATUS_PRESTAMO_POR_VENCER]: "bg-yellow-500",
  [ESTATUS_PRESTAMO_FINALIZADA]: "bg-muted0",
};

export function PrestamoCargoPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [employee, setEmployee] = useState<EmpleadoDTO | null>(null);
  const [isLoadingSearch, setIsLoadingSearch] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [employeeError, setEmployeeError] = useState<string | null>(null);
  const [selectedCargo, setSelectedCargo] = useState<CargoAsignacionDTO | null>(null);
  const [finalizarOpen, setFinalizarOpen] = useState<number | null>(null);
  const [fechaFinEdit, setFechaFinEdit] = useState<Date>(new Date());
  const [filterCedula, setFilterCedula] = useState("");
  const [employeeReady, setEmployeeReady] = useState(false);
  const [prestamos, setPrestamos] = useState<PrestamoCargoDTO[]>([]);

  const form = useForm<PrestamoCargoFormType>({
    resolver: zodResolver(schemaPrestamoCargo),
    defaultValues: {
      cargo_encargado: 0,
      empleado_encargado: "",
      motivo: 0,
      fecha_inicio: new Date(),
      fecha_fin: new Date(),
    },
  });

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

  const handleSelectCargo = (c: CargoAsignacionDTO | null) => {
    setSelectedCargo(c);
    form.setValue("cargo_encargado", c ? c.id : 0);
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
          fecha_inicio: values.fecha_inicio.toISOString().split("T")[0],
          fecha_fin: values.fecha_fin.toISOString().split("T")[0],
        });

        if (result.success) {
          toast.success(result.message);
          setSelectedCargo(null);
          setEmployee(null);
          setHasSearched(false);
          setEmployeeError(null);
          setEmployeeReady(false);
          form.reset();
          loadPrestamos(filterCedula);
        } else {
          const sinUbicar = aplicarErroresServidor(form, result.errores, {
            cedula_encargado: "empleado_encargado",
            cargo_id: "cargo_encargado",
            motivo_id: "motivo",
          });
          toast.error(result.errores && sinUbicar.length === 0 ? "Revise los campos marcados en rojo." : result.message);
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

  const selectedCode = selectedCargo;

  if (isSubmitting) {
    return <Loading promiseMessage="Procesando Encargaduría..." />;
  }

  return (
    <div className="flex flex-col gap-6">
      <Card className="bg-card">
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
              <div>
                <Label htmlFor="buscar-cargo">Cargo a encargar</Label>
                <CargoBuscador
                  id="buscar-cargo"
                  value={selectedCargo}
                  onSelect={handleSelectCargo}
                  excluirCedula={employee?.cedula}
                />
              </div>

              {selectedCode && (
                <div className="rounded-sm border-2 border-success/40 bg-success-soft p-4 flex flex-col gap-1 text-sm break-words">
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
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                      <FormField
                        control={form.control}
                        name="motivo"
                        render={({ field }) => (
                          <FormItem className="w-full sm:w-96">
                            <FormLabel>Motivo de la encargaduría</FormLabel>
                            <FormControl>
                              <MotivoSelect
                                operacion="prestamo_cargo"
                                value={field.value}
                                onChange={field.onChange}
                                aria-invalid={Boolean(form.formState.errors.motivo)}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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

      <Card className="bg-card">
        <CardHeader>
          <CardTitle>Encargadurías Activas</CardTitle>
          <div className="flex flex-wrap gap-2">
            <Input
              placeholder="Filtrar por cédula"
              value={filterCedula}
              onChange={(e) => setFilterCedula(e.target.value)}
              className="w-full sm:w-44"
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
                    <Badge className={STATUS_BADGE[p.estatusNombre] || "bg-muted0"}>
                      {p.estatusNombre}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {!p.estaFinalizada && p.estatusNombre !== ESTATUS_PRESTAMO_FINALIZADA && (
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
                  <TableCell colSpan={11} className="text-center text-muted-foreground">
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
