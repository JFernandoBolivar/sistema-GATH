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
  getSex,
  postReport,
} from "../../api/getInfoRac";

import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatInTimeZone } from "date-fns-tz";
import { Download, Eraser, Search } from "lucide-react";
import { useSession } from "next-auth/react";
import { useState, useTransition } from "react";
import {
  schemaReportLeaving,
  SchemaReportLeavingType,
} from "../../reportes/egresados/schema/report-schema-leaving";
import Loading from "../loading/loading";

export default function ReportLeaving() {
  const [isPending, startTransition] = useTransition();
  const [reportListLeaving, setReportListLeavingBlob] = useState<string>();
  const { data: session } = useSession();
  const [dependencyId, setDependencyId] = useState<number>(0);

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
  const { data: sex, isLoading: isLoadingSex } = useSWR(
    "sex",
    async () => await getSex(),
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

  const form = useForm({
    resolver: zodResolver(schemaReportLeaving),
    defaultValues: {
      categoria: "egresados",
      agrupar_por: "direccion_general",
      tipo_reporte: "lista",
      filtros: {
        dependencia_id: undefined,
        direccion_general_id: undefined,
        direccion_linea_id: undefined,

        coordinacion_id: undefined,
        sexo_id: undefined,
        nomina_id: undefined,
        grado_id: undefined,
        cargo_id: undefined,
        cargo_especifico_id: undefined,
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
  const handleClean = () => {
    form.reset();
    setReportListLeavingBlob(undefined);
  };
  const onSubmit = (data: SchemaReportLeavingType) => {
    startTransition(async () => {
      const isNotAdmin = session?.user?.role.nombre_rol !== "ADMINISTRADOR";
      const payload: SchemaReportLeavingType = {
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
      const reponse = await postReport<SchemaReportLeavingType>(payload);
      const urlBlob = URL.createObjectURL(reponse);
      setReportListLeavingBlob(urlBlob);
      form.reset();
    });
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
              className="space-y-4 grid grid-cols-3  gap-2"
            >
              <div className="flex flex-col gap-2 col-span-3 ">
                <ScrollArea className="h-100 w-full ">
                  <div className="grid grid-cols-2 gap-2">
                    {session.user.role.nombre_rol == "ADMINISTRADOR" && (
                      <fieldset className="flex flex-col gap-3 border-2 p-2 rounded-sm border-green-600">
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
                              <FormLabel>Coordinacion</FormLabel>
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
                    </fieldset>

                    <fieldset className="flex flex-col gap-3 border-2 p-2 rounded-sm border-black">
                      <legend className="text-black font-semibold">
                        Información Basica
                      </legend>
                      <FormField
                        control={form.control}
                        name={`filtros.sexo_id`}
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
                        name="filtros.edad_min"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Edad Minima</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="Ingrese Una  Minima"
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
                        name="filtros.edad_max"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Edad Maxima</FormLabel>
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
                {reportListLeaving && (
                  <a
                    href={reportListLeaving}
                    download={`Reporte_Egresados ${formatInTimeZone(
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
