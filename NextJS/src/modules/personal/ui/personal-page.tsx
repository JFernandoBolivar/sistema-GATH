"use client";

/**
 * Página de listado y consulta de personal — 100% paridad visual y funcional
 * con el sistema de referencia (`gestion-trabajadores/personal-trabajador/consultar/page.tsx`).
 *
 * Filtros de búsqueda idénticos:
 * - "Buscar Cédula" (placeholder: "buscar cedula...")
 * - "Buscar Código De Trabajador" (placeholder: "buscar codigo de trabajador...")
 * - "Tipo de Nomina" (Select con opciones reales de la API)
 * - Botón "Buscar" con ícono Search
 * - Botón "Limpiar" con ícono Eraser
 * - Indicador de carga central animado `Loading promiseMessage="Cargando Información"`
 * - Tabla idéntica con DataTable y menú de acciones (copiar cédula, ver detalle, expediente PDF, subir foto).
 * - Hoja de detalle `EmpleadoDetalleSheet` con expedientes y exportación PDF.
 * - Estricta Clean / Onion Architecture: comunicación vía Server Actions y DTOs tipados.
 */
import { useEffect, useRef, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Eraser, Plus, Search } from "lucide-react";

import PageLayout from "@/components/layout/page-layout";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DataTable } from "@/shared/ui/components/data-table";
import Loading from "@/shared/ui/components/loading";
import { tienePermiso } from "@/shared/lib/evaluador-iam";

import type { CatalogosExpedienteDTO, EmpleadoDTO } from "../application/dtos/empleado-dto";
import {
  descargarEmpleadoPdfAction,
  getCatalogosExpedienteAction,
  getEmpleadoPorCedulaAction,
  getEmpleadosAction,
  getTiposNominaAction,
  subirFotoEmpleadoAction,
} from "../infrastructure/actions/personal-actions";
import EmpleadoDetalleSheet from "./empleado-detalle-sheet";
import { construirDetalleExpediente } from "./expediente-detalle-view-model";
import { construirColumnasPersonal } from "./personal-columns";
import { listadoEmpleadosSchema, type ListadoEmpleadosFormType } from "./schema/schema-empleado";

export default function PersonalPage() {
  const { data: session } = useSession();
  const permisos = session?.user?.permisos;
  const esAdmin = tienePermiso(permisos, "*");
  const puedeCrear = esAdmin || tienePermiso(permisos, "personal.crear");
  const puedeEditar = esAdmin || tienePermiso(permisos, "personal.editar_personales");
  const puedeVerDetalle = esAdmin || tienePermiso(permisos, "personal.ver_detalle");
  const puedeExportarPdf = esAdmin || tienePermiso(permisos, "personal.exportar_pdf");

  const [empleados, setEmpleados] = useState<EmpleadoDTO[]>([]);
  const [catalogos, setCatalogos] = useState<CatalogosExpedienteDTO | null>(null);
  const [nominas, setNominas] = useState<{ id: number; nombre: string }[]>([]);
  const [cargandoNominas, setCargandoNominas] = useState(false);
  const [cargandoPersonal, setCargandoPersonal] = useState(true);
  const [viendoDetalle, setViendoDetalle] = useState<EmpleadoDTO | null>(null);
  const [detalleAbierto, setDetalleAbierto] = useState(false);
  const [exportandoPdf, setExportandoPdf] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cedulaFotoRef = useRef<string | null>(null);

  const form = useForm<ListadoEmpleadosFormType>({
    resolver: zodResolver(listadoEmpleadosSchema),
    defaultValues: {
      cedulaidentidad: "",
      codigo: "",
      tipo_nomina: undefined,
    },
  });

  // Solo la última consulta puede actualizar la tabla: el listado inicial
  // completo es lento y, si terminaba después de una búsqueda, la pisaba.
  const ultimaConsultaRef = useRef(0);
  const catalogosRef = useRef<CatalogosExpedienteDTO | null>(null);

  const asegurarCatalogos = async () => {
    if (catalogosRef.current) return;
    try {
      const cat = await getCatalogosExpedienteAction();
      catalogosRef.current = cat;
      setCatalogos(cat);
    } catch {
      // El detalle se muestra igual sin catálogos resueltos.
    }
  };

  const cargar = (filtros?: ListadoEmpleadosFormType) => {
    const consulta = ++ultimaConsultaRef.current;
    setCargandoPersonal(true);
    startTransition(async () => {
      setError(null);
      try {
        const data = await getEmpleadosAction(filtros);
        if (consulta === ultimaConsultaRef.current) setEmpleados(data);
      } catch {
        if (consulta === ultimaConsultaRef.current) setError("No fue posible cargar el personal.");
      } finally {
        if (consulta === ultimaConsultaRef.current) setCargandoPersonal(false);
      }
      // Tras el primer listado, precarga los catálogos del expediente (pesados y
      // en serie con el resto de Server Actions) para que el detalle abra rápido.
      if (consulta === 1) await asegurarCatalogos();
    });
  };

  useEffect(() => {
    cargar();

    setCargandoNominas(true);
    startTransition(async () => {
      try {
        const tipos = await getTiposNominaAction();
        setNominas(tipos);
      } catch {
        // Silencioso
      } finally {
        setCargandoNominas(false);
      }
    });
  }, []);

  const onSearch = (values: ListadoEmpleadosFormType) => {
    cargar({
      cedulaidentidad: values.cedulaidentidad?.trim() || undefined,
      busqueda: values.cedulaidentidad?.trim() || undefined,
      codigo: values.codigo?.trim() || undefined,
      tipo_nomina: values.tipo_nomina && values.tipo_nomina !== 0 ? values.tipo_nomina : undefined,
    });
  };

  const cleanFields = () => {
    form.reset({
      cedulaidentidad: "",
      codigo: "",
      tipo_nomina: undefined,
    });
    cargar();
  };

  const onVerDetalle = (cedula: string) => {
    setDetalleAbierto(true);
    setViendoDetalle(null);
    startTransition(async () => {
      setError(null);
      await asegurarCatalogos();
      const resultado = await getEmpleadoPorCedulaAction(cedula);
      if (resultado && typeof resultado === "object" && "error" in resultado) {
        setError((resultado as { error: string }).error);
        setDetalleAbierto(false);
        return;
      }
      setViendoDetalle(resultado as EmpleadoDTO);
    });
  };

  const onSubirFotoClick = (cedula: string) => {
    cedulaFotoRef.current = cedula;
    fileInputRef.current?.click();
  };

  const onFotoSeleccionada = () => {
    const file = fileInputRef.current?.files?.[0];
    const cedula = cedulaFotoRef.current;
    if (!file || !cedula) return;
    const formData = new FormData();
    formData.append("file", file);
    startTransition(async () => {
      setError(null);
      try {
        await subirFotoEmpleadoAction(cedula, formData);
        cargar(form.getValues());
      } catch {
        setError("No fue posible subir la foto.");
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    });
  };

  const descargarPdfExpediente = async (cedula: string, nombreArchivo: string) => {
    setExportandoPdf(true);
    setError(null);
    try {
      const resultado = await descargarEmpleadoPdfAction(cedula);
      if (!(resultado instanceof Blob)) {
        setError(
          (resultado as { error: string }).error ?? "No fue posible generar el PDF del expediente.",
        );
        return;
      }
      const url = window.URL.createObjectURL(resultado);
      const a = document.createElement("a");
      a.href = url;
      a.download = nombreArchivo;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      setError("No fue posible generar el PDF del expediente.");
    } finally {
      setExportandoPdf(false);
    }
  };

  const onExportarPdf = () => {
    if (!viendoDetalle) return;
    descargarPdfExpediente(
      viendoDetalle.cedula,
      `${viendoDetalle.nombres}-${viendoDetalle.apellidos}-expediente.pdf`,
    );
  };

  const onExportarPdfDirecto = async (cedula: string) => {
    await descargarPdfExpediente(cedula, `expediente-${cedula}.pdf`);
  };

  const columnas = construirColumnasPersonal(
    puedeVerDetalle,
    puedeEditar,
    onVerDetalle,
    onSubirFotoClick,
    puedeExportarPdf,
    onExportarPdfDirecto,
  );

  return (
    <PageLayout title="Consultar Trabajador" description="Información Detallada Del Trabajador">
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSearch)}
          className="flex flex-col justify-start gap-2 flex-1 mb-4"
        >
          <div className="flex flex-row items-center gap-2 flex-wrap">
            <FormField
              name="cedulaidentidad"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Buscar Cédula</FormLabel>
                  <FormControl>
                    <Input
                      className="bg-white"
                      type="text"
                      placeholder="buscar cedula..."
                      {...field}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              name="codigo"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Buscar Código De Trabajador</FormLabel>
                  <FormControl>
                    <Input
                      className="bg-white"
                      type="text"
                      placeholder="buscar codigo de trabajador..."
                      {...field}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="tipo_nomina"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de Nomina</FormLabel>
                  <Select
                    onValueChange={(values) => {
                      field.onChange(values === "0" ? undefined : Number.parseInt(values));
                    }}
                    value={field.value ? String(field.value) : "0"}
                  >
                    <FormControl>
                      <SelectTrigger className="w-[220px] truncate bg-white">
                        <SelectValue
                          placeholder={
                            cargandoNominas ? "Cargando Nominas" : "Seleccione un Tipo de Nomina"
                          }
                        />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="0">Ninguno</SelectItem>
                      {nominas.map((nom) => (
                        <SelectItem key={nom.id} value={String(nom.id)}>
                          {nom.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="cursor-pointer self-end">
              Buscar <Search className="size-4 ml-1" />
            </Button>
            <Button
              variant="outline"
              className="cursor-pointer self-end"
              type="button"
              onClick={cleanFields}
            >
              Limpiar <Eraser className="size-4 ml-1" />
            </Button>
            {puedeCrear && (
              <Button
                asChild
                variant="outline"
                className="cursor-pointer self-end ml-auto border-blue-600 text-blue-600 hover:bg-blue-50"
              >
                <Link href="/personal/registrar">
                  <Plus className="size-4 mr-1" /> Nuevo Trabajador
                </Link>
              </Button>
            )}
          </div>
        </form>
      </Form>

      {error && (
        <p role="alert" className="text-sm text-destructive mb-2">
          {error}
        </p>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onFotoSeleccionada}
      />

      {cargandoPersonal ? (
        <Loading promiseMessage="Cargando Información" />
      ) : (
        <DataTable columns={columnas} data={empleados} emptyMessage="Sin empleados." />
      )}

      <EmpleadoDetalleSheet
        open={detalleAbierto}
        onOpenChange={(open) => {
          setDetalleAbierto(open);
          if (!open) setViendoDetalle(null);
        }}
        empleado={viendoDetalle}
        catalogos={catalogos}
        detalle={
          viendoDetalle && catalogos ? construirDetalleExpediente(viendoDetalle, catalogos) : null
        }
        onExportarPdf={onExportarPdf}
        onGuardado={() => {
          cargar(form.getValues());
          if (viendoDetalle) onVerDetalle(viendoDetalle.cedula);
        }}
        exportandoPdf={exportandoPdf}
        puedeExportarPdf={puedeExportarPdf}
        puedeEditar={puedeEditar}
      />
    </PageLayout>
  );
}
