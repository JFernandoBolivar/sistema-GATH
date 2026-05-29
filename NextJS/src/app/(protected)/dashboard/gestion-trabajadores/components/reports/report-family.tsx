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
  getReportConfigFamily,
  getSex,
  getStateByRegion,
  postReport,
} from "../../api/getInfoRac";

import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSession } from "next-auth/react";
import { useState, useTransition } from "react";
import {
  schemaReportFamily,
  SchemaReportFamilyType,
} from "../../reportes/familiares/schema/report-schema-family";
import Loading from "../loading/loading";
import { Download, Eraser, Search } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatInTimeZone } from "date-fns-tz";

export default function ReportEmployee() {
  const [isPending, startTransition] = useTransition();
  const [reportListFamilys, setReportListFamilysBlob] = useState<string>();
  const [stateId, setStateId] = useState<string>();
  const { data: session } = useSession();
  const [dependencyId, setDependencyId] = useState<number>(0);
  const [directionGeneralId, setDirectionGeneralId] = useState<string | null>(
    null,
  );
  const [directionLineId, setDirectionLineId] = useState<string | null>(null);

  const { data: dependency, isLoading: isLoadingDependency } = useSWR(
    "dependency",
    async () => await getDependency(),
  );
  const {
    data: conditionDwelling,
    isLoading: isLoadingStatesConditionDwelling,
  } = useSWR("conditionDwelling", async () => await getConditionDwelling());
  const { data: directionGeneral, isLoading: isLoadingDirectionGeneral } =
    useSWR(
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
  const { data: sex, isLoading: isLoadingSex } = useSWR(
    "sex",
    async () => await getSex(),
  );
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
  const { data: municipalitys, isLoading: isLoadingStatesSMunicipalitys } =
    useSWR(
      stateId ? ["municipalitys", stateId] : null,
      async () => await getMunicipalitys(stateId!),
    );
  const { data: parish, isLoading: isLoadingStatesParish } = useSWR(
    municipalityId ? ["parish", municipalityId] : null,
    async () => await getParish(municipalityId!),
  );
  const { data: parent, isLoading: isLoadingParen } = useSWR(
    "parent",
    async () => getParent(),
  );

  const form = useForm({
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
    return (
      <Loading promiseMessage="Validando Sesion Para Generar El Reporte" />
    );
  }
  const onSubmit = (data: SchemaReportFamilyType) => {
    const isNotAdmin = session?.user?.role.nombre_rol !== "ADMINISTRADOR";
    const payload: SchemaReportFamilyType = {
      ...data,
      filtros: {
        ...data.filtros,
        dependencia_id: isNotAdmin
          ? Number(session.user.dependency?.id)
          : data?.filtros?.dependencia_id,
        direccion_general_id: isNotAdmin
          ? Number(session.user.directionGeneral?.id)
          : data?.filtros?.direccion_general_id,
        direccion_linea_id: isNotAdmin
          ? Number(session.user.direccionLine?.id) || null
          : data?.filtros?.direccion_linea_id,
        coordinacion_id: isNotAdmin
          ? Number(session.user.coordination?.id) || null
          : data?.filtros?.coordinacion_id,
      },
    };
    startTransition(async () => {
      const reponse = await postReport<SchemaReportFamilyType>(payload);
      const urlBlob = URL.createObjectURL(reponse);
      setReportListFamilysBlob(urlBlob);
      form.reset();
    });
  };
  const handleClean = () => {
    form.reset();
    setReportListFamilysBlob(undefined);
  };
  return (
    <Card>
      <CardContent>
        <Form {...form}>
          {isPending ? (
            <Loading promiseMessage="Consultando Reporte" />
          ) : (
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="space-y-4 grid grid-cols-3 min-h-max gap-2"
            >
              <div className="flex flex-col gap-2 col-span-3">
                <ScrollArea className="col-span-3 h-100">
                  <div className="grid grid-cols-2 gap-3">
                    <fieldset className="flex flex-col gap-3 border-2 p-2 rounded-sm border-amber-700">
                      <legend className="text-amber-900 font-semibold">
                        Información Basica Familiar
                      </legend>
                      <FormField
                        control={form.control}
                        name={`filtros.parentesco_id`}
                        render={({ field }) => (
                          <FormItem className="cursor-pointer">
                            <FormLabel className="cursor-pointer">
                              Parentesco *
                            </FormLabel>
                            <Select
                              onValueChange={(values) => {
                                field.onChange(Number.parseInt(values));
                              }}
                            >
                              <FormControl>
                                <SelectTrigger className="w-full truncate">
                                  <SelectValue
                                    placeholder={"Seleccione un Parentesco"}
                                  />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {parent?.data.map((parent, i) => (
                                  <SelectItem key={i} value={`${parent.id}`}>
                                    {parent.descripcion_parentesco}
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
                        name={`filtros.sexo_familiar_id`}
                        render={({ field }) => (
                          <FormItem className=" cursor-pointer">
                            <FormLabel className="cursor-pointer">
                              Sexo{" "}
                            </FormLabel>
                            <Select
                              onValueChange={(values) => {
                                field.onChange(Number.parseInt(values));
                              }}
                            >
                              <FormControl>
                                <SelectTrigger className="w-full truncate">
                                  <SelectValue
                                    placeholder={`${
                                      isLoadingSex
                                        ? "Cargando Generos"
                                        : "Seleccione un Genero"
                                    }`}
                                  />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {sex?.data.map((v, i) => (
                                  <SelectItem value={`${v.id}`} key={i}>
                                    {v.sexo}
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
                            <FormLabel>Edad Minima Del Familiar</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Ingrese Una Edad Minima Del Familiar"
                                {...field}
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
                            <FormLabel>Edad Maxima Del Familiar</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Ingrese Una Edad Maxima Del Familiar"
                                {...field}
                                type="number"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </fieldset>
                    <fieldset className="flex flex-col gap-3 border-2 p-2 rounded-sm border-violet-800">
                      <legend className="text-violet-900 font-semibold">
                        Información De Salud
                      </legend>
                      <FormField
                        control={form.control}
                        name="filtros.grupo_sanguineo_id"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Grupo Sanguineo </FormLabel>
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
                                        ? "Cargando Grupos Sanguineos"
                                        : "Seleccione un Grupo Sanguineo"
                                    }`}
                                  />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {bloodGroup?.data.map((bloodGroup, i) => (
                                  <SelectItem
                                    key={i}
                                    value={`${bloodGroup.id}`}
                                  >
                                    {bloodGroup.GrupoSanguineo}
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
                        name={`filtros.patologias_id`}
                        render={({ field }) => (
                          <FormItem className=" cursor-pointer">
                            <FormLabel className="cursor-pointer">
                              Patologias{" "}
                            </FormLabel>
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
                                        ? "Cargando Patologias"
                                        : "Seleccione una Patologias"
                                    }`}
                                  />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {patology?.data.map((v, i) => (
                                  <SelectItem value={`${v.id}`} key={i}>
                                    {v.categoria.nombre_categoria} -{" "}
                                    {v.patologia}
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
                        name={`filtros.discapacidades_id`}
                        render={({ field }) => (
                          <FormItem className=" cursor-pointer">
                            <FormLabel className="cursor-pointer">
                              Discapacidad{" "}
                            </FormLabel>
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
                                    {v.categoria.nombre_categoria} -{" "}
                                    {v.discapacidad}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </fieldset>
                    {session.user.role.nombre_rol == "ADMINISTRADOR" && (
                      <fieldset className="flex flex-col gap-3 border-2 p-2 rounded-sm border-green-600">
                        <legend className="text-green-800 font-semibold">
                          Dirección Administativa Del Empleado
                        </legend>
                        <FormField
                          control={form.control}
                          name="filtros.dependencia_id"
                          render={({ field }) => (
                            <FormItem>
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
                          name="filtros.direccion_general_id"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>
                                Dirección / Gerencia / Oficina
                              </FormLabel>
                              <Select
                                onValueChange={(values) => {
                                  field.onChange(Number.parseInt(values));
                                  setDirectionGeneralId(values);
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
                          name="filtros.direccion_linea_id"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>División / Coordinación </FormLabel>
                              <Select
                                onValueChange={(values) => {
                                  field.onChange(Number.parseInt(values));
                                  setDirectionLineId(values);
                                }}
                              >
                                <FormControl>
                                  <SelectTrigger className="w-full truncate">
                                    <SelectValue
                                      placeholder={`${
                                        isLoadingDirectionLine
                                          ? "Cargando Dirección"
                                          : "Seleccione una Dirección"
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
                          name="filtros.coordinacion_id"
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
                      </fieldset>
                    )}

                    <fieldset className="flex flex-col gap-3 border-2 p-2 rounded-sm border-red-800">
                      <legend className="text-red-900 font-semibold">
                        Información De Cargo Del Empleado
                      </legend>

                      <FormField
                        control={form.control}
                        name="filtros.nomina_id"
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
                    </fieldset>

                    <fieldset className="flex flex-col gap-3 border-2 p-2 rounded-sm border-blue-900">
                      <legend className="text-blue-900 font-semibold">
                        Información Academica
                      </legend>
                      <FormField
                        control={form.control}
                        name="filtros.nivel_academico_id"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Nivel Academico</FormLabel>
                            <Select
                              onValueChange={(values) => {
                                field.onChange(Number.parseInt(values));
                              }}
                            >
                              <FormControl>
                                <SelectTrigger className="w-full truncate">
                                  <SelectValue
                                    placeholder={` ${
                                      isLoadingAcademyLevel
                                        ? "Cargando Niveles Academicos"
                                        : "Seleccione un Nivel Academico"
                                    }`}
                                  />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {academyLevel?.data.map((nivel, i) => (
                                  <SelectItem key={i} value={`${nivel.id}`}>
                                    {nivel.nivelacademico}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormDescription className="flex flex-row gap-2 justify-end"></FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </fieldset>
                    <fieldset className="flex flex-col gap-3 border-2 p-2 rounded-sm border-black">
                      <legend className="text-black font-semibold">
                        Información Basica Del Tabajador
                      </legend>
                      <FormField
                        control={form.control}
                        name={`filtros.sexo_empleado_id`}
                        render={({ field }) => (
                          <FormItem className=" cursor-pointer">
                            <FormLabel className="cursor-pointer">
                              Sexo{" "}
                            </FormLabel>
                            <Select
                              onValueChange={(values) => {
                                field.onChange(Number.parseInt(values));
                              }}
                            >
                              <FormControl>
                                <SelectTrigger className="w-full truncate">
                                  <SelectValue
                                    placeholder={`${
                                      isLoadingSex
                                        ? "Cargando Generos"
                                        : "Seleccione un Genero"
                                    }`}
                                  />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {sex?.data.map((v, i) => (
                                  <SelectItem value={`${v.id}`} key={i}>
                                    {v.sexo}
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
                            <FormLabel>Edad Minima Del Empleado</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Ingrese Una Edad Minima"
                                {...field}
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
                            <FormLabel>Edad Maxima Del Empleado</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Ingrese Una Edad Maxima"
                                {...field}
                                type="number"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </fieldset>
                    <fieldset className="flex flex-col gap-3 border-2 p-2 rounded-sm border-emerald-800">
                      <legend className="text-emerald-800 font-semibold">
                        Dirección De Habitaciones
                      </legend>
                      <FormField
                        control={form.control}
                        name="filtros.region_id"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Region </FormLabel>
                            <Select
                              onValueChange={(value) => {
                                field.onChange(Number.parseInt(value));
                                setRegionId(Number.parseInt(value));
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
                                {region?.data.map((region, i) => (
                                  <SelectItem key={i} value={`${region.id}`}>
                                    {region.region}
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
                            <FormLabel>Estado </FormLabel>
                            <Select
                              onValueChange={(value) => {
                                field.onChange(Number.parseInt(value));
                                setStateId(value);
                              }}
                            >
                              <FormControl>
                                <SelectTrigger className="w-full truncate">
                                  <SelectValue
                                    placeholder={`${
                                      isLoadingStatesStates
                                        ? "Cargando Estados"
                                        : "Seleccione un Estado"
                                    }`}
                                  />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {states?.data.map((state, i) => (
                                  <SelectItem key={i} value={`${state.id}`}>
                                    {state.estado}
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
                        name="filtros.municipio_id"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Municipio </FormLabel>
                            <Select
                              onValueChange={(value) => {
                                field.onChange(Number.parseInt(value));
                                setMunicipalityId(value);
                              }}
                            >
                              <FormControl>
                                <SelectTrigger className="w-full truncate">
                                  <SelectValue
                                    placeholder={`${
                                      isLoadingStatesSMunicipalitys
                                        ? "Cargando Municipios"
                                        : "Seleccione un Municpio"
                                    }`}
                                  />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {municipalitys?.data.map((municipality, i) => (
                                  <SelectItem
                                    key={i}
                                    value={`${municipality.id}`}
                                  >
                                    {municipality.municipio}
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
                        name="filtros.parroquia_id"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Parroquia </FormLabel>
                            <Select
                              onValueChange={(values) => {
                                field.onChange(Number.parseInt(values));
                              }}
                            >
                              <FormControl>
                                <SelectTrigger className="w-full truncate">
                                  <SelectValue
                                    placeholder={`${
                                      isLoadingStatesParish
                                        ? "Cargando Parroquias"
                                        : "Seleccione una Parroquia"
                                    }`}
                                  />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {parish?.data.map((parish, i) => (
                                  <SelectItem key={i} value={`${parish.id}`}>
                                    {parish.parroquia}
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
                        name="filtros.condicion_vivienda_id"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Condición De Vivienda </FormLabel>
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
                                {conditionDwelling?.data.map(
                                  (conditionDwelling, i) => (
                                    <SelectItem
                                      key={i}
                                      value={`${conditionDwelling.id}`}
                                    >
                                      {conditionDwelling.condicion}
                                    </SelectItem>
                                  ),
                                )}
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
              <div className="flex flex-row gap-2 flex-1 w-full col-span-3">
                <Button className="flex-1 cursor-pointer">
                  {filtrosForm && Object.values(filtrosForm).some((v) => !!v)
                    ? "Consultar Reporte"
                    : "Consultar Reporte General"}
                  <Search />
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
                    <Download />
                  </a>
                )}
                <Button
                  className="flex-1 cursor-pointer"
                  variant={"destructive"}
                  onClick={handleClean}
                  type="button"
                >
                  Limpiar Reporte
                  <Eraser />
                </Button>
              </div>
            </form>
          )}
        </Form>
      </CardContent>
    </Card>
  );
}
