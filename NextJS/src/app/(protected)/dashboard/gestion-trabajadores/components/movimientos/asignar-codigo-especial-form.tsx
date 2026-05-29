"use client";
import { apiFetch } from "@/lib/api-client";
import {
  getCargo,
  getCargoEspecifico,
  getCoordination,
  getDependency,
  getDirectionGeneral,
  getDirectionGeneralById,
  getDirectionLine,
  getEmployeeById,
  getEmployeeInfo,
  getGrado,
  getNominaEspecial,
  getOrganismosAds,
  getPoliticas,
  getTiposProcedencia,
} from "@/app/(protected)/dashboard/gestion-trabajadores/api/getInfoRac";
import { AsignSpecialCode } from "@/app/(protected)/dashboard/gestion-trabajadores/movimientos/asignar-codigo-especial/actions/asign-special-code";
import { schemaCodeEspecial } from "@/app/(protected)/dashboard/gestion-trabajadores/movimientos/asignar-codigo-especial/schema/schemaCodeEspecial";
import { EmployeeInfo, Politica } from "@/app/types/types";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarIcon, Search } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatInTimeZone } from "date-fns-tz";
import { useState, useTransition, useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import useSWR from "swr";
import { z } from "zod";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "../../../../../../components/ui/form";
import { Spinner } from "../../../../../../components/ui/spinner";
import { Switch } from "../../../../../../components/ui/switch";
import Error from "../error/error";
import EmployeeSearchForm from "../employees/employee-search-form";
import { EmployeeInfoBanner } from "@/shared/components/employee-info-banner";
import { useEmployeeSearch } from "@/shared/hooks/useEmployeeSearch";

interface CodigoCatalogFormProps {
  onSuccess?: (bool: boolean) => true | false;
}

export function CodigoCatalogEspecialForm({
  onSuccess,
}: CodigoCatalogFormProps) {
  const [dependencyId, setDependencyId] = useState<number | string>("");
  const [activeDirectionGeneral, setActiveDirectionGeneral] =
    useState<boolean>(false);
  const [selecteIdDirectionGeneral, setSelecteIdDirectionGeneral] =
    useState<string>();
  const [selecteIdDirectionLine, setSelecteIdDirectionLine] =
    useState<string>();

  const [activeDirectionLine, setActiveDirectionLine] =
    useState<boolean>(false);
  const [activeCoordination, setActiveCoordination] = useState<boolean>(false);
  const [isPending, startTransition] = useTransition();
  const [showContratoForm, setShowContratoForm] = useState(false);
  const [contratoData, setContratoData] = useState({ n_contrato: "", politica_id: 0, fecha_ingreso: new Date(), fecha_culminacion: undefined as Date | undefined });
  const [savingContrato, setSavingContrato] = useState(false);
  const [hasActiveContrato, setHasActiveContrato] = useState(false);

  const validateDirectionGeneral = () => {
    if (!activeDirectionGeneral) form.setValue("DireccionGeneral", 0);
  };
  const validateDirectionLine = () => {
    if (!activeDirectionLine || !activeDirectionGeneral)
      form.setValue("DireccionLinea", 0);
  };
  const validateCoordination = () => {
    if (
      !activeCoordination ||
      !activeDirectionLine ||
      !activeDirectionGeneral
    ) {
      form.setValue("Coordinacion", 0);
    }
  };

  const { data: cargoEspecifico, isLoading: isLoadingCargoEspecifico } = useSWR(
    "cargoEspecifico",
    async () => await getCargoEspecifico(),
  );
  const { data: cargo, isLoading: isLoadingCargo } = useSWR("cargo", async () =>
    getCargo(),
  );
  const { data: nomina, isLoading: isLoadingNomina } = useSWR(
    "nomina",
    async () => getNominaEspecial(),
  );
  const { data: dependency, isLoading: isLoadingDependency } = useSWR(
    "dependency",
    async () => await getDependency(),
  );
  const { data: directionGeneral, isLoading: isLoadingDirectionGeneral } =
    useSWR(
      dependencyId ? ["directionGeneral", dependencyId] : null,
      async () => await getDirectionGeneralById(dependencyId),
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
  const { data: grado, isLoading: isLoadingGrado } = useSWR(
    "grado",
    async () => await getGrado(),
  );
  const { data: organismoAds, isLoading: isLoadingOrganismoAds } = useSWR(
    "organismoAds",
    async () => await getOrganismosAds(),
  );
  const { data: tiposProcedencia, isLoading: isLoadingTiposProcedencia } = useSWR(
    "tiposProcedencia",
    async () => await getTiposProcedencia(),
  );
  const { data: politicas } = useSWR("politicas", getPoliticas);
  const form = useForm({
    resolver: zodResolver(schemaCodeEspecial),
    defaultValues: {
      employee: "",
      OrganismoAdscritoid: 0,
      denominacioncargoespecificoid: 0,
      denominacioncargoid: 0,
      gradoid: 0,
      tiponominaid: 0,
      DireccionGeneral: 0,
      DireccionLinea: 0,
      Coordinacion: 0,
      tipo_procedencia: 0,
    },
  });
  const onSubmit = (values: z.infer<typeof schemaCodeEspecial>) => {
    startTransition(async () => {
      const response = await AsignSpecialCode(values);
      if (response.success) {
        toast.success(response.message);
        onSuccess?.(true);
      } else {
        toast.error(response.message);
      }
    });
  };

  const { employee, isLoading: isLoadingSearch, hasSearched, search } =
    useEmployeeSearch<EmployeeInfo>({
      searchFn: getEmployeeInfo,
      onFound: (emp) => {
        form.setValue("employee", emp.cedulaidentidad, {
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
      if (fullEmployee.data) {
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
  const generateNContrato = (cedula: string, politicaId: number) => {
    const selectedPolitica = politicas?.data?.find(p => p.id === politicaId);
    const initials = selectedPolitica?.tipo_politica?.charAt(0)?.toUpperCase() || 'C';
    const existingCount = (employee ? (employee as any).contrato?.length || 0 : 0);
    const count = existingCount + 1;
    return `${initials}-${cedula}-${String(count).padStart(2, '0')}`;
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle>Registrar Código de Posición</CardTitle>
        <CardDescription>
          Ingrese los datos del nuevo código y sus atributos asociados
        </CardDescription>
      </CardHeader>
      <CardContent>
        <EmployeeSearchForm onSearch={search} />

        <div className="mt-4">
          <EmployeeInfoBanner
            employee={employee}
            hasSearched={hasSearched}
            isLoading={isLoadingSearch}
            extraFields={
              employee?.estadoCivil
                ? [{ label: "Estado Civil", value: employee.estadoCivil.estadoCivil }]
                : []
            }
          />
        </div>

        {showContratoForm && !hasActiveContrato && employee && (
          <div className="border-2 border-yellow-400/45 bg-yellow-100/40 p-4 rounded-sm space-y-3 mt-3">
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
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-6 mt-3"
          >
            <div className="space-y-2 grid grid-cols-2 items-baseline gap-6 place-content-center">
              <FormField
                control={form.control}
                name="denominacioncargoid"
                render={({ field }) => (
                  <FormItem className=" ">
                    <FormLabel>Denominación De Cargo</FormLabel>
                    <Select
                      onValueChange={(values) => {
                        field.onChange(Number.parseInt(values));
                      }}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full truncate">
                          <SelectValue
                            placeholder={`${
                              isLoadingCargo
                                ? "Cargando Cargos"
                                : "Seleccione una Denominación De Cargo"
                            }`}
                          />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {cargo?.data.map((cargo, i) => (
                          <SelectItem key={i} value={`${cargo.id}`}>
                            {cargo.cargo}
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
                name="denominacioncargoespecificoid"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Denominación De Cargo Específico</FormLabel>
                    <Select
                      onValueChange={(values) => {
                        field.onChange(Number.parseInt(values));
                      }}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full truncate">
                          <SelectValue
                            placeholder={`${
                              isLoadingCargoEspecifico
                                ? "Cargando Cargos Especificos"
                                : "Seleccione una Denominación De Cargo Específico"
                            }`}
                          />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {cargoEspecifico?.data.map((cargo, i) => (
                          <SelectItem key={i} value={`${cargo.id}`}>
                            {cargo.cargo}
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
                name="tiponominaid"
                render={({ field }) => (
                  <FormItem className=" ">
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
              />
              <FormField
                control={form.control}
                name="gradoid"
                render={({ field }) => (
                  <FormItem className=" ">
                    <FormLabel>Grado (Opcional)</FormLabel>
                    <Select
                      onValueChange={(values) => {
                        field.onChange(Number.parseInt(values));
                      }}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full truncate">
                          <SelectValue
                            placeholder={`${
                              isLoadingGrado
                                ? "Cargando Grados"
                                : "Seleccione un Grado"
                            }`}
                          />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {grado?.data.map((grado, i) => (
                          <SelectItem key={i} value={`${grado.id}`}>
                            {grado.grado}
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
                name="OrganismoAdscritoid"
                render={({ field }) => (
                  <FormItem className={`col-span-2`}>
                    <FormLabel>Organismo Adscrito (Opcional)</FormLabel>
                    <Select
                      onValueChange={(values) => {
                        field.onChange(Number.parseInt(values));
                      }}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full truncate">
                          <SelectValue
                            placeholder={`${
                              isLoadingGrado
                                ? "Cargando Organismos Adscritos"
                                : "Seleccione Un Organismo Adscrito"
                            }`}
                          />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {organismoAds?.data.map((org, i) => (
                          <SelectItem key={i} value={`${org.id}`}>
                            {org.id}-{org.Organismoadscrito}
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
                name="tipo_procedencia"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Tipo De Procedencia</FormLabel>
                    <Select
                      onValueChange={(values) => {
                        field.onChange(Number.parseInt(values));
                      }}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full truncate">
                          <SelectValue
                            placeholder={`${
                              isLoadingTiposProcedencia
                                ? "Cargando Tipos De Procedencia"
                                : "Seleccione Un Tipo De Procedencia"
                            }`}
                          />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {tiposProcedencia?.data.map((tipo, i) => (
                          <SelectItem key={i} value={`${tipo.id}`}>
                            {tipo.tipo_procedencia}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                name="Dependencia"
                control={form.control}
                render={({ field }) => (
                  <FormItem
                    className={`${
                      !activeDirectionGeneral ? "col-span-2" : "truncate"
                    }`}
                  >
                    <FormLabel>Nivel</FormLabel>
                    <FormControl>
                      <Select
                        onValueChange={(value) => {
                          setDependencyId(value);
                          field.onChange(Number.parseInt(value));
                        }}
                      >
                        <SelectTrigger className="w-full ">
                          <SelectValue placeholder={`Seleccionar Nivel`} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectContent>
                            <SelectGroup>
                              <SelectLabel>
                                Dirección / Gerencia / Oficina
                              </SelectLabel>
                              {dependency?.data.map((dp, i) => (
                                <SelectItem key={i} value={`${dp.id}`}>
                                  {dp.dependencia}
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          </SelectContent>
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormDescription>
                      <div className="flex flex-row items-center text-left gap-2 justify-center">
                        ¿Desea Agregarle Una División / Coordinación?
                        <Switch
                          onCheckedChange={(bool) => {
                            setActiveDirectionGeneral(bool);
                            validateDirectionGeneral();
                          }}
                        />
                      </div>
                    </FormDescription>
                  </FormItem>
                )}
              />
              {activeDirectionGeneral && directionGeneral?.data.length! > 0 && (
                <>
                  <FormField
                    control={form.control}
                    name="DireccionGeneral"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Dirección / Gerencia / Oficina</FormLabel>
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
                                {general.Codigo}-{general.direccion_general}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          <div className="flex flex-row items-center text-left gap-2 justify-center">
                            ¿Desea Agregarle Una División / Coordinación?
                            <Switch
                              onCheckedChange={(bool) => {
                                setActiveDirectionLine(bool);
                                validateDirectionLine();
                              }}
                            />
                          </div>
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}

              {activeDirectionLine && directionLine?.data?.length! > 0 && (
                <>
                  <FormField
                    control={form.control}
                    name="DireccionLinea"
                    render={({ field }) => (
                      <FormItem
                        className={`${activeCoordination ? "" : "col-span-2"}`}
                      >
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
                                    ? "Cargando División / Coordinación"
                                    : "Seleccione una División / Coordinación"
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
                        <FormDescription>
                          <div className="flex flex-row items-center text-left justify-center gap-2">
                            ¿Desea Agregarle Una Coordinación?
                            <Switch
                              onCheckedChange={(bool) => {
                                setActiveCoordination(bool);
                                validateCoordination();
                              }}
                            />
                          </div>
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {activeCoordination && coordination?.data.length! > 0 && (
                    <>
                      <FormField
                        control={form.control}
                        name="Coordinacion"
                        render={({ field }) => (
                          <FormItem>
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
                    </>
                  )}
                </>
              )}
            </div>
            {/* Buttons */}
            <div className="flex gap-3 justify-end">
              <Button type="submit" disabled={isPending} className="w-full">
                {isPending ? (
                  <>
                    <Spinner />
                    Asignando Código Especial...
                  </>
                ) : (
                  "Asignar Código Especial"
                )}
              </Button>
            </div>
          </form>
        </Form>
        )}
      </CardContent>
    </Card>
  );
}
