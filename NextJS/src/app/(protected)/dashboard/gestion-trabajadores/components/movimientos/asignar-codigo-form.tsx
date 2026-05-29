"use client";

import { apiFetch } from "@/lib/api-client";
import {
  getCodeListSearchFree,
  getCoordination,
  getDependency,
  getDirectionGeneralById,
  getDirectionLine,
  getEmployeeById,
  getEmployeeInfo,
  getNomina,
  getPoliticas,
} from "@/app/(protected)/dashboard/gestion-trabajadores/api/getInfoRac";
import { AsignCode } from "@/app/(protected)/dashboard/gestion-trabajadores/movimientos/asignar-codigo/actions/asign-code";
import { schemaAsignCode } from "@/app/(protected)/dashboard/gestion-trabajadores/movimientos/asignar-codigo/schema/schema-asign-code";
import { EmployeeInfo, Politica } from "@/app/types/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarIcon, Eraser, Search } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatInTimeZone } from "date-fns-tz";
import { useState, useTransition, useEffect } from "react";
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
import { Label } from "../../../../../../components/ui/label";
import Error from "../error/error";
import Loading from "../loading/loading";
import EmployeeSearchForm from "../employees/employee-search-form";
import { EmployeeInfoBanner } from "@/shared/components/employee-info-banner";
import { useEmployeeSearch } from "@/shared/hooks/useEmployeeSearch";
export function AsigCode() {
  const [selectedCodeId, setSelectedCodeId] = useState<number>();
  const [selecteIdDirectionGeneral, setSelecteIdDirectionGeneral] =
    useState<string>();
  const [selecteIdDirectionLine, setSelecteIdDirectionLine] =
    useState<string>();
  const [isPending, startTransition] = useTransition();
  const [dependencyId, setDependencyId] = useState<number>(0);
  const [showContratoForm, setShowContratoForm] = useState(false);
  const [contratoData, setContratoData] = useState({ n_contrato: "", politica_id: 0, fecha_ingreso: new Date(), fecha_culminacion: undefined as Date | undefined });
  const [savingContrato, setSavingContrato] = useState(false);
  const [hasActiveContrato, setHasActiveContrato] = useState(false);

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
  const { data: politicas } = useSWR("politicas", getPoliticas);

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

  useEffect(() => {
    if (!employee) return;
    let cancelled = false;
    (async () => {
      const fullEmployee = await getEmployeeById(employee.cedulaidentidad);
      if (cancelled) return;
      if (fullEmployee.data && !Array.isArray(fullEmployee.data)) {
        const hasActive = fullEmployee.data.contrato?.some(c => c.estatus?.estatus !== 'VENCIDO');
        setHasActiveContrato(!!hasActive);
        if (!hasActive) {
          setShowContratoForm(true);
          const initials = politicas?.data?.[0]?.tipo_politica?.charAt(0)?.toUpperCase() || 'C';
          const count = (fullEmployee.data.contrato?.length || 0) + 1;
          setContratoData(prev => ({ ...prev, n_contrato: `${initials}-${fullEmployee.data.cedulaidentidad}-${String(count).padStart(2, '0')}` }));
        }
      }
    })();
    return () => { cancelled = true; };
  }, [employee]);
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
  const generateNContrato = (cedula: string, politicaId: number) => {
    const selectedPolitica = politicas?.data?.find(p => p.id === politicaId);
    const initials = selectedPolitica?.tipo_politica?.charAt(0)?.toUpperCase() || 'C';
    const existingCount = (employee ? (employee as any).contrato?.length || 0 : 0);
    const count = existingCount + 1;
    return `${initials}-${cedula}-${String(count).padStart(2, '0')}`;
  };
  return (
    <>
      {isPending ? (
        <Loading promiseMessage="Asigando Cargo" />
      ) : (
        <Card>
          <CardContent className="space-y-5">
            <EmployeeSearchForm onSearch={search} />

            <EmployeeInfoBanner
              employee={employee}
              hasSearched={hasSearched}
              isLoading={isLoadingSearch}
            />

            {showContratoForm && !hasActiveContrato && employee && (
              <div className="border-2 border-yellow-400/45 bg-yellow-100/40 p-4 rounded-sm space-y-3">
                <Label className="text-lg font-bold">El trabajador no tiene contrato activo</Label>
                <p className="text-sm">Debe registrar un contrato antes de asignar el cargo.</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>N° Contrato</Label>
                    <Input
                      placeholder="Auto-generado si se deja vacío"
                      value={contratoData.n_contrato}
                      onChange={(e) => setContratoData(prev => ({ ...prev, n_contrato: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Tipo de Política</Label>
                    <Select
                      onValueChange={(v) => {
                        const politicaId = Number(v);
                        setContratoData(prev => ({
                          ...prev,
                          politica_id: politicaId,
                          n_contrato: prev.n_contrato || generateNContrato((employee as any).cedulaidentidad, politicaId)
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
                          {contratoData.fecha_ingreso ? formatInTimeZone(contratoData.fecha_ingreso, "UTC", "dd/MM/yyyy") : "..."}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={contratoData.fecha_ingreso} onSelect={(d) => d && setContratoData(prev => ({ ...prev, fecha_ingreso: d }))} disabled={(d) => d > new Date() || d < new Date("1900-01-01")} />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div>
                    <Label>Fecha de Culminación (opcional)</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-between font-normal">
                          {contratoData.fecha_culminacion ? formatInTimeZone(contratoData.fecha_culminacion, "UTC", "dd/MM/yyyy") : "Seleccionar..."}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={contratoData.fecha_culminacion} onSelect={(d) => d && setContratoData(prev => ({ ...prev, fecha_culminacion: d }))} disabled={(d) => d < new Date("1900-01-01")} />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
                <Button
                  onClick={async () => {
                    if (!contratoData.politica_id) { toast.error("Seleccione una política"); return; }
                    if (!contratoData.fecha_ingreso) { toast.error("Seleccione fecha de ingreso"); return; }
                    setSavingContrato(true);
                    const n_contrato = contratoData.n_contrato || generateNContrato((employee as any).cedulaidentidad, contratoData.politica_id);
                    const session = await fetch('/api/auth/session').then(r => r.json());
                    const userId = session?.user?.id;
                    const payload = {
                      usuario_id: Number(userId),
                      contrato: [{
                        n_contrato,
                        fecha_ingreso: contratoData.fecha_ingreso.toISOString().split('T')[0],
                        politica_id: contratoData.politica_id,
                        fecha_culminacion: contratoData.fecha_culminacion ? contratoData.fecha_culminacion.toISOString().split('T')[0] : null,
                      }]
                    };
                    const data = await apiFetch<{ status: string; message?: string }>(`Employee/${(employee as any).id}/`, {
                      method: 'PATCH', body: JSON.stringify(payload)
                    });
                    setSavingContrato(false);
                    if (data.status === "success") {
                      toast.success("Contrato registrado correctamente");
                      setHasActiveContrato(true);
                      setShowContratoForm(false);
                    } else {
                      toast.error(data.message || "Error al registrar contrato");
                    }
                  }}
                  disabled={savingContrato}
                  className="w-full cursor-pointer"
                >
                  {savingContrato ? "Guardando..." : "Guardar Contrato"}
                </Button>
              </div>
            )}
            {employee && hasActiveContrato && (
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
                                          ? "Cargando División / Coordinación "
                                          : "Seleccione una División / Coordinación "
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
            {employee && hasActiveContrato && (
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
