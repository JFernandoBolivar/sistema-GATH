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
  getCapacitaciones,
  getCargo,
  getCargoEspecifico,
  getCarrera,
  getConditionDwelling,
  getCoordination,
  getDependency,
  getDirectionGeneralById,
  getDirectionLine,
  getDisability,
  getGrado,
  getGruposCapacitacion,
  getMencion,
  getMunicipalitys,
  getNominaGeneral,
  getOrganismosAds,
  getOrganismosAdsFather,
  getParish,
  getPatologys,
  getRegion,
  getSex,
  getStateByRegion,
  getTiposProcedencia,
  postReport,
} from "../services/reportes-catalogos";

import { Button, buttonVariants } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatInTimeZone } from "date-fns-tz";
import { CalendarIcon, Download, Eraser, Search } from "lucide-react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { useState, useTransition } from "react";
import {
  puedeFiltrarEstructuraOrganizativa,
  puedeGenerarReportePdf,
} from "../../application/use-cases/permisos-reporte";
import { PERMISO_REPORTES } from "../../domain/value-objects/permisos-reportes";
import { usePdfBlobUrl } from "../hooks/use-pdf-blob-url";
import { avisoTopeDeFilas } from "../reportes-aviso-tope";
import {
  schemaReportEmployee,
  type SchemaReportEmployeeType,
} from "../schema/report-schema-employee";
import Loading from "@/shared/ui/components/loading";

export default function ReportEmployee() {
  const [mencionId, setMencionId] = useState<string>();
  const [nivelAcademicoId, setNivelAcademicoId] = useState<number>();
  const [regionId, setRegionId] = useState<number>(0);

  const [isPending, startTransition] = useTransition();
  const pdf = usePdfBlobUrl();
  const [avisoTope, setAvisoTope] = useState<string | null>(null);
  const [stateId, setStateId] = useState<string>();
  const { data: session } = useSession();
  const [dependencyId, setDependencyId] = useState<number>(0);

  const [directionGeneralId, setDirectionGeneralId] = useState<string | null>(null);
  const [directionLineId, setDirectionLineId] = useState<string | null>(null);

  const { data: directionGeneral, isLoading: isLoadingDirectionGeneral } = useSWR(
    dependencyId ? ["directionGeneral", dependencyId] : null,
    async () => await getDirectionGeneralById(dependencyId),
  );
  const { data: dependency, isLoading: isLoadingDependency } = useSWR(
    "dependency",
    async () => await getDependency(),
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
  const { data: cargoEspecifico, isLoading: isLoadingCargoEspecifico } = useSWR(
    "cargoEspecifico",
    async () => await getCargoEspecifico(),
  );
  const { data: cargo, isLoading: isLoadingCargo } = useSWR("cargo", async () => await getCargo());
  const { data: nomina, isLoading: isLoadingNomina } = useSWR(
    "nominaGeneral",
    async () => await getNominaGeneral(),
  );
  const { data: grado, isLoading: isLoadingGrado } = useSWR("grado", async () => await getGrado());

  const { data: academyLevel, isLoading: isLoadingAcademyLevel } = useSWR(
    "academyLevel",
    async () => await getAcademyLevel(),
  );
  const { data: carrera, isLoading: isLoadingCarrera } = useSWR(
    ["carrera", nivelAcademicoId || 0],
    async () => await getCarrera(nivelAcademicoId || undefined),
  );
  const { data: mencion, isLoading: isLoadingMencion } = useSWR(
    mencionId ? ["mencion", mencionId] : null,
    async () => await getMencion(mencionId!),
  );
  const { data: capacitaciones, isLoading: isLoadingCapacitaciones } = useSWR(
    "capacitaciones",
    async () => await getCapacitaciones(),
  );
  const { data: tiposProcedencia, isLoading: isLoadingTiposProcedencia } = useSWR(
    "tiposProcedencia",
    async () => await getTiposProcedencia(),
  );
  const { data: gruposCapacitacion, isLoading: isLoadingGrupos } = useSWR(
    "gruposCapacitacion",
    async () => await getGruposCapacitacion(),
  );
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
  const { data: organismoAds } = useSWR(
    "organismoAdsFather",
    async () => await getOrganismosAdsFather(),
  );
  const { data: conditionDwelling, isLoading: isLoadingStatesConditionDwelling } = useSWR(
    "conditionDwelling",
    async () => await getConditionDwelling(),
  );

  const form = useForm<SchemaReportEmployeeType>({
    resolver: zodResolver(schemaReportEmployee),
    defaultValues: {
      categoria: "empleados",
      agrupar_por: "direccion_general",
      tipo_reporte: "lista",
      filtros: {
        dependencia_id: undefined,
        direccion_general_id: undefined,
        direccion_linea_id: undefined,
        coordinacion_id: undefined,
        sexo_id: undefined,
        discapacidad_id: undefined,
        grupo_sanguineo_id: undefined,
        patologia_id: undefined,
        nomina_id: undefined,
        grado_id: undefined,
        cargo_id: undefined,
        cargo_especifico_id: undefined,
        nivel_academico_id: undefined,
        carrera_id: undefined,
        mencion_id: undefined,
        OrganismoAdscrito_id: undefined,
        apn_min: undefined,
        apn_max: undefined,
        edad_min: undefined,
        edad_max: undefined,
        fecha_ingreso_Desde: undefined,
        fecha_ingreso_Hasta: undefined,
        // «Fecha APN desde/hasta» está oculta en el formulario (M8): el mapeo
        // del backend se conserva hasta que RRHH defina qué significa «Fecha APN».
        region_id: undefined,
        estado_id: undefined,
        municipio_id: undefined,
        parroquia_id: undefined,
        condicion_vivienda_id: undefined,
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

  const handleClean = () => {
    form.reset();
    pdf.limpiar();
    setAvisoTope(null);
  };

  const onSubmit = (data: SchemaReportEmployeeType) => {
    if (!puedePdf) {
      toast.error(
        `No tiene permiso para generar reportes en PDF (se requiere ${PERMISO_REPORTES.generarPdf}).`,
      );
      return;
    }
    startTransition(async () => {
      try {
        const resultado = await postReport<SchemaReportEmployeeType>(data);
        pdf.fijar(resultado.blob);
        const aviso = avisoTopeDeFilas(resultado);
        setAvisoTope(aviso);
        if (aviso) toast.warning(aviso);
        else toast.success("Reporte generado. Use «Descargar Reporte» para guardarlo.");
        // El formulario NO se limpia: el usuario conserva los filtros elegidos.
      } catch (err) {
        setAvisoTope(null);
        toast.error(
          err instanceof Error && err.message
            ? err.message
            : "No fue posible generar el reporte. Intente de nuevo.",
        );
      }
    });
  };

  // Los filtros de estructura solo se ofrecen a quien puede consultar la
  // estructura organizativa (`organizacion.ver`), que es lo que exigen los
  // catálogos del backend. Nunca por nombre de rol ni por el comodín "*".
  const puedeEstructura = puedeFiltrarEstructuraOrganizativa(session?.user?.permisos);
  const puedePdf = puedeGenerarReportePdf(session?.user?.permisos);

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
              {!puedePdf && (
                <p
                  role="alert"
                  className="col-span-3 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm font-medium text-destructive"
                >
                  No tiene permiso para generar reportes en PDF (se requiere{" "}
                  {PERMISO_REPORTES.generarPdf}). Solicítelo a la Administración del sistema.
                </p>
              )}
              {avisoTope && (
                <p
                  role="status"
                  className="col-span-3 rounded-md border border-amber-500/50 bg-amber-50 p-3 text-sm font-medium text-amber-900"
                >
                  {avisoTope}
                </p>
              )}
              <div className="flex flex-col gap-2 col-span-3 min-w-0 w-full">
                <ScrollArea className="h-[600px] w-full pr-3">
                  <div className="flex flex-col gap-4">
                    {puedeEstructura && (
                      <fieldset className="flex flex-col gap-3 border-2 p-3 rounded-sm border-green-600">
                        <legend className="text-green-800 font-semibold px-1">
                          Dirección Administrativa
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
                              <FormLabel>Dirección / Gerencia / Oficina / Coordinación</FormLabel>
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
                                      ? "Cargando Direcciones Generales"
                                      : "Seleccione una Dirección / Gerencia / Oficina"
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
                                      ? "Cargando Direcciones"
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

                    <div className="grid grid-cols-2 gap-3">
                      <fieldset className="flex flex-col gap-3 border-2 p-3 rounded-sm border-red-800">
                        <legend className="text-red-900 font-semibold px-1">
                          Información De Cargo
                        </legend>

                        <FormField
                          control={form.control}
                          name="filtros.cargo_especifico_id"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Denominación De Cargo Específico</FormLabel>
                              <FormControl>
                                <Combobox
                                  options={(cargoEspecifico?.data ?? []).map((c) => ({
                                    value: String(c.id),
                                    label: c.cargo || c.nombre,
                                  }))}
                                  value={field.value ? String(field.value) : ""}
                                  onChange={(value) => {
                                    field.onChange(Number.parseInt(value));
                                  }}
                                  placeholder={
                                    isLoadingCargoEspecifico
                                      ? "Cargando Cargos Específicos"
                                      : "Seleccione una Denominación De Cargo Específico"
                                  }
                                  searchPlaceholder="Buscar cargo específico..."
                                  disabled={isLoadingCargoEspecifico}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="filtros.cargo_id"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Denominación De Cargo</FormLabel>
                              <FormControl>
                                <Combobox
                                  options={(cargo?.data ?? []).map((c) => ({
                                    value: String(c.id),
                                    label: c.cargo || c.nombre,
                                  }))}
                                  value={field.value ? String(field.value) : ""}
                                  onChange={(value) => {
                                    field.onChange(Number.parseInt(value));
                                  }}
                                  placeholder={
                                    isLoadingCargo
                                      ? "Cargando Denominaciones De Cargo"
                                      : "Seleccione una Denominación De Cargo"
                                  }
                                  searchPlaceholder="Buscar cargo..."
                                  disabled={isLoadingCargo}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
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
                        <FormField
                          control={form.control}
                          name="filtros.grado_id"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Grado</FormLabel>
                              <Select
                                onValueChange={(values) => {
                                  field.onChange(Number.parseInt(values));
                                }}
                              >
                                <FormControl>
                                  <SelectTrigger className="w-full truncate">
                                    <SelectValue
                                      placeholder={`${
                                        isLoadingGrado ? "Cargando Grados" : "Seleccione un Grado"
                                      }`}
                                    />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {grado?.data.map((g, i) => (
                                    <SelectItem key={i} value={`${g.id}`}>
                                      {g.grado || g.nombre}
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
                          name="filtros.OrganismoAdscrito_id"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Organismo Adscrito</FormLabel>
                              <FormControl>
                                <Combobox
                                  options={(organismoAds?.data ?? []).map((org) => ({
                                    value: String(org.id),
                                    label: `${org.id}-${org.Organismoadscrito || org.nombre}`,
                                  }))}
                                  value={field.value ? String(field.value) : ""}
                                  onChange={(value) => {
                                    field.onChange(Number.parseInt(value));
                                  }}
                                  placeholder="Seleccione Un Organismo Adscrito"
                                  searchPlaceholder="Buscar organismo..."
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
                          name="filtros.patologia_id"
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
                          name="filtros.discapacidad_id"
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
                                  const id = Number.parseInt(values);
                                  field.onChange(id);
                                  setNivelAcademicoId(id);
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
                        <FormField
                          control={form.control}
                          name="filtros.carrera_id"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Carrera</FormLabel>
                              <FormControl>
                                <Combobox
                                  options={(carrera?.data ?? []).map((c) => ({
                                    value: String(c.id),
                                    label: c.nombre_carrera || c.nombre,
                                  }))}
                                  value={field.value ? String(field.value) : ""}
                                  onChange={(value) => {
                                    field.onChange(Number.parseInt(value));
                                    setMencionId(value);
                                  }}
                                  placeholder={
                                    isLoadingCarrera
                                      ? "Cargando Carreras"
                                      : "Seleccione una carrera"
                                  }
                                  searchPlaceholder="Buscar carrera..."
                                  disabled={isLoadingCarrera}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="filtros.mencion_id"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Mención</FormLabel>
                              <Select
                                onValueChange={(values) => {
                                  field.onChange(Number.parseInt(values));
                                }}
                              >
                                <FormControl>
                                  <SelectTrigger className="w-full truncate">
                                    <SelectValue
                                      placeholder={`${
                                        isLoadingMencion
                                          ? "Cargando Menciones Académicas"
                                          : "Seleccione una mención académica"
                                      }`}
                                    />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {mencion?.data.map((m, i) => (
                                    <SelectItem key={i} value={`${m.id}`}>
                                      {m.nombre_mencion || m.nombre}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </fieldset>

                      <fieldset className="flex flex-col gap-3 border-2 p-3 rounded-sm border-purple-700">
                        <legend className="text-purple-700 font-semibold px-1">
                          Formación Complementaria
                        </legend>
                        <FormField
                          control={form.control}
                          name="filtros.capacitacion_id"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Capacitación</FormLabel>
                              <Select onValueChange={(v) => field.onChange(Number.parseInt(v))}>
                                <FormControl>
                                  <SelectTrigger className="w-full truncate">
                                    <SelectValue
                                      placeholder={
                                        isLoadingCapacitaciones ? "Cargando..." : "Seleccione"
                                      }
                                    />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {capacitaciones?.data?.map((c, i) => (
                                    <SelectItem key={i} value={`${c.id}`}>
                                      {c.nombre_capacitacion || c.nombre}
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
                          name="filtros.procedencia_id"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Procedencia</FormLabel>
                              <Select onValueChange={(v) => field.onChange(Number.parseInt(v))}>
                                <FormControl>
                                  <SelectTrigger className="w-full truncate">
                                    <SelectValue
                                      placeholder={
                                        isLoadingTiposProcedencia ? "Cargando..." : "Seleccione"
                                      }
                                    />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {tiposProcedencia?.data?.map((p, i) => (
                                    <SelectItem key={i} value={`${p.id}`}>
                                      {p.tipo_procedencia || p.nombre}
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
                          name="filtros.grupo_id"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Grupo</FormLabel>
                              <Select onValueChange={(v) => field.onChange(Number.parseInt(v))}>
                                <FormControl>
                                  <SelectTrigger className="w-full truncate">
                                    <SelectValue
                                      placeholder={isLoadingGrupos ? "Cargando..." : "Seleccione"}
                                    />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {gruposCapacitacion?.data?.map((g, i) => (
                                    <SelectItem key={i} value={`${g.id}`}>
                                      {g.nombre_grupo || g.nombre}
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
                          Información Básica
                        </legend>
                        <FormField
                          control={form.control}
                          name="filtros.sexo_id"
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
                          name="filtros.edad_min"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Edad Mínima</FormLabel>
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
                          name="filtros.edad_max"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Edad Máxima</FormLabel>
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

                      <fieldset className="flex flex-col gap-3 border-2 p-3 rounded-sm border-amber-700">
                        <legend className="text-amber-900 font-semibold px-1">
                          Fechas De Ingresos/APN
                        </legend>
                        <FormField
                          control={form.control}
                          name="filtros.apn_min"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Años Mínimos En La APN</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="Ingrese Un Año Mínimo APN"
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
                          name="filtros.apn_max"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Años Máximos En La APN</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="Ingrese Un Año Máximo APN"
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
                          name="filtros.fecha_ingreso_Desde"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Fecha De Ingreso Desde</FormLabel>
                              <Popover>
                                <PopoverTrigger asChild>
                                  <FormControl>
                                    <Button
                                      variant="outline"
                                      className="font-light w-full justify-between"
                                    >
                                      {field.value ? (
                                        formatInTimeZone(field.value, "UTC", "dd/MM/yyyy")
                                      ) : (
                                        <span>Selecciona una fecha</span>
                                      )}
                                      <CalendarIcon className="ml-auto size-4 opacity-50" />
                                    </Button>
                                  </FormControl>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                  <Calendar
                                    selected={field.value ? new Date(field.value) : undefined}
                                    mode="single"
                                    onSelect={(date) => field.onChange(date)}
                                    disabled={(date: Date) =>
                                      date > new Date() || date < new Date("1900-01-01")
                                    }
                                    captionLayout="dropdown"
                                  />
                                </PopoverContent>
                              </Popover>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="filtros.fecha_ingreso_Hasta"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Fecha De Ingreso Hasta</FormLabel>
                              <Popover>
                                <PopoverTrigger asChild>
                                  <FormControl>
                                    <Button
                                      variant="outline"
                                      className="font-light w-full justify-between"
                                    >
                                      {field.value ? (
                                        formatInTimeZone(field.value, "UTC", "dd/MM/yyyy")
                                      ) : (
                                        <span>Selecciona una fecha</span>
                                      )}
                                      <CalendarIcon className="ml-auto size-4 opacity-50" />
                                    </Button>
                                  </FormControl>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                  <Calendar
                                    selected={field.value ? new Date(field.value) : undefined}
                                    mode="single"
                                    onSelect={(date) => field.onChange(date)}
                                    disabled={(date: Date) =>
                                      date > new Date() || date < new Date("1900-01-01")
                                    }
                                    captionLayout="dropdown"
                                  />
                                </PopoverContent>
                              </Popover>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        {/* «Fecha APN desde/hasta» se oculta (M8): hoy filtra
                            por `antecedentes_servicio.fecha_ingreso`, igual que
                            «Fecha de ingreso», y da resultados engañosos. RRHH
                            debe confirmar qué significa «Fecha APN»; el mapeo del
                            backend se conserva. «Años APN» no se toca. */}
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
                  </div>
                </ScrollArea>
              </div>

              <div className="flex flex-row gap-2 flex-1 w-full col-span-3 pt-2">
                <Button type="submit" className="flex-1 cursor-pointer" disabled={!puedePdf}>
                  {filtrosForm && Object.values(filtrosForm).some((v) => !!v)
                    ? "Consultar Reporte"
                    : "Consultar Reporte General"}
                  <Search className="ml-2 size-4" />
                </Button>
                {pdf.url && (
                  <a
                    href={pdf.url}
                    download={`Reporte_Empleados ${formatInTimeZone(
                      new Date(),
                      "UTC",
                      "dd/MM/yyyy",
                    )}.pdf`}
                    className={`${buttonVariants({
                      variant: "outline",
                    })} flex-1 cursor-pointer animate-pulse`}
                  >
                    Descargar Reporte <Download className="ml-2 size-4" />
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
