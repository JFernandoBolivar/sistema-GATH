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
import { Combobox } from "@/components/ui/combobox";
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
} from "../services/reportes-catalogos";

import FormDate from "@/components/form-date";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatInTimeZone } from "date-fns-tz";
import { Download, Eraser, Search } from "lucide-react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { puedeFiltrarEstructuraOrganizativa } from "../../application/use-cases/permisos-reporte";
import { useState, useTransition } from "react";
import { schemaReportLeaving, type SchemaReportLeavingType } from "../schema/report-schema-leaving";
import Loading from "@/shared/ui/components/loading";

export default function ReportLeaving() {
  const [isPending, startTransition] = useTransition();
  const [reportListLeaving, setReportListLeavingBlob] = useState<string>();
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

  const { data: cargoEspecifico, isLoading: isLoadingCargoEspecifico } = useSWR(
    "cargoEspecifico",
    async () => await getCargoEspecifico(),
  );
  const { data: cargo, isLoading: isLoadingCargo } = useSWR("cargo", async () => await getCargo());
  const { data: nomina, isLoading: isLoadingNomina } = useSWR(
    "nomina",
    async () => await getNominaGeneral(),
  );
  const { data: grado, isLoading: isLoadingGrado } = useSWR("grado", async () => await getGrado());

  const form = useForm<SchemaReportLeavingType>({
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
        fecha_egreso_Desde: undefined,
        fecha_egreso_Hasta: undefined,
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
    setReportListLeavingBlob(undefined);
  };

  const onSubmit = (data: SchemaReportLeavingType) => {
    startTransition(async () => {
      try {
        const { blob } = await postReport<SchemaReportLeavingType>(data);        const urlBlob = URL.createObjectURL(blob);
        setReportListLeavingBlob(urlBlob);
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
            <form onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-3 gap-4">
              <div className="flex flex-col gap-2 col-span-3 min-w-0 w-full">
                <ScrollArea className="h-[600px] w-full pr-3">
                  <div className="grid grid-cols-2 gap-3">
                    {puedeEstructura && (
                      <fieldset className="flex flex-col gap-3 border-2 p-3 rounded-sm border-green-600 col-span-2">
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
                    </fieldset>

                    <fieldset className="flex flex-col gap-3 border-2 p-3 rounded-sm border-black">
                      <legend className="text-black font-semibold px-1">Información Básica</legend>
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

                    <fieldset className="flex flex-col gap-3 border-2 p-3 rounded-sm border-gray-600 col-span-2">
                      <legend className="text-gray-800 font-semibold px-1">Fecha De Egreso</legend>
                      <div className="grid grid-cols-2 gap-3">
                        <FormDate
                          form={form}
                          label="Fecha De Egreso Desde"
                          nameInput="filtros.fecha_egreso_Desde"
                        />
                        <FormDate
                          form={form}
                          label="Fecha De Egreso Hasta"
                          nameInput="filtros.fecha_egreso_Hasta"
                        />
                      </div>
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
