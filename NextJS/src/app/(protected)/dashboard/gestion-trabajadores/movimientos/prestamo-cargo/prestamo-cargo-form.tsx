"use client";

import { useState, useTransition, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { formatInTimeZone } from "date-fns-tz";
import { toast } from "sonner";
import useSWR from "swr";
import { Search, ChevronDownIcon } from "lucide-react";
import z from "zod";

import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ApiResponse, EmployeeData } from "@/app/types/types";

import {
  getMotivosEncargaduria,
  getPrestamosCargo,
  getCodeListSearch,
  getDependency,
  getDirectionGeneralById,
  getDirectionLine,
  getCoordination,
  getEmployeeById,
  getNomina,
} from "../../api/getInfoRac";

import { MotivoEncargaduria, PrestamoCargoData, Code } from "@/app/types/types";
import { ContratoInlineForm } from "@/shared/components/contrato-inline-form";
import { CodeFilterForm } from "../../components/movimientos/code-filter-form";
import { schemaPrestamoCargo, PrestamoCargoFormType } from "./schema";
import { createPrestamoCargoAction, finalizarPrestamoCargoAction } from "./actions";
import EmployeeSearchForm from "../../components/employees/employee-search-form";
import Error from "../../components/error/error";
import Loading from "../../components/loading/loading";

const STATUS_BADGE: Record<string, string> = {
  ACTIVO: "bg-green-600",
  "POR VENCER": "bg-yellow-500",
  FINALIZADA: "bg-gray-500",
};

const schemaFilterForm = z.object({
  tipo_nomina: z.coerce.number().optional(),
  dependencia_id: z.coerce.number().optional(),
  direccion_general_id: z.coerce.number().optional(),
  direccion_linea_id: z.coerce.number().optional(),
  coordinacion_id: z.coerce.number().optional(),
  codigo: z.string().optional(),
});

export function PrestamoCargoForm() {
  const [isPending, startTransition] = useTransition();
  const [employee, setEmployee] = useState<ApiResponse<EmployeeData>>();
  const [selectedCargo, setSelectedCargo] = useState<Code | null>(null);
  const [selectedCodeId, setSelectedCodeId] = useState<number>();
  const [finalizarOpen, setFinalizarOpen] = useState<number | null>(null);
  const [fechaFinEdit, setFechaFinEdit] = useState<Date>(new Date());
  const [searchParams, setSearchParams] = useState<string>();
  const [filterCedula, setFilterCedula] = useState("");
  const [employeeReady, setEmployeeReady] = useState(false);

  const { data: dependency } = useSWR("dependency", getDependency);
  const { data: nomina } = useSWR("nominaGeneral", getNomina);

  const filterForm = useForm({
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

  const watchedDependencia = filterForm.watch("dependencia_id");
  const watchedDireccionGeneral = filterForm.watch("direccion_general_id");
  const watchedDireccionLinea = filterForm.watch("direccion_linea_id");

  const { data: directionGeneral } = useSWR(
    watchedDependencia ? ["directionGeneral", watchedDependencia] : null,
    () => getDirectionGeneralById(watchedDependencia!),
  );
  const { data: directionLine } = useSWR(
    watchedDireccionGeneral ? ["directionLine", watchedDireccionGeneral] : null,
    () => getDirectionLine(String(watchedDireccionGeneral)),
  );
  const { data: coordination } = useSWR(
    watchedDireccionLinea ? ["coordination", watchedDireccionLinea] : null,
    () => getCoordination(String(watchedDireccionLinea)),
  );

  const { data: codeList } = useSWR(
    searchParams ? ["codes-search", searchParams] : null,
    () => getCodeListSearch({ searchParams }),
  );
  const { data: motivos } = useSWR("motivos-encargaduria", getMotivosEncargaduria);

  const { data: prestamos, mutate } = useSWR(
    ["prestamos-cargo", filterCedula],
    () => getPrestamosCargo({ empleado: filterCedula || undefined }),
  );

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

  const watchedMotivo = form.watch("motivo");
  const isOtherMotivo = watchedMotivo === -1;

  useEffect(() => {
    if (!employee || Array.isArray(employee.data)) setEmployeeReady(false);
  }, [employee]);

  const handleSearchEmployee = async (cedula: string) => {
    const response = await getEmployeeById(cedula);
    if (response.data && response.data !== undefined) {
      setEmployee(response);
      form.setValue("empleado_encargado", response.data.cedulaidentidad);
    }
  };

  const handleSearchCargo = (values: z.infer<typeof schemaFilterForm>) => {
    const filteredEntries = Object.entries(values).filter(
      ([_, v]) => v !== "" && v !== 0 && v !== undefined && v !== null,
    );
    const params = new URLSearchParams(filteredEntries as unknown as string);
    setSearchParams(params.toString());
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
    setSearchParams(undefined);
  };

  const handleSelectCargo = (id: string) => {
    setSelectedCodeId(Number(id));
    const cargo = codeList?.data?.find((c) => c.id === Number(id));
    if (cargo) {
      setSelectedCargo(cargo);
      form.setValue("cargo_encargado", cargo.id);
    }
  };

  const handleSubmit = (values: PrestamoCargoFormType) => {
    if (!selectedCargo) {
      toast.error("Debe seleccionar un cargo");
      return;
    }
    if (!employee?.data || Array.isArray(employee.data)) {
      toast.error("Debe buscar un trabajador");
      return;
    }
    startTransition(async () => {
      const result = await createPrestamoCargoAction(values);
      if (result.success) {
        toast.success(result.message);
        setSelectedCargo(null);
        setSelectedCodeId(undefined);
        setEmployee(undefined);
        setEmployeeReady(false);
        form.reset();
        mutate();
      } else {
        toast.error(result.message);
      }
    });
  };

  const handleFinalizar = (id: number) => {
    startTransition(async () => {
      const fecha = fechaFinEdit.toISOString().split("T")[0];
      const result = await finalizarPrestamoCargoAction(id, fecha);
      if (result.success) {
        toast.success(result.message);
        setFinalizarOpen(null);
        mutate();
      } else {
        toast.error(result.message);
      }
    });
  };

const formatDate = (d: string | Date) => {
  try {
    const date = typeof d === "string" ? new Date(d) : d;
    return formatInTimeZone(date, "UTC", "dd/MM/yyyy");
  } catch {
    return String(d);
  }
};

  const selectedCode = codeList?.data?.find((v) => v.id === selectedCodeId);

  if (isPending) {
    return <Loading promiseMessage="Registrando Encargaduría" />;
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Registrar Encargaduría</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <EmployeeSearchForm
            onSearch={handleSearchEmployee}
            label="Buscar Trabajador (Encargado)"
          />

          {employee && !Array.isArray(employee.data) && (
            <div className="border-2 border-blue-400/45 bg-blue-200/40 p-2 rounded-sm">
              <p>
                {employee.data.nombres} - {employee.data.cedulaidentidad}
              </p>
            </div>
          )}

          {employee && Array.isArray(employee.data) && (
            <Error errorMessage="Trabajador no encontrado" />
          )}

          <ContratoInlineForm
            employee={employee && !Array.isArray(employee.data) ? { id: employee.data.id, cedulaidentidad: employee.data.cedulaidentidad } : undefined}
            onSuccess={() => setEmployeeReady(true)}
          />

          {employee && !Array.isArray(employee.data) && employeeReady && (
            <>
              <CodeFilterForm
                form={filterForm}
                dependencyData={dependency?.data}
                directionGeneralData={directionGeneral?.data}
                directionLineData={directionLine?.data}
                coordinationData={coordination?.data}
                nominaData={nomina?.data}
                onSearch={handleSearchCargo}
                onClean={handleCleanFilters}
              />

              {codeList?.data && codeList.data.length > 0 && (
                <div>
                  <Label>Código del Cargo</Label>
                  <Select onValueChange={handleSelectCargo}>
                    <SelectTrigger className="w-full truncate">
                      <SelectValue placeholder="Seleccione un cargo" />
                    </SelectTrigger>
                    <SelectContent>
                      {codeList.data.map((c) => (
                        <SelectItem key={c.id} value={c.id.toString()}>
                          {c.codigo} - {c.denominacioncargo?.cargo} ({c.denominacioncargoespecifico?.cargo})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {selectedCode && (
                <div className="rounded-sm border-2 border-emerald-400/45 bg-emerald-200/40 p-2">
                  <p><strong>D/G/O:</strong> {selectedCode.DireccionGeneral?.direccion_general ?? "N/A"}</p>
                  <p><strong>Coordinación:</strong> {selectedCode.Coordinacion?.coordinacion ?? "N/A"}</p>
                  <p><strong>Cargo:</strong> {selectedCode.denominacioncargo?.cargo}</p>
                  <p><strong>Cargo Específico:</strong> {selectedCode.denominacioncargoespecifico?.cargo}</p>
                  <p><strong>Estatus:</strong> {selectedCode.estatusid?.estatus}</p>
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
                                {motivos?.data?.map((m: MotivoEncargaduria) => (
                                  <SelectItem key={m.id} value={m.id.toString()}>{m.movimiento}</SelectItem>
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
                    <Button type="submit" disabled={isPending} className="w-full cursor-pointer">
                      {isPending ? "Registrando..." : "Registrar Encargaduría"}
                    </Button>
                  </form>
                </Form>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Encargadurías Activas</CardTitle>
          <div className="flex gap-2">
            <Input
              placeholder="Filtrar por cédula"
              value={filterCedula}
              onChange={(e) => setFilterCedula(e.target.value)}
              className="w-44"
            />
            <Button size="sm" onClick={() => mutate()} className="cursor-pointer">
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
              {prestamos?.data?.map((p: PrestamoCargoData) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.titular_nombre}</TableCell>
                  <TableCell>{p.titular_cedula}</TableCell>
                  <TableCell>{p.cargo_info?.codigo}</TableCell>
                  <TableCell>{p.cargo_info?.denominacioncargo?.cargo}</TableCell>
                  <TableCell>{p.empleado_nombre}</TableCell>
                  <TableCell>{p.empleado_cedula}</TableCell>
                  <TableCell>{p.motivo_nombre}</TableCell>
                  <TableCell>{formatDate(p.fecha_inicio)}</TableCell>
                  <TableCell>{formatDate(p.fecha_fin)}</TableCell>
                  <TableCell>
                    <Badge className={STATUS_BADGE[p.estatus_nombre] || "bg-gray-500"}>{p.estatus_nombre}</Badge>
                  </TableCell>
                  <TableCell>
                    {p.estatus_nombre !== "FINALIZADA" && (
                      <Dialog open={finalizarOpen === p.id} onOpenChange={(o) => !o && setFinalizarOpen(null)}>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm" onClick={() => { setFinalizarOpen(p.id); setFechaFinEdit(new Date()); }}>
                            Finalizar
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader><DialogTitle>Finalizar Encargaduría</DialogTitle></DialogHeader>
                          <div className="flex flex-col gap-4">
                            <p className="text-sm">Establecer fecha de finalización para <strong>{p.empleado_nombre}</strong> en <strong>{p.cargo_info?.denominacioncargo?.cargo}</strong>.</p>
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button variant="outline" className="justify-between">{formatDate(fechaFinEdit)}<ChevronDownIcon /></Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={fechaFinEdit} onSelect={(d) => d && setFechaFinEdit(d)} /></PopoverContent>
                            </Popover>
                            <Button onClick={() => handleFinalizar(p.id)} disabled={isPending}>Confirmar Finalización</Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {(!prestamos?.data || prestamos.data.length === 0) && (
                <TableRow><TableCell colSpan={11} className="text-center text-gray-500">No hay encargadurías activas</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
