"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import useSWR from "swr";
import { z } from "zod";
import { Download, Search, Eraser, Eye, Filter, Building2 } from "lucide-react";
import { toast } from "sonner";

import PageLayout from "@/components/layout/page-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  SheetContentUI,
  SheetHeaderUI,
  SheetTitleUI,
  SheetTriggerUI,
  SheetUI,
} from "@/components/ui/SheetUI";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

import { consultarCensoEmpleado, exportarCensoExcel, exportarCensoExcelConFiltros, type CensoEmpleadoItem } from "../api/getInfoAutogestion";
import { schemaCensoExcel } from "../schema/schema-autogestion-excel";
import {
  getDependency,
  getDirectionGeneralById,
  getDirectionLine,
  getCoordination,
  getNominaGeneral,
} from "../../gestion-trabajadores/api/getInfoRac";
import Loading from "../../gestion-trabajadores/components/loading/loading";

const schemaSearch = z.object({
  cedula: z.string().optional(),
});

function DetalleCenso({ empleado }: { empleado: CensoEmpleadoItem }) {
  return (
    <div className="gap-5">
      <div className="bg-gray-50 rounded-lg p-4">
        <h4 className="font-bold text-base text-gray-900 mb-3">Datos del Trabajador</h4>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="font-semibold text-gray-700">Cédula:</span>
            <span className="ml-2 text-gray-900 font-medium">{empleado.cedula}</span>
          </div>
          <div>
            <span className="font-semibold text-gray-700">Carnet Patria:</span>
            <span className="ml-2 text-gray-900 font-medium">{empleado.carnet_patria || "N/A"}</span>
          </div>
          <div>
            <span className="font-semibold text-gray-700">Nombres:</span>
            <span className="ml-2 text-gray-900 font-medium">{empleado.nombres}</span>
          </div>
          <div>
            <span className="font-semibold text-gray-700">Apellidos:</span>
            <span className="ml-2 text-gray-900 font-medium">{empleado.apellidos}</span>
          </div>
          <div>
            <span className="font-semibold text-gray-700">F. Nacimiento:</span>
            <span className="ml-2 text-gray-900 font-medium">{empleado.fecha_nacimiento || "N/A"}</span>
          </div>
          <div>
            <span className="font-semibold text-gray-700">F. Ingreso:</span>
            <span className="ml-2 text-gray-900 font-medium">{empleado.fecha_ingreso_organismo || "N/A"}</span>
          </div>
          <div className="col-span-2">
            <span className="font-semibold text-gray-700">Tiempo APN:</span>
            <span className="ml-2 text-gray-900 font-medium">
              {empleado.total_apn
                ? `${empleado.total_apn.years}a ${empleado.total_apn.months}m ${empleado.total_apn.days}d`
                : "N/A"}
            </span>
          </div>
        </div>
      </div>

      {empleado.datos_vivienda && (
        <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
          <h4 className="font-bold text-base text-blue-900 mb-3">Datos de Vivienda</h4>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="col-span-2">
              <span className="font-semibold text-blue-800">Dirección:</span>
              <span className="ml-2 text-blue-900 font-medium">{empleado.datos_vivienda.direccion_exacta || "N/A"}</span>
            </div>
            <div>
              <span className="font-semibold text-blue-800">Código Postal:</span>
              <span className="ml-2 text-blue-900 font-medium">{empleado.datos_vivienda.codigo_postal || "N/A"}</span>
            </div>
          </div>
        </div>
      )}

      <div>
        <h4 className="font-bold text-base text-gray-900 mb-3 flex items-center gap-2">
          <span className="bg-emerald-100 text-emerald-700 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
            {empleado.preguntas?.length || 0}
          </span>
          Respuestas del Censo
        </h4>
        <div className="rounded-lg border border-gray-200 p-3 bg-gray-50">
          <div className="flex flex-col gap-3">
            {empleado.preguntas?.map((p) => (
              <Card key={p.id} className="p-3 border border-gray-200 bg-white shadow-sm">
                <p className="text-sm font-semibold text-gray-900">{p.pregunta}</p>
                <p className="text-sm text-gray-700 mt-1.5 font-medium">
                  {p.opcion?.opcion || p.respuesta || "—"}
                </p>
              </Card>
            ))}
          </div>
        </div>
      </div>

      {empleado.cargos && empleado.cargos.length > 0 && (
        <div>
          <h4 className="font-bold text-base text-gray-900 mb-3 flex items-center gap-2">
            <Building2 className="size-5 text-gray-700" />
            Ubicaciones Administrativas
            <span className="bg-gray-200 text-gray-700 rounded-full px-2 py-0.5 text-xs font-bold">
              {empleado.cargos.length}
            </span>
          </h4>
          <div className="rounded-lg border border-gray-200 p-3 bg-gray-50">
            <div className="flex flex-col gap-3">
              {empleado.cargos.map((cargo, i) => (
                <div key={i} className="bg-white rounded-lg p-3 border border-gray-200 shadow-sm">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-sm font-bold font-mono text-white bg-gray-700 rounded px-2 py-0.5">
                      {cargo.codigo}
                    </span>
                    <span className="text-sm font-bold text-gray-900">
                      {cargo.denominacioncargo.cargo}
                    </span>
                  </div>
                  <div className="text-sm text-gray-700 ml-1 flex flex-col gap-0.5 border-l-2 border-gray-300 pl-3">
                    {cargo.Dependencia && (
                      <span className="font-medium">{cargo.Dependencia.dependencia}</span>
                    )}
                    {cargo.DireccionGeneral && (
                      <span>
                        <span className="text-gray-500 font-medium">{" > "}</span>
                        <span className="font-medium">{cargo.DireccionGeneral.direccion_general}</span>
                      </span>
                    )}
                    {cargo.DireccionLinea && (
                      <span>
                        <span className="text-gray-500 font-medium">{" > "}</span>
                        <span className="font-medium">{cargo.DireccionLinea.direccion_linea}</span>
                      </span>
                    )}
                    {cargo.Coordinacion && (
                      <span>
                        <span className="text-gray-500 font-medium">{" > "}</span>
                        <span className="font-medium">{cargo.Coordinacion.coordinacion}</span>
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ConsultarCensoPage() {
  const [searchCedula, setSearchCedula] = useState<string>("");
  const [isPending, startTransition] = useTransition();

  const [dependencyId, setDependencyId] = useState<number>(0);
  const [directionGeneralId, setDirectionGeneralId] = useState<string | null>(null);
  const [directionLineId, setDirectionLineId] = useState<string | null>(null);

  const formSearch = useForm({
    resolver: zodResolver(schemaSearch),
    defaultValues: { cedula: "" },
  });

  const formExcel = useForm({
    resolver: zodResolver(schemaCensoExcel),
    defaultValues: {
      filtros: {
        dependencia_id: undefined,
        direccion_general_id: undefined,
        direccion_linea_id: undefined,
        coordinacion_id: undefined,
        nomina_id: undefined,
      },
    },
  });

  const { data, isLoading, mutate } = useSWR(
    "censo-consultar",
    () => consultarCensoEmpleado(searchCedula || undefined),
    { revalidateOnFocus: false },
  );

  const { data: dependency, isLoading: isLoadingDependency } = useSWR(
    "dependency",
    async () => await getDependency(),
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

  const { data: nomina, isLoading: isLoadingNomina } = useSWR(
    "nominaGeneral",
    async () => await getNominaGeneral(),
  );

  const empleados: CensoEmpleadoItem[] = data?.data ?? [];

  const onSearch = (values: z.infer<typeof schemaSearch>) => {
    setSearchCedula(values.cedula || "");
    mutate();
  };

  const onExportExcelGeneral = () => {
    startTransition(async () => {
      try {
        const blob = await exportarCensoExcel();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `censo_vivienda_${new Date().toISOString().split("T")[0]}.xlsx`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success("Excel general descargado correctamente");
      } catch {
        toast.error("Error al descargar el Excel");
      }
    });
  };

  const onExportExcelConFiltros = () => {
    startTransition(async () => {
      try {
        const filters = formExcel.getValues();
        const blob = await exportarCensoExcelConFiltros(filters);
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `censo_vivienda_filtrado_${new Date().toISOString().split("T")[0]}.xlsx`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success("Excel filtrado descargado correctamente");
      } catch {
        toast.error("Error al descargar el Excel");
      }
    });
  };

  const onCleanFilters = () => {
    formExcel.reset({
      filtros: {
        dependencia_id: undefined,
        direccion_general_id: undefined,
        direccion_linea_id: undefined,
        coordinacion_id: undefined,
        nomina_id: undefined,
      },
    });
    setDependencyId(0);
    setDirectionGeneralId(null);
    setDirectionLineId(null);
  };

  return (
    <PageLayout
      title="Respuestas del Censo"
      description="Consulta las respuestas del censo de vivienda por trabajador"
    >
      <div className="flex flex-col gap-4">
        <Form {...formSearch}>
          <form
            onSubmit={formSearch.handleSubmit(onSearch)}
            className="flex flex-row items-end gap-2"
          >
            <FormField
              name="cedula"
              control={formSearch.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Buscar por Cedula</FormLabel>
                  <FormControl>
                    <Input placeholder="buscar cedula..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="cursor-pointer" disabled={isPending}>
              Buscar <Search />
            </Button>
            <Button
              type="button"
              variant="outline"
              className="cursor-pointer"
              onClick={() => {
                formSearch.reset({ cedula: "" });
                setSearchCedula("");
                mutate();
              }}
            >
              Limpiar <Eraser />
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="cursor-pointer ml-auto"
              onClick={onExportExcelGeneral}
              disabled={isPending}
            >
              {isPending ? "Generando..." : "Exportar Excel General"} <Download />
            </Button>
          </form>
        </Form>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Filter className="size-4" /> Filtros para Exportar Excel
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...formExcel}>
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
                <FormField
                  control={formExcel.control}
                  name="filtros.dependencia_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nivel</FormLabel>
                      <Select
                        onValueChange={(values) => {
                          const id = Number.parseInt(values);
                          field.onChange(id);
                          setDependencyId(id);
                          formExcel.setValue("filtros.direccion_general_id", undefined);
                          formExcel.setValue("filtros.direccion_linea_id", undefined);
                          formExcel.setValue("filtros.coordinacion_id", undefined);
                          setDirectionGeneralId(null);
                          setDirectionLineId(null);
                        }}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full truncate">
                            <SelectValue
                              placeholder={
                                isLoadingDependency
                                  ? "Cargando..."
                                  : "Seleccione un Nivel"
                              }
                            />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {dependency?.data.map((dep) => (
                            <SelectItem key={dep.id} value={`${dep.id}`}>
                              {dep.Codigo}-{dep.dependencia}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={formExcel.control}
                  name="filtros.direccion_general_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Dirección / Gerencia / Oficina</FormLabel>
                      <Select
                        onValueChange={(values) => {
                          const id = Number.parseInt(values);
                          field.onChange(id);
                          setDirectionGeneralId(values);
                          formExcel.setValue("filtros.direccion_linea_id", undefined);
                          formExcel.setValue("filtros.coordinacion_id", undefined);
                          setDirectionLineId(null);
                        }}
                        disabled={!dependencyId}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full truncate">
                            <SelectValue
                              placeholder={
                                isLoadingDirectionGeneral
                                  ? "Cargando..."
                                  : "Seleccione Dir. / Gcia. / Oficina"
                              }
                            />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {directionGeneral?.data.map((dg) => (
                            <SelectItem key={dg.id} value={`${dg.id}`}>
                              {dg.Codigo}-{dg.direccion_general}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={formExcel.control}
                  name="filtros.direccion_linea_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>División</FormLabel>
                      <Select
                        onValueChange={(values) => {
                          const id = Number.parseInt(values);
                          field.onChange(id);
                          setDirectionLineId(values);
                          formExcel.setValue("filtros.coordinacion_id", undefined);
                        }}
                        disabled={!directionGeneralId}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full truncate">
                            <SelectValue
                              placeholder={
                                isLoadingDirectionLine
                                  ? "Cargando..."
                                  : "Seleccione una División"
                              }
                            />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {directionLine?.data.map((dl) => (
                            <SelectItem key={dl.id} value={`${dl.id}`}>
                              {dl.Codigo}-{dl.direccion_linea}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={formExcel.control}
                  name="filtros.coordinacion_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Coordinación</FormLabel>
                      <Select
                        onValueChange={(values) => {
                          field.onChange(Number.parseInt(values));
                        }}
                        disabled={!directionLineId}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full truncate">
                            <SelectValue
                              placeholder={
                                isLoadingCoordination
                                  ? "Cargando..."
                                  : "Seleccione Coordinación"
                              }
                            />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {coordination?.data.map((coord) => (
                            <SelectItem key={coord.id} value={`${coord.id}`}>
                              {coord.Codigo}-{coord.coordinacion}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={formExcel.control}
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
                              placeholder={
                                isLoadingNomina
                                  ? "Cargando..."
                                  : "Seleccione Tipo de Nómina"
                              }
                            />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {nomina?.data.map((n) => (
                            <SelectItem key={n.id} value={`${n.id}`}>
                              {n.nomina}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex justify-end gap-2 mt-4">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="cursor-pointer"
                  onClick={onCleanFilters}
                >
                  <Eraser className="size-4 mr-1" /> Limpiar Filtros
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="cursor-pointer"
                  onClick={onExportExcelConFiltros}
                  disabled={isPending}
                >
                  {isPending ? "Generando..." : "Generar Excel con Filtros"} <Download className="size-4 ml-1" />
                </Button>
              </div>
            </Form>
          </CardContent>
        </Card>

        {isLoading ? (
          <Loading promiseMessage="Cargando respuestas..." />
        ) : (
          <ScrollArea className="h-[60vh] rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">Cedula</TableHead>
                  <TableHead>Nombres</TableHead>
                  <TableHead>Apellidos</TableHead>
                  <TableHead>Carnet Patria</TableHead>
                  <TableHead className="w-[80px]">APN</TableHead>
                  <TableHead className="w-[80px]">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {empleados.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      No se encontraron respuestas
                    </TableCell>
                  </TableRow>
                ) : (
                  empleados.map((emp) => (
                    <TableRow key={emp.id}>
                      <TableCell className="font-medium">{emp.cedula}</TableCell>
                      <TableCell>{emp.nombres}</TableCell>
                      <TableCell>{emp.apellidos}</TableCell>
                      <TableCell>{emp.carnet_patria || "N/A"}</TableCell>
                      <TableCell>
                        {emp.total_apn ? `${emp.total_apn.years}a ${emp.total_apn.months}m` : "N/A"}
                      </TableCell>
                      <TableCell>
                        <SheetUI>
                          <SheetTriggerUI asChild>
                            <Button variant="outline" size="sm" className="cursor-pointer">
                              <Eye className="size-4 mr-1" /> Ver
                            </Button>
                          </SheetTriggerUI>
                          <SheetContentUI className="w-[600px] sm:max-w-xl overflow-y-auto">
                            <SheetHeaderUI>
                              <SheetTitleUI>
                                Detalle del Censo: {emp.nombres} {emp.apellidos}
                              </SheetTitleUI>
                            </SheetHeaderUI>
                            <div className="px-4 pb-4 mt-4">
                              <DetalleCenso empleado={emp} />
                            </div>
                          </SheetContentUI>
                        </SheetUI>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        )}
      </div>
    </PageLayout>
  );
}
