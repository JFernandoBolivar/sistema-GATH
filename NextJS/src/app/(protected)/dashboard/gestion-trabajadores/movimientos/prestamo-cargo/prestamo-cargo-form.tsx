"use client";

import { useState, useTransition, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { formatInTimeZone } from "date-fns-tz";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-client";
import useSWR from "swr";
import { Search, ChevronDownIcon, Eraser } from "lucide-react";
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
import { ApiResponse, EmployeeData, Politica } from "@/app/types/types";

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
  getPoliticas,
} from "../../api/getInfoRac";

import { MotivoEncargaduria, PrestamoCargoData, Code } from "@/app/types/types";
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
  const [showContratoForm, setShowContratoForm] = useState(false);
  const [hasActiveContrato, setHasActiveContrato] = useState(false);
  const [contratoData, setContratoData] = useState({ n_contrato: "", politica_id: 0, fecha_ingreso: new Date(), fecha_culminacion: undefined as Date | undefined });
  const [savingContrato, setSavingContrato] = useState(false);

  const { data: dependency } = useSWR("dependency", getDependency);
  const { data: nomina } = useSWR("nominaGeneral", getNomina);
  const { data: politicas } = useSWR("politicas", getPoliticas);

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
    if (!employee || Array.isArray(employee.data)) return;
    let cancelled = false;
    (async () => {
      const fullEmployee = await getEmployeeById(employee.data.cedulaidentidad);
      if (cancelled) return;
      if (fullEmployee.data && !Array.isArray(fullEmployee.data)) {
        const hasActive = fullEmployee.data.contrato?.some(
          (c) => c.estatus?.estatus !== "VENCIDO",
        );
        setHasActiveContrato(!!hasActive);
        if (!hasActive) {
          setShowContratoForm(true);
          const initials = politicas?.data?.[0]?.tipo_politica?.charAt(0)?.toUpperCase() || "C";
          const count = (fullEmployee.data.contrato?.length || 0) + 1;
          setContratoData((prev) => ({
            ...prev,
            n_contrato: `${initials}-${fullEmployee.data.cedulaidentidad}-${String(count).padStart(2, "0")}`,
          }));
        }
      }
    })();
    return () => { cancelled = true; };
  }, [employee, politicas]);

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
        setShowContratoForm(false);
        setHasActiveContrato(false);
        form.reset();
        mutate();
      } else {
        toast.error(result.message);
      }
    });
  };

  const handleSaveContrato = async () => {
    if (!contratoData.politica_id) {
      toast.error("Seleccione una política");
      return;
    }
    if (!employee?.data || Array.isArray(employee.data)) return;
    setSavingContrato(true);
    try {
      const json = await apiFetch<{ status: string; message?: string }>(
        `Employee/${employee.data.id}/`,
        {
          method: "PATCH",
          body: JSON.stringify({
            usuario_id: employee.data.id,
            contrato: [
              {
                n_contrato: contratoData.n_contrato,
                fecha_ingreso: contratoData.fecha_ingreso.toISOString().split("T")[0],
                politica_id: contratoData.politica_id,
                fecha_culminacion: contratoData.fecha_culminacion
                  ? contratoData.fecha_culminacion.toISOString().split("T")[0]
                  : undefined,
              },
            ],
          }),
        },
      );
      if (json.status === "success") {
        toast.success("Contrato registrado correctamente");
        setHasActiveContrato(true);
        setShowContratoForm(false);
      } else {
        toast.error(json.message || "Error al registrar contrato");
      }
    } catch {
      toast.error("Error de conexión");
    } finally {
      setSavingContrato(false);
    }
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

  const generateNContrato = (cedula: string, politicaId: number) => {
    const selectedPolitica = politicas?.data?.find((p: Politica) => p.id === politicaId);
    const initials = selectedPolitica?.tipo_politica?.charAt(0)?.toUpperCase() || "C";
    const existingCount = employee && !Array.isArray(employee.data) ? (employee.data as any).contrato?.length || 0 : 0;
    return `${initials}-${cedula}-${String(existingCount + 1).padStart(2, "0")}`;
  };

  const selectedCode = codeList?.data?.find((v) => v.id === selectedCodeId);

  if (isPending) {
    return <Loading promiseMessage="Registrando Encargaduría" />;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Registrar Encargaduría</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
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

          {employee && !Array.isArray(employee.data) && showContratoForm && !hasActiveContrato && (
            <div className="border-2 border-yellow-400/45 bg-yellow-100/40 p-4 rounded-sm space-y-3">
              <Label className="text-lg font-bold">El trabajador no tiene contrato activo</Label>
              <p className="text-sm">Debe registrar un contrato antes de asignar el cargo.</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>N° Contrato</Label>
                  <Input
                    placeholder="Auto-generado si se deja vacío"
                    value={contratoData.n_contrato}
                    onChange={(e) => setContratoData((prev) => ({ ...prev, n_contrato: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>Tipo de Política</Label>
                  <Select
                    onValueChange={(v) => {
                      const politicaId = Number(v);
                      setContratoData((prev) => ({
                        ...prev,
                        politica_id: politicaId,
                        n_contrato: prev.n_contrato || generateNContrato(employee.data.cedulaidentidad, politicaId),
                      }));
                    }}
                    value={contratoData.politica_id ? contratoData.politica_id.toString() : ""}
                  >
                    <SelectTrigger className="w-full truncate"><SelectValue placeholder="Seleccione" /></SelectTrigger>
                    <SelectContent>
                      {politicas?.data?.map((p: Politica) => (
                        <SelectItem key={p.id} value={p.id.toString()}>{p.tipo_politica}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Fecha de Ingreso</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-between font-normal">
                        {contratoData.fecha_ingreso ? formatDate(contratoData.fecha_ingreso) : "..."}
                        <ChevronDownIcon className="ml-auto h-4 w-4 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={contratoData.fecha_ingreso} onSelect={(d) => d && setContratoData((prev) => ({ ...prev, fecha_ingreso: d }))} disabled={(d) => d > new Date() || d < new Date("1900-01-01")} />
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <Label>Fecha de Culminación (opcional)</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-between font-normal">
                        {contratoData.fecha_culminacion ? formatDate(contratoData.fecha_culminacion) : "Seleccionar..."}
                        <ChevronDownIcon className="ml-auto h-4 w-4 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={contratoData.fecha_culminacion} onSelect={(d) => d && setContratoData((prev) => ({ ...prev, fecha_culminacion: d }))} disabled={(d) => d < new Date("1900-01-01")} />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
              <Button onClick={handleSaveContrato} disabled={savingContrato} className="cursor-pointer">
                {savingContrato ? "Guardando..." : "Guardar Contrato"}
              </Button>
            </div>
          )}

          {employee && !Array.isArray(employee.data) && hasActiveContrato && (
            <>
              <Form {...filterForm}>
                <form onSubmit={filterForm.handleSubmit(handleSearchCargo)}>
                  <div className="grid grid-cols-2 gap-2 w-full mb-2">
                    <FormField
                      control={filterForm.control}
                      name="codigo"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Buscar Código</FormLabel>
                          <FormControl>
                            <Input placeholder="buscar código..." {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={filterForm.control}
                      name="tipo_nomina"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tipo de Nómina</FormLabel>
                          <Select
                            onValueChange={(v) => field.onChange(Number(v))}
                            value={field.value?.toString() ?? ""}
                          >
                            <FormControl>
                              <SelectTrigger className="w-full truncate">
                                <SelectValue placeholder="Seleccione un Tipo de Nómina" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="0">Ninguno</SelectItem>
                              {nomina?.data?.map((n) => (
                                <SelectItem key={n.id} value={n.id.toString()}>{n.nomina}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={filterForm.control}
                      name="dependencia_id"
                      render={({ field }) => (
                        <FormItem className="col-span-2">
                          <FormLabel>Nivel</FormLabel>
                          <Select
                            onValueChange={(v) => field.onChange(Number(v))}
                            value={field.value?.toString() ?? ""}
                          >
                            <FormControl>
                              <SelectTrigger className="w-full truncate">
                                <SelectValue placeholder="Seleccione un Nivel" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {dependency?.data?.map((d) => (
                                <SelectItem key={d.id} value={d.id.toString()}>{d.dependencia}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={filterForm.control}
                      name="direccion_general_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Dirección / Gerencia / Oficina</FormLabel>
                          <Select
                            onValueChange={(v) => field.onChange(Number(v))}
                            value={field.value?.toString() ?? ""}
                            disabled={!watchedDependencia}
                          >
                            <FormControl>
                              <SelectTrigger className="w-full truncate">
                                <SelectValue placeholder="Seleccione una Dirección" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {directionGeneral?.data?.map((d) => (
                                <SelectItem key={d.id} value={d.id.toString()}>{d.direccion_general}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={filterForm.control}
                      name="direccion_linea_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>División / Coordinación</FormLabel>
                          <Select
                            onValueChange={(v) => field.onChange(Number(v))}
                            value={field.value?.toString() ?? ""}
                            disabled={!watchedDireccionGeneral}
                          >
                            <FormControl>
                              <SelectTrigger className="w-full truncate">
                                <SelectValue placeholder="Seleccione una División / Coordinación" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {directionLine?.data?.map((d) => (
                                <SelectItem key={d.id} value={d.id.toString()}>{d.direccion_linea}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={filterForm.control}
                      name="coordinacion_id"
                      render={({ field }) => (
                        <FormItem className="col-span-2">
                          <FormLabel>Coordinación</FormLabel>
                          <Select
                            onValueChange={(v) => field.onChange(Number(v))}
                            value={field.value?.toString() ?? ""}
                            disabled={!watchedDireccionLinea}
                          >
                            <FormControl>
                              <SelectTrigger className="w-full truncate">
                                <SelectValue placeholder="Seleccione una Coordinación" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {coordination?.data?.map((d) => (
                                <SelectItem key={d.id} value={d.id.toString()}>{d.coordinacion}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="flex gap-2 mb-2">
                    <Button type="submit" className="cursor-pointer flex-1">
                      <Search className="mr-2" size={16} /> Buscar Cargos
                    </Button>
                    <Button type="button" variant="outline" onClick={handleCleanFilters} className="cursor-pointer">
                      <Eraser className="mr-2" size={16} /> Limpiar
                    </Button>
                  </div>
                </form>
              </Form>

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
                  <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                    <div className="flex gap-2 items-start">
                      <FormField
                        control={form.control}
                        name="motivo"
                        render={({ field }) => (
                          <FormItem className="w-60 shrink-0">
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
                                <SelectTrigger className="truncate">
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
