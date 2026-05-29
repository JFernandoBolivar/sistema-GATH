"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import useSWR from "swr";
import { z } from "zod";
import { Download, Search, Eraser, Eye } from "lucide-react";
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

import { consultarCensoEmpleado, exportarCensoExcel, type CensoEmpleadoItem } from "../api/getInfoAutogestion";
import Loading from "../../gestion-trabajadores/components/loading/loading";

const schemaSearch = z.object({
  cedula: z.string().optional(),
});

function DetalleCenso({ empleado }: { empleado: CensoEmpleadoItem }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="font-medium">Cedula:</div>
        <div>{empleado.cedula}</div>
        <div className="font-medium">Nombres:</div>
        <div>{empleado.nombres}</div>
        <div className="font-medium">Apellidos:</div>
        <div>{empleado.apellidos}</div>
        <div className="font-medium">F. Nacimiento:</div>
        <div>{empleado.fecha_nacimiento || "N/A"}</div>
        <div className="font-medium">Carnet Patria:</div>
        <div>{empleado.carnet_patria || "N/A"}</div>
        <div className="font-medium">APN:</div>
        <div>
          {empleado.total_apn
            ? `${empleado.total_apn.years}a ${empleado.total_apn.months}m ${empleado.total_apn.days}d`
            : "N/A"}
        </div>
        <div className="font-medium">F. Ingreso:</div>
        <div>{empleado.fecha_ingreso_organismo || "N/A"}</div>
      </div>

      {empleado.datos_vivienda && (
        <>
          <Separator />
          <h4 className="font-semibold text-sm">Datos de Vivienda</h4>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="font-medium">Direccion:</div>
            <div>{empleado.datos_vivienda.direccion_exacta || "N/A"}</div>
            <div className="font-medium">Codigo Postal:</div>
            <div>{empleado.datos_vivienda.codigo_postal || "N/A"}</div>
          </div>
        </>
      )}

      <Separator />
      <h4 className="font-semibold text-sm">
        Respuestas ({empleado.preguntas?.length || 0})
      </h4>
      <ScrollArea className="h-64 rounded-md border p-2">
        <div className="space-y-2">
          {empleado.preguntas?.map((p) => (
            <Card key={p.id} className="p-2">
              <p className="text-xs font-medium text-gray-700">{p.pregunta}</p>
              <Badge variant="secondary" className="mt-1 text-xs">
                {p.opcion?.opcion || p.respuesta || "—"}
              </Badge>
            </Card>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

export default function ConsultarCensoPage() {
  const [searchCedula, setSearchCedula] = useState<string>("");
  const [isPending, startTransition] = useTransition();

  const form = useForm({
    resolver: zodResolver(schemaSearch),
    defaultValues: { cedula: "" },
  });

  const { data, isLoading, mutate } = useSWR(
    "censo-consultar",
    () => consultarCensoEmpleado(searchCedula || undefined),
    { revalidateOnFocus: false },
  );

  const empleados: CensoEmpleadoItem[] = data?.data ?? [];

  const onSearch = (values: z.infer<typeof schemaSearch>) => {
    setSearchCedula(values.cedula || "");
    mutate();
  };

  const onExportExcel = () => {
    startTransition(async () => {
      try {
        const blob = await exportarCensoExcel();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `censo_vivienda_${new Date().toISOString().split("T")[0]}.xlsx`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success("Excel descargado correctamente");
      } catch {
        toast.error("Error al descargar el Excel");
      }
    });
  };

  return (
    <PageLayout
      title="Respuestas del Censo"
      description="Consulta las respuestas del censo de vivienda por trabajador"
    >
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSearch)}
          className="flex flex-row items-end gap-2"
        >
          <FormField
            name="cedula"
            control={form.control}
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
              form.reset({ cedula: "" });
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
            onClick={onExportExcel}
            disabled={isPending}
          >
            {isPending ? "Generando..." : "Exportar Excel"} <Download />
          </Button>
        </form>
      </Form>

      {isLoading ? (
        <Loading promiseMessage="Cargando respuestas..." />
      ) : (
        <ScrollArea className="h-[70vh] rounded-md border">
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
                            <Eye className="h-4 w-4 mr-1" /> Ver
                          </Button>
                        </SheetTriggerUI>
                        <SheetContentUI>
                          <SheetHeaderUI>
                            <SheetTitleUI>
                              Detalle del Censo — {emp.nombres} {emp.apellidos}
                            </SheetTitleUI>
                          </SheetHeaderUI>
                          <ScrollArea className="h-[80vh] px-4 pb-4">
                            <DetalleCenso empleado={emp} />
                          </ScrollArea>
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
    </PageLayout>
  );
}
