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
import { useSession } from "next-auth/react";
import { Eraser, Search } from "lucide-react";

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
import { FiltrosColapsables } from "@/shared/ui/components/filtros-movil-colapsable";
import Loading from "@/shared/ui/components/loading";
import { tienePermiso } from "@/shared/lib/evaluador-iam";

import type { CatalogosExpedienteDTO, EmpleadoDTO } from "../application/dtos/empleado-dto";
import {
  descargarEmpleadoPdfAction,
  getEmpleadosAction,
  getInicioPersonalAction,
  subirFotoEmpleadoAction,
} from "../infrastructure/actions/personal-actions";
import { obtenerCatalogosExpediente } from "../infrastructure/cache/catalogos-expediente-cache";
import EmpleadoDetalleSheet from "./empleado-detalle-sheet";
import { construirDetalleExpediente } from "./expediente-detalle-view-model";
import { useExpedienteVigente } from "./use-expediente-vigente";
import { construirColumnasPersonal } from "./personal-columns";
import { listadoEmpleadosSchema, type ListadoEmpleadosFormType } from "./schema/schema-empleado";

export default function PersonalPage() {
  const TAMANO_PAGINA = 10;
  const { data: session } = useSession();
  const permisos = session?.user?.permisos;
  const esAdmin = tienePermiso(permisos, "*");
  const _puedeCrear = esAdmin || tienePermiso(permisos, "personal.crear");
  const puedeEditar = esAdmin || tienePermiso(permisos, "personal.editar_personales");
  const puedeCorregirCedula = esAdmin || tienePermiso(permisos, "personal.corregir_cedula");
  const puedeEditarNacionalidad = esAdmin || tienePermiso(permisos, "personal.editar_nacionalidad");
  const puedeVerDetalle = esAdmin || tienePermiso(permisos, "personal.ver_detalle");
  const puedeExportarPdf = esAdmin || tienePermiso(permisos, "personal.exportar_pdf");

  const [empleados, setEmpleados] = useState<EmpleadoDTO[]>([]);
  const [pagina, setPagina] = useState(0);
  const [total, setTotal] = useState(0);
  const [catalogos, setCatalogos] = useState<CatalogosExpedienteDTO | null>(null);
  const [nominas, setNominas] = useState<{ id: number; nombre: string }[]>([]);
  const [cargandoNominas, setCargandoNominas] = useState(false);
  const [cargandoPersonal, setCargandoPersonal] = useState(true);
  const [cedulaDetalle, setCedulaDetalle] = useState<string | null>(null);
  const [exportandoPdf, setExportandoPdf] = useState(false);
  const [_isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cedulaFotoRef = useRef<string | null>(null);

  // Apertura directa del expediente desde un enlace (`/personal/consultar?cedula=...`),
  // por ejemplo al validar el carnet de un trabajador con el escáner QR.
  useEffect(() => {
    const cedula = new URLSearchParams(window.location.search).get("cedula")?.trim();
    if (cedula && /^\d{5,10}$/.test(cedula)) {
      setCedulaDetalle(cedula);
    }
  }, []);

  // El detalle se deriva de la cédula vigente: al cambiar de persona se vacía
  // al instante y se descartan las respuestas de cualquier otra cédula.
  const {
    empleado: viendoDetalle,
    revision: revisionDetalle,
    recargar: recargarDetalle,
  } = useExpedienteVigente({
    cedula: cedulaDetalle,
    activo: cedulaDetalle !== null,
    onError: (mensaje) => {
      setError(mensaje);
      setCedulaDetalle(null);
    },
  });

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

  /**
   * Los catálogos se piden una sola vez por sesión y nunca bloquean el
   * detalle. Aquí solo se lanzan en segundo plano para que los diálogos de
   * edición tengan sus opciones cuando el usuario los abra.
   */
  const asegurarCatalogos = async () => {
    if (catalogos) return;
    try {
      setCatalogos(await obtenerCatalogosExpediente());
    } catch {
      // El detalle se muestra igual sin catálogos: el backend ya manda nombres.
    }
  };

  const cargar = (filtros?: ListadoEmpleadosFormType, pageIndex = 0) => {
    const consulta = ++ultimaConsultaRef.current;
    setCargandoPersonal(true);
    startTransition(async () => {
      setError(null);
      try {
        const data = await getEmpleadosAction(filtros, {
          page: pageIndex + 1,
          pageSize: TAMANO_PAGINA,
        });
        if (consulta === ultimaConsultaRef.current) {
          setEmpleados(data.items);
          setTotal(data.total);
          setPagina(data.page - 1);
        }
      } catch {
        if (consulta === ultimaConsultaRef.current) setError("No fue posible cargar el personal.");
      } finally {
        if (consulta === ultimaConsultaRef.current) setCargandoPersonal(false);
      }
    });
  };

  useEffect(() => {
    // Una sola Server Action resuelve listado + nóminas en paralelo en el
    // servidor (antes eran dos acciones en cola desde el cliente) y sin
    // precargar catálogos pesados.
    const consulta = ++ultimaConsultaRef.current;
    setCargandoPersonal(true);
    setCargandoNominas(true);
    startTransition(async () => {
      setError(null);
      try {
        const { empleados: data, nominas: tipos } = await getInicioPersonalAction(
          undefined,
          { page: 1, pageSize: TAMANO_PAGINA },
        );
        if (consulta === ultimaConsultaRef.current) {
          setEmpleados(data.items);
          setTotal(data.total);
          setPagina(data.page - 1);
          setNominas(tipos);
        }
      } catch {
        if (consulta === ultimaConsultaRef.current) setError("No fue posible cargar el personal.");
      } finally {
        if (consulta === ultimaConsultaRef.current) {
          setCargandoPersonal(false);
          setCargandoNominas(false);
        }
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
    setError(null);
    setCedulaDetalle(cedula);
    // Los catálogos van en paralelo y no bloquean la apertura: el expediente
    // se pinta con los nombres que ya trae el backend.
    void asegurarCatalogos();
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
        const resultado = await subirFotoEmpleadoAction(cedula, formData);
        if (resultado && typeof resultado === "object" && "error" in resultado) {
          setError((resultado as { error: string }).error);
          return;
        }
        cargar(form.getValues(), pagina);
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
      {(() => {
        const formValores = form.watch();
        const conteoFiltros = [
          formValores.cedulaidentidad?.trim(),
          formValores.codigo?.trim(),
          formValores.tipo_nomina && formValores.tipo_nomina !== 0 ? formValores.tipo_nomina : undefined,
        ].filter(Boolean).length;

        return (
          <FiltrosColapsables conteoActivos={conteoFiltros} titulo="Filtros de búsqueda" className="mb-4">
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSearch)}
                className="flex flex-col gap-3"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <FormField
                    name="cedulaidentidad"
                    control={form.control}
                    render={({ field }) => (
                      <FormItem className="min-w-0">
                        <FormLabel>Buscar Cédula</FormLabel>
                        <FormControl>
                          <Input
                            type="text"
                            placeholder="Buscar cédula..."
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
                      <FormItem className="min-w-0">
                        <FormLabel>Buscar Código De Trabajador</FormLabel>
                        <FormControl>
                          <Input
                            type="text"
                            placeholder="Buscar código..."
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
                      <FormItem className="min-w-0">
                        <FormLabel>Tipo de Nómina</FormLabel>
                        <Select
                          onValueChange={(values) => {
                            field.onChange(values === "0" ? undefined : Number.parseInt(values));
                          }}
                          value={field.value ? String(field.value) : "0"}
                        >
                          <FormControl>
                            <SelectTrigger className="w-full truncate">
                              <SelectValue
                                placeholder={
                                  cargandoNominas ? "Cargando Nóminas" : "Seleccione un Tipo de Nómina"
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
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                  <Button
                    variant="outline"
                    className="w-full sm:w-auto cursor-pointer"
                    type="button"
                    onClick={cleanFields}
                  >
                    Limpiar <Eraser className="size-4 ml-1" />
                  </Button>
                  <Button type="submit" className="w-full sm:w-auto cursor-pointer">
                    Buscar <Search className="size-4 ml-1" />
                  </Button>
                </div>
              </form>
            </Form>
          </FiltrosColapsables>
        );
      })()}

      {error && (
        <p role="alert" className="text-sm text-destructive mb-2">
          {error}
        </p>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png"
        className="hidden"
        onChange={onFotoSeleccionada}
      />

      {cargandoPersonal ? (
        <Loading promiseMessage="Cargando Información" />
      ) : (
        <DataTable
          columns={columnas}
          data={empleados}
          emptyMessage="Sin empleados."
          pagination={{
            pageIndex: pagina,
            pageSize: TAMANO_PAGINA,
            total,
            onPageChange: (indice) => cargar(form.getValues(), indice),
          }}
        />
      )}

      <EmpleadoDetalleSheet
        open={cedulaDetalle !== null}
        onOpenChange={(open) => {
          if (!open) setCedulaDetalle(null);
        }}
        empleado={viendoDetalle}
        catalogos={catalogos}
        detalle={viendoDetalle ? construirDetalleExpediente(viendoDetalle, catalogos) : null}
        onExportarPdf={onExportarPdf}
        onGuardado={() => {
          cargar(form.getValues(), pagina);
          recargarDetalle();
        }}
        exportandoPdf={exportandoPdf}
        puedeExportarPdf={puedeExportarPdf}
        puedeEditar={puedeEditar}
        puedeCorregirCedula={puedeCorregirCedula}
        puedeEditarNacionalidad={puedeEditarNacionalidad}
        onCedulaCorregida={(nueva) => {
          setCedulaDetalle(nueva);
          cargar(form.getValues(), pagina);
        }}
        revision={revisionDetalle}
      />
    </PageLayout>
  );
}
