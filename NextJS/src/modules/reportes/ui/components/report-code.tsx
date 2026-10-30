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
  getOrganismosAdsFather,
  getStatusReport,
  postReport,
} from "../services/reportes-catalogos";

import { Button, buttonVariants } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatInTimeZone } from "date-fns-tz";
import { Download, Eraser, Search } from "lucide-react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { useState, useTransition } from "react";
import {
  puedeFiltrarEstructuraOrganizativa,
  puedeGenerarReportePdf,
} from "../../application/use-cases/permisos-reporte";
import { PERMISO_REPORTES } from "../../domain/value-objects/permisos-reportes";
import { usePdfBlobUrl } from "../hooks/use-pdf-blob-url";
import { avisoTopeDeFilas } from "@/shared/lib/aviso-tope";
import { schemaReportCode, type SchemaReportCodeType } from "../schema/schemaReportCode";
import Loading from "@/shared/ui/components/loading";

export default function ReportCode() {
  const [isPending, startTransition] = useTransition();
  const pdf = usePdfBlobUrl();
  const [avisoTope, setAvisoTope] = useState<string | null>(null);
  const { data: session } = useSession();
  const [dependencyId, setDependencyId] = useState<number>(0);
  const { data: statusNomina, isLoading: isLoadingStatusNomina } = useSWR(
    "statusReport",
    async () => await getStatusReport(),
  );
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

  const { data: cargoEspecifico, isLoading: isLoadingCargoEspecifico } = useSWR(
    "cargoEspecifico",
    async () => await getCargoEspecifico(),
  );
  const { data: cargo, isLoading: isLoadingCargo } = useSWR("cargo", async () => await getCargo());
  const { data: nomina, isLoading: isLoadingNomina } = useSWR(
    "nomina",
    async () => await getNominaGeneral(),
  );
  const { data: grado, isLoading: isLoadingGrado } = useSWR("grado", async () => getGrado());
  const { data: organismoAds, isLoading: isLoadingOrganismoAds } = useSWR(
    "organismoAds",
    async () => await getOrganismosAdsFather(),
  );

  const form = useForm<SchemaReportCodeType>({
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
    return <Loading promiseMessage="Validando Sesión Para Generar El Reporte" />;
  }

  const onSubmit = (data: SchemaReportCodeType) => {
    if (!puedePdf) {
      toast.error(
        `No tiene permiso para generar reportes en PDF (se requiere ${PERMISO_REPORTES.generarPdf}).`,
      );
      return;
    }
    startTransition(async () => {
      try {
        const resultado = await postReport<SchemaReportCodeType>(data);
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

  const handleClean = () => {
    form.reset();
    pdf.limpiar();
    setAvisoTope(null);
  };

  // Los filtros de estructura solo se ofrecen a quien puede consultar la
  // estructura organizativa (`organizacion.ver`). Nunca por rol ni por "*".
  const puedeEstructura = puedeFiltrarEstructuraOrganizativa(session?.user?.permisos);
  const puedePdf = puedeGenerarReportePdf(session?.user?.permisos);

  return (
    <Card className="bg-white">
      <CardContent>
        <Form {...form}>
          {isPending ? (
            <Loading promiseMessage="Consultando Reporte" />
          ) : (
            <form onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-3 gap-4">
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
                <ScrollArea className="w-full">
                  <div className="flex flex-row w-full gap-2">
                    {puedeEstructura && (
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
                                    <SelectItem key={i} value={`${dependencia.id}`}>
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
                              <FormLabel>Dirección / Gerencia / Oficina</FormLabel>
                              <FormControl>
                                <Combobox
                                  options={(directionGeneral?.data ?? []).map((general) => ({
                                    value: String(general.id),
                                    label: `${general.Codigo}-${general.direccion_general}`,
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
                          name="filtros.linea_id"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>División / Coordinación</FormLabel>
                              <FormControl>
                                <Combobox
                                  options={(directionLine?.data ?? []).map((line) => ({
                                    value: String(line.id),
                                    label: `${line.Codigo}-${line.direccion_linea}`,
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
                                    label: `${coord.Codigo}-${coord.coordinacion}`,
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

                    <fieldset className="flex flex-col w-full gap-3 border-2 p-2 rounded-sm border-red-800">
                      <legend className="text-red-900 font-semibold">Información De Cargo</legend>
                      <FormField
                        control={form.control}
                        name="filtros.cargo_especifico_id"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Denominación De Cargo Específico</FormLabel>
                            <FormControl>
                              <Combobox
                                options={(cargoEspecifico?.data ?? []).map((cargo) => ({
                                  value: String(cargo.id),
                                  label: cargo.cargo,
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
                                  label: c.cargo,
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
                                        ? "Cargando Nóminas"
                                        : "Seleccione un Tipo de Nómina"
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
                                      isLoadingGrado ? "Cargando Grados" : "Seleccione un Grado"
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
                          <FormItem className="col-span-2">
                            <FormLabel>Organismo Adscrito </FormLabel>
                            <FormControl>
                              <Combobox
                                options={(organismoAds?.data ?? []).map((org) => ({
                                  value: String(org.id),
                                  label: `${org.id}-${org.Organismoadscrito}`,
                                }))}
                                value={field.value ? String(field.value) : ""}
                                onChange={(value) => {
                                  field.onChange(Number.parseInt(value));
                                }}
                                placeholder={
                                  isLoadingOrganismoAds
                                    ? "Cargando Organismos Adscritos"
                                    : "Seleccione Un Organismo Adscrito"
                                }
                                searchPlaceholder="Buscar organismo..."
                                disabled={isLoadingOrganismoAds}
                              />
                            </FormControl>
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
                                        ? "Cargando Estatus De Códigos"
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
                <Button className="flex-1 cursor-pointer" type="submit" disabled={!puedePdf}>
                  {filtrosForm && Object.values(filtrosForm).some((v) => !!v)
                    ? "Consultar Reporte"
                    : "Consultar Reporte General"}
                  <Search />
                </Button>
                {pdf.url && (
                  <a
                    href={pdf.url}
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
