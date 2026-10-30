"use client";

import { Card, CardContent } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
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
import { Combobox } from "@/components/ui/combobox";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import useSWR from "swr";
import {
  getAcademyLevel,
  getBloodGroup,
  getConditionDwelling,
  getCoordination,
  getDependency,
  getDirectionGeneralById,
  getDirectionLine,
  getDisability,
  getMunicipalitys,
  getNominaGeneral,
  getParent,
  getParish,
  getPatologys,
  getRegion,
  getSex,
  getStateByRegion,
  postReport,
} from "../services/reportes-catalogos";

import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { puedeFiltrarEstructuraOrganizativa } from "../../application/use-cases/permisos-reporte";
import { useState, useTransition } from "react";
import { schemaReportFamily, type SchemaReportFamilyType } from "../schema/report-schema-family";
import Loading from "@/shared/ui/components/loading";
import { Download, Eraser, Search } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatInTimeZone } from "date-fns-tz";

export default function ReportFamily() {
  const [isPending, startTransition] = useTransition();
  const [reportListFamilys, setReportListFamilysBlob] = useState<string>();
  const [stateId, setStateId] = useState<string>();
  const { data: session } = useSession();
  const [dependencyId, setDependencyId] = useState<number>(0);
  const [directionGeneralId, setDirectionGeneralId] = useState<string | null>(null);
  const [directionLineId, setDirectionLineId] = useState<string | null>(null);

  const { data: dependency, isLoading: isLoadingDependency } = useSWR(
    "dependency",
    async () => await getDependency(),
  );
  const { data: conditionDwelling, isLoading: isLoadingStatesConditionDwelling } = useSWR(
    "conditionDwelling",
    async () => await getConditionDwelling(),
  );
  const { data: directionGeneral, isLoading: isLoadingDirectionGeneral } = useSWR(
    dependencyId ? ["directionGeneral", dependencyId] : null,
    async () => await getDirectionGeneralById(dependencyId),
  );

  const { data: directionLine, isLoading: isLoadingDirectionLine } = useSWR(
    directionGeneralId ? ["directionLine", directionGeneralId] : null,
    async () => await getDirectionLine(directionGeneralId!),
  );
  const { data: coordination, isLoading: isLoadingCoordination } = useSWR(
    directionLineId ? ["coordination", directionLineId] : null,
    async () => await getCoordination(directionLineId!),
  );
  const { data: sex, isLoading: isLoadingSex } = useSWR("sex", async () => await getSex());
  const { data: patology, isLoading: isLoadingPatology } = useSWR(
    "patology",
    async () => await getPatologys(),
  );
  const { data: bloodGroup, isLoading: isLoadingBloodGroup } = useSWR(
    "blood",
    async () => await getBloodGroup(),
  );
  const { data: disability, isLoading: isLoadingDisability } = useSWR(
    "disability",
    async () => await getDisability(),
  );

  const { data: nomina, isLoading: isLoadingNomina } = useSWR(
    "nomina",
    async () => await getNominaGeneral(),
  );

  const { data: academyLevel, isLoading: isLoadingAcademyLevel } = useSWR(
    "academyLevel",
    async () => await getAcademyLevel(),
  );
  const [regionId, setRegionId] = useState<number>(0);
  const [municipalityId, setMunicipalityId] = useState<string>();
  const { data: region, isLoading: isLoadingRegion } = useSWR(
    "region",
    async () => await getRegion(),
  );
  const { data: states, isLoading: isLoadingStatesStates } = useSWR(
    regionId ? ["states", regionId] : null,
    async () => await getStateByRegion(regionId),
  );
  const { data: municipalitys, isLoading: isLoadingStatesSMunicipalitys } = useSWR(
    stateId ? ["municipalitys", stateId] : null,
    async () => await getMunicipalitys(stateId!),
  );
  const { data: parish, isLoading: isLoadingStatesParish } = useSWR(
    municipalityId ? ["parish", municipalityId] : null,
    async () => await getParish(municipalityId!),
  );
  const { data: parent } = useSWR("parent", async () => getParent());

  const form = useForm<SchemaReportFamilyType>({
    resolver: zodResolver(schemaReportFamily),
    defaultValues: {
      categoria: "familiares",
      agrupar_por: "tipo_nomina",
      tipo_reporte: "lista",
      filtros: {
        condicion_vivienda_id: undefined,
        dependencia_id: undefined,
        direccion_general_id: undefined,
        direccion_linea_id: undefined,
        coordinacion_id: undefined,
        discapacidades_id: undefined,
        edad_empleado_max: undefined,
        edad_empleado_min: undefined,
        edad_familiar_max: undefined,
        edad_familiar_min: undefined,
        estado_civil_id: undefined,
        estado_id: undefined,
        grupo_sanguineo_id: undefined,
        municipio_id: undefined,
        nivel_academico_id: undefined,
        nomina_id: undefined,
        parentesco_id: undefined,
        parroquia_id: undefined,
        patologias_id: undefined,
        sexo_empleado_id: undefined,
        sexo_familiar_id: undefined,
      },
    },
  });

  const filtrosForm = useWatch({
    name: "filtros",
    control: form.control,
  });

  if (!session) {
    return <Loading promiseMessage="Validando Sesión Para Generar El Reporte" />;
  }

  const onSubmit = (data: SchemaReportFamilyType) => {
    const payload: SchemaReportFamilyType = {
      ...data,
    };
    startTransition(async () => {
      try {
        const { blob } = await postReport<SchemaReportFamilyType>(payload);
        const urlBlob = URL.createObjectURL(blob);
        setReportListFamilysBlob(urlBlob);
        // El formulario NO se limpia: el usuario conserva los filtros elegidos.
        toast.success("Reporte generado. Use «Descargar Reporte» para guardarlo.");
      } catch (err) {
        toast.error(
          err instanceof Error && err.message
            ? err.message
            : "No fue posible generar el reporte. Intente de nuevo.",
        );
      }
    });
  };

  const handleClean = () => {
    form.reset();
    setReportListFamilysBlob(undefined);
  };

  // Los filtros de estructura solo se ofrecen a quien puede consultar la
  // estructura organizativa (`organizacion.ver`). Nunca por rol ni por "*".
  const puedeEstructura = puedeFiltrarEstructuraOrganizativa(session?.user?.permisos);

  return (
    <Card className="bg-white">
      <CardContent className="pt-6">
        <Form {...form}>
          {isPending ? (
            <Loading promiseMessage="Consultando Reporte" />
          ) : (
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="grid grid-cols-3 min-h-max gap-4"
            >
              <div className="flex flex-col gap-2 col-span-3 min-w-0 w-full">
                <ScrollArea className="h-[600px] w-full pr-3">
                  <div className="grid grid-cols-2 gap-3">
                    <fieldset className="flex flex-col gap-3 border-2 p-3 rounded-sm border-amber-700">
                      <legend className="text-amber-900 font-semibold px-1">
                        Información Básica Familiar
                      </legend>
                      <FormField
                        control={form.control}
                        name="filtros.parentesco_id"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Parentesco *</FormLabel>
                            <Select
                              onValueChange={(values) => {
                                field.onChange(Number.parseInt(values));
                              }}
                            >
                              <FormControl>
                                <SelectTrigger className="w-full truncate">
                                  <SelectValue placeholder="Seleccione un Parentesco" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {parent?.data.map((p, i) => (
                                  <SelectItem key={i} value={`${p.id}`}>
                                    {p.descripcion_parentesco || p.nombre}
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
                        name="filtros.sexo_familiar_id"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Sexo</FormLabel>
                            <Select
                              onValueChange={(values) => {
                                field.onChange(Number.parseInt(values));
                              }}
                            >
                              <FormControl>
                                <SelectTrigger className="w-full truncate">
                                  <SelectValue
                                    placeholder={`${
                                      isLoadingSex ? "Cargando Géneros" : "Seleccione un Género"
                                    }`}
                                  />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {sex?.data.map((v, i) => (
                                  <SelectItem value={`${v.id}`} key={i}>
                                    {v.sexo || v.nombre}
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
                        name="filtros.edad_familiar_min"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Edad Mínima Del Familiar</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Ingrese Una Edad Mínima Del Familiar"
                                {...field}
                                value={field.value !== undefined ? String(field.value) : ""}
                                type="number"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="filtros.edad_familiar_max"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Edad Máxima Del Familiar</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Ingrese Una Edad Máxima Del Familiar"
                                {...field}
                                value={field.value !== undefined ? String(field.value) : ""}
                                type="number"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </fieldset>

                    <fieldset className="flex flex-col gap-3 border-2 p-3 rounded-sm border-violet-800">
                      <legend className="text-violet-900 font-semibold px-1">
                        Información De Salud
                      </legend>
                      <FormField
                        control={form.control}
                        name="filtros.grupo_sanguineo_id"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Grupo Sanguíneo</FormLabel>
                            <Select
                              onValueChange={(values) => {
                                field.onChange(Number.parseInt(values));
                              }}
                            >
                              <FormControl>
                                <SelectTrigger className="w-full truncate">
                                  <SelectValue
                                    placeholder={`${
                                      isLoadingBloodGroup
                                        ? "Cargando Grupos Sanguíneos"
                                        : "Seleccione un Grupo Sanguíneo"
                                    }`}
                                  />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {bloodGroup?.data.map((bg, i) => (
                                  <SelectItem key={i} value={`${bg.id}`}>
                                    {bg.GrupoSanguineo || bg.nombre}
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
                        name="filtros.patologias_id"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Patologías</FormLabel>
                            <Select
                              onValueChange={(values) => {
                                field.onChange(Number.parseInt(values));
                              }}
                            >
                              <FormControl>
                                <SelectTrigger className="w-full truncate">
                                  <SelectValue
                                    placeholder={`${
                                      isLoadingPatology
                                        ? "Cargando Patologías"
                                        : "Seleccione una Patología"
                                    }`}
                                  />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {patology?.data.map((v, i) => (
                                  <SelectItem value={`${v.id}`} key={i}>
                                    {v.categoria?.nombre_categoria || "General"} -{" "}
                                    {v.patologia || v.nombre}
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
                        name="filtros.discapacidades_id"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Discapacidad</FormLabel>
                            <Select
                              onValueChange={(values) => {
                                field.onChange(Number.parseInt(values));
                              }}
                            >
                              <FormControl>
                                <SelectTrigger className="w-full truncate">
                                  <SelectValue
                                    placeholder={`${
                                      isLoadingDisability
                                        ? "Cargando Discapacidades"
                                        : "Seleccione una Discapacidad"
                                    }`}
                                  />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {disability?.data.map((v, i) => (
                                  <SelectItem value={`${v.id}`} key={i}>
                                    {v.categoria?.nombre_categoria || "General"} -{" "}
                                    {v.discapacidad || v.nombre}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </fieldset>

                    {puedeEstructura && (
                      <fieldset className="flex flex-col gap-3 border-2 p-3 rounded-sm border-green-600 col-span-2">
                        <legend className="text-green-800 font-semibold px-1">
                          Dirección Administrativa Del Empleado
                        </legend>
                        <FormField
                          control={form.control}
                          name="filtros.dependencia_id"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Nivel</FormLabel>
                              <Select
                                onValueChange={(values) => {
                                  const id = Number.parseInt(values);
                                  field.onChange(id);
                                  setDependencyId(id);
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
                                  {dependency?.data.map((dep, i) => (
                                    <SelectItem key={i} value={`${dep.id}`}>
                                      {dep.dependencia || dep.nombre}
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
                          name="filtros.direccion_general_id"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Dirección / Gerencia / Oficina</FormLabel>
                              <FormControl>
                                <Combobox
                                  options={(directionGeneral?.data ?? []).map((general) => ({
                                    value: String(general.id),
                                    label: general.Codigo
                                      ? `${general.Codigo}-${general.direccion_general || general.nombre}`
                                      : general.direccion_general || general.nombre,
                                  }))}
                                  value={field.value ? String(field.value) : ""}
                                  onChange={(value) => {
                                    field.onChange(Number.parseInt(value));
                                    setDirectionGeneralId(value);
                                  }}
                                  placeholder={
                                    isLoadingDirectionGeneral
                                      ? "Cargando Direcciones"
                                      : "Seleccione una Dirección"
                                  }
                                  searchPlaceholder="Buscar dirección..."
                                  disabled={isLoadingDirectionGeneral}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="filtros.direccion_linea_id"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>División / Coordinación</FormLabel>
                              <FormControl>
                                <Combobox
                                  options={(directionLine?.data ?? []).map((line) => ({
                                    value: String(line.id),
                                    label: line.Codigo
                                      ? `${line.Codigo}-${line.direccion_linea || line.nombre}`
                                      : line.direccion_linea || line.nombre,
                                  }))}
                                  value={field.value ? String(field.value) : ""}
                                  onChange={(value) => {
                                    field.onChange(Number.parseInt(value));
                                    setDirectionLineId(value);
                                  }}
                                  placeholder={
                                    isLoadingDirectionLine
                                      ? "Cargando Dirección"
                                      : "Seleccione una Dirección"
                                  }
                                  searchPlaceholder="Buscar división..."
                                  disabled={isLoadingDirectionLine}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="filtros.coordinacion_id"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Coordinación</FormLabel>
                              <FormControl>
                                <Combobox
                                  options={(coordination?.data ?? []).map((coord) => ({
                                    value: String(coord.id),
                                    label: coord.Codigo
                                      ? `${coord.Codigo}-${coord.coordinacion || coord.nombre}`
                                      : coord.coordinacion || coord.nombre,
                                  }))}
                                  value={field.value ? String(field.value) : ""}
                                  onChange={(value) => {
                                    field.onChange(Number.parseInt(value));
                                  }}
                                  placeholder={
                                    isLoadingCoordination
                                      ? "Cargando Coordinaciones"
                                      : "Seleccione una Coordinación"
                                  }
                                  searchPlaceholder="Buscar coordinación..."
                                  disabled={isLoadingCoordination}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </fieldset>
                    )}

                    <fieldset className="flex flex-col gap-3 border-2 p-3 rounded-sm border-red-800">
                      <legend className="text-red-900 font-semibold px-1">
                        Información De Cargo Del Empleado
                      </legend>

                      <FormField
                        control={form.control}
                        name="filtros.nomina_id"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Tipo de Nómina</FormLabel>
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
                                        ? "Cargando Nóminas"
                                        : "Seleccione un Tipo de Nómina"
                                    }`}
                                  />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {nomina?.data.map((nom, i) => (
                                  <SelectItem key={i} value={`${nom.id}`}>
                                    {nom.nomina || nom.nombre}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </fieldset>

                    <fieldset className="flex flex-col gap-3 border-2 p-3 rounded-sm border-blue-900">
                      <legend className="text-blue-900 font-semibold px-1">
                        Información Académica
                      </legend>
                      <FormField
                        control={form.control}
                        name="filtros.nivel_academico_id"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Nivel Académico</FormLabel>
                            <Select
                              onValueChange={(values) => {
                                field.onChange(Number.parseInt(values));
                              }}
                            >
                              <FormControl>
                                <SelectTrigger className="w-full truncate">
                                  <SelectValue
                                    placeholder={`${
                                      isLoadingAcademyLevel
                                        ? "Cargando Niveles Académicos"
                                        : "Seleccione un Nivel Académico"
                                    }`}
                                  />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {academyLevel?.data.map((nivel, i) => (
                                  <SelectItem key={i} value={`${nivel.id}`}>
                                    {nivel.nivelacademico || nivel.nombre}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </fieldset>

                    <fieldset className="flex flex-col gap-3 border-2 p-3 rounded-sm border-black">
                      <legend className="text-black font-semibold px-1">
                        Información Básica Del Trabajador
                      </legend>
                      <FormField
                        control={form.control}
                        name="filtros.sexo_empleado_id"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Sexo</FormLabel>
                            <Select
                              onValueChange={(values) => {
                                field.onChange(Number.parseInt(values));
                              }}
                            >
                              <FormControl>
                                <SelectTrigger className="w-full truncate">
                                  <SelectValue
                                    placeholder={`${
                                      isLoadingSex ? "Cargando Géneros" : "Seleccione un Género"
                                    }`}
                                  />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {sex?.data.map((v, i) => (
                                  <SelectItem value={`${v.id}`} key={i}>
                                    {v.sexo || v.nombre}
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
                        name="filtros.edad_empleado_min"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Edad Mínima Del Empleado</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Ingrese Una Edad Mínima"
                                {...field}
                                value={field.value !== undefined ? String(field.value) : ""}
                                type="number"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="filtros.edad_empleado_max"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Edad Máxima Del Empleado</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Ingrese Una Edad Máxima"
                                {...field}
                                value={field.value !== undefined ? String(field.value) : ""}
                                type="number"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </fieldset>

                    <fieldset className="flex flex-col gap-3 border-2 p-3 rounded-sm border-emerald-800">
                      <legend className="text-emerald-800 font-semibold px-1">
                        Dirección De Habitaciones
                      </legend>
                      <FormField
                        control={form.control}
                        name="filtros.region_id"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Región</FormLabel>
                            <Select
                              onValueChange={(value) => {
                                const id = Number.parseInt(value);
                                field.onChange(id);
                                setRegionId(id);
                              }}
                            >
                              <FormControl>
                                <SelectTrigger className="w-full truncate">
                                  <SelectValue
                                    placeholder={`${
                                      isLoadingRegion
                                        ? "Cargando Regiones"
                                        : "Seleccione una Región"
                                    }`}
                                  />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {region?.data.map((r, i) => (
                                  <SelectItem key={i} value={`${r.id}`}>
                                    {r.region || r.nombre}
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
                        name="filtros.estado_id"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Estado</FormLabel>
                            <FormControl>
                              <Combobox
                                options={(states?.data ?? []).map((s) => ({
                                  value: String(s.id),
                                  label: s.estado || s.nombre,
                                }))}
                                value={field.value ? String(field.value) : ""}
                                onChange={(value) => {
                                  field.onChange(Number.parseInt(value));
                                  setStateId(value);
                                }}
                                placeholder={
                                  isLoadingStatesStates
                                    ? "Cargando Estados"
                                    : "Seleccione un Estado"
                                }
                                searchPlaceholder="Buscar estado..."
                                disabled={isLoadingStatesStates}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="filtros.municipio_id"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Municipio</FormLabel>
                            <FormControl>
                              <Combobox
                                options={(municipalitys?.data ?? []).map((m) => ({
                                  value: String(m.id),
                                  label: m.municipio || m.nombre,
                                }))}
                                value={field.value ? String(field.value) : ""}
                                onChange={(value) => {
                                  field.onChange(Number.parseInt(value));
                                  setMunicipalityId(value);
                                }}
                                placeholder={
                                  isLoadingStatesSMunicipalitys
                                    ? "Cargando Municipios"
                                    : "Seleccione un Municipio"
                                }
                                searchPlaceholder="Buscar municipio..."
                                disabled={isLoadingStatesSMunicipalitys}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="filtros.parroquia_id"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Parroquia</FormLabel>
                            <FormControl>
                              <Combobox
                                options={(parish?.data ?? []).map((p) => ({
                                  value: String(p.id),
                                  label: p.parroquia || p.nombre,
                                }))}
                                value={field.value ? String(field.value) : ""}
                                onChange={(value) => {
                                  field.onChange(Number.parseInt(value));
                                }}
                                placeholder={
                                  isLoadingStatesParish
                                    ? "Cargando Parroquias"
                                    : "Seleccione una Parroquia"
                                }
                                searchPlaceholder="Buscar parroquia..."
                                disabled={isLoadingStatesParish}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="filtros.condicion_vivienda_id"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Condición De Vivienda</FormLabel>
                            <Select
                              onValueChange={(values) => {
                                field.onChange(Number.parseInt(values));
                              }}
                            >
                              <FormControl>
                                <SelectTrigger className="w-full truncate">
                                  <SelectValue
                                    placeholder={`${
                                      isLoadingStatesConditionDwelling
                                        ? "Cargando Condiciones De Vivienda"
                                        : "Seleccione una Condición De Vivienda"
                                    }`}
                                  />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {conditionDwelling?.data.map((c, i) => (
                                  <SelectItem key={i} value={`${c.id}`}>
                                    {c.condicion || c.nombre}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </fieldset>
                  </div>
                </ScrollArea>
              </div>

              <div className="flex flex-row gap-2 flex-1 w-full col-span-3 pt-2">
                <Button type="submit" className="flex-1 cursor-pointer">
                  {filtrosForm && Object.values(filtrosForm).some((v) => !!v)
                    ? "Consultar Reporte"
                    : "Consultar Reporte General"}
                  <Search className="ml-2 size-4" />
                </Button>
                {reportListFamilys && (
                  <a
                    href={reportListFamilys}
                    download={`Reporte_Familiares ${formatInTimeZone(
                      new Date(),
                      "UTC",
                      "dd/MM/yyyy",
                    )}.pdf`}
                    className={`${buttonVariants({
                      variant: "outline",
                    })} flex-1 cursor-pointer animate-pulse`}
                  >
                    Descargar Reporte
                    <Download className="ml-2 size-4" />
                  </a>
                )}
                <Button
                  className="flex-1 cursor-pointer"
                  variant="destructive"
                  onClick={handleClean}
                  type="button"
                >
                  Limpiar Reporte
                  <Eraser className="ml-2 size-4" />
                </Button>
              </div>
            </form>
          )}
        </Form>
      </CardContent>
    </Card>
  );
}
