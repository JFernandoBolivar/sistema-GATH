"use client";

import { Card, CardContent } from "@/components/ui/card";

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
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import useSWR from "swr";
import {
  getCargo,
  getCargoEspecifico,
  getCoordination,
  getDependency,
  getDirectionGeneralById,
  getDirectionLine,
  getGrado,
  getNominaGeneral,
  getOrganismosAds,
  getOrganismosAdsFather,
  getStatusNomina,
  getStatusReport,
  postReport,
} from "../../api/getInfoRac";

import { Button, buttonVariants } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatInTimeZone } from "date-fns-tz";
import { Download, Eraser, Search } from "lucide-react";
import { useSession } from "next-auth/react";
import { useState, useTransition } from "react";
import {
  schemaReportCode,
  SchemaReportCodeType,
} from "../../reportes/codigos/schema/schemaReportCode";
import Loading from "../loading/loading";

export default function ReportCode() {
  const [isPending, startTransition] = useTransition();
  const [reportListCode, setReportListCodeBlob] = useState<string>();
  const { data: session } = useSession();
  const [dependencyId, setDependencyId] = useState<number>(0);
  const { data: statusNomina, isLoading: isLoadingStatusNomina } = useSWR(
    "statusReport",
    async () => await getStatusReport(),
  );
  const [directionGeneralId, setDirectionGeneralId] = useState<string | null>(
    null,
  );
  const [directionLineId, setDirectionLineId] = useState<string | null>(null);

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
    directionGeneralId ? ["directionLine", directionGeneralId] : null,
    async () => await getDirectionLine(directionGeneralId!),
  );
  const { data: coordination, isLoading: isLoadingCoordination } = useSWR(
    directionLineId ? ["coordination", directionLineId] : null,
    async () => await getCoordination(directionLineId!),
  );

  const { data: cargoEspecifico, isLoading: isLoadingCargoEspecifico } = useSWR(
    "cargoEspecifico",
    async () => await getCargoEspecifico(),
  );
  const { data: cargo, isLoading: isLoadingCargo } = useSWR(
    "cargo",
    async () => await getCargo(),
  );
  const { data: nomina, isLoading: isLoadingNomina } = useSWR(
    "nomina",
    async () => await getNominaGeneral(),
  );
  const { data: grado, isLoading: isLoadingGrado } = useSWR("grado", async () =>
    getGrado(),
  );
  const { data: organismoAds, isLoading: isLoadingOrganismoAds } = useSWR(
    "organismoAds",
    async () => await getOrganismosAdsFather(),
  );

  const form = useForm({
    resolver: zodResolver(schemaReportCode),
    defaultValues: {
      categoria: "asignaciones",
      agrupar_por: "tipo_nomina",
      tipo_reporte: "lista",
      filtros: {
        dependencia_id: undefined,
        general_id: undefined,
        OrganismoAdscrito_id: undefined,
        linea_id: undefined,
        coordinacion_id: undefined,
        nomina_id: undefined,
        grado_id: undefined,
        cargo_id: undefined,
        cargo_especifico_id: undefined,
        estatus_id: undefined,
      },
    },
  });
  const filtrosForm = useWatch({
    name: "filtros",
    control: form.control,
  });
  if (!session) {
    return (
      <Loading promiseMessage="Validando Sesion Para Generar El Reporte"></Loading>
    );
  }
  const onSubmit = (data: SchemaReportCodeType) => {
    startTransition(async () => {
      const isNotAdmin = session?.user?.role.nombre_rol !== "ADMINISTRADOR";
      const payload: SchemaReportCodeType = {
        ...data,
        filtros: {
          ...data.filtros,
          dependencia_id: isNotAdmin
            ? Number(session.user.dependency?.id)
            : data?.filtros?.dependencia_id,
          general_id: isNotAdmin
            ? Number(session.user.directionGeneral?.id)
            : data?.filtros?.general_id,
          linea_id: isNotAdmin
            ? Number(session.user.direccionLine?.id) || null
            : data?.filtros?.linea_id,
          coordinacion_id: isNotAdmin
            ? Number(session.user.coordination?.id) || null
            : data?.filtros?.coordinacion_id,
        },
      };
      const reponse = await postReport<SchemaReportCodeType>(payload);
      const urlBlob = URL.createObjectURL(reponse);
      setReportListCodeBlob(urlBlob);
      form.reset();
    });
  };
  const handleClean = () => {
    form.reset();
    setReportListCodeBlob(undefined);
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
              className="space-y-4 grid grid-cols-3   gap-2"
            >
              <div className="flex flex-col gap-2 col-span-3">
                <ScrollArea className="w-full ">
                  <div className="flex flex-row w-full gap-2">
                    {session.user.role.nombre_rol == "ADMINISTRADOR" && (
                      <fieldset className="flex flex-col w-full gap-3 border-2 p-2 rounded-sm border-green-600">
                        <legend className="text-green-800 font-semibold">
                          Dirección Administrativa{" "}
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
                          name="filtros.general_id"
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
                          name="filtros.linea_id"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>División / Coordinación</FormLabel>
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

                    <fieldset className="flex flex-col w-full gap-3 border-2 p-2 rounded-sm border-red-800">
                      <legend className="text-red-900 font-semibold">
                        Información De Cargo
                      </legend>
                      <FormField
                        control={form.control}
                        name="filtros.cargo_especifico_id"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>
                              Denominación De Cargo Específico
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
                        name="filtros.cargo_id"
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
                                        ? "Cargando Denominaciones De Cargo"
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
                      <FormField
                        control={form.control}
                        name="filtros.grado_id"
                        render={({ field }) => (
                          <FormItem className="col-span-3">
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
                        name="filtros.OrganismoAdscrito_id"
                        render={({ field }) => (
                          <FormItem className={`col-span-2`}>
                            <FormLabel>Organismo Adscrito </FormLabel>
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
                        name="filtros.estatus_id"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Listado De Estatus</FormLabel>
                            <Select
                              onValueChange={(values) => {
                                field.onChange(Number.parseInt(values));
                              }}
                            >
                              <FormControl>
                                <SelectTrigger className="w-full truncate">
                                  <SelectValue
                                    placeholder={`${
                                      isLoadingStatusNomina
                                        ? "Cargando Estatus De Codigos"
                                        : "Seleccione Un Código"
                                    }`}
                                  />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {statusNomina?.data.map((status, i) => (
                                  <SelectItem key={i} value={`${status.id}`}>
                                    {status.estatus}
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
              <div className="flex flex-row gap-2 flex-1 w-full col-span-3">
                <Button className="flex-1 cursor-pointer">
                  {filtrosForm && Object.values(filtrosForm).some((v) => !!v)
                    ? "Consultar Reporte"
                    : "Consultar Reporte General"}
                  <Search />
                </Button>
                {reportListCode && (
                  <a
                    href={reportListCode}
                    download={`Reporte_Cargos ${formatInTimeZone(
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
