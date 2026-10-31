"use client";

/**
 * Página de consulta del historial de movimientos de trabajadores.
 * Paridad visual y funcional con el sistema de referencia, ampliada con
 * filtros avanzados requeridos por el usuario:
 * - Cédula del empleado
 * - Código de puesto
 * - Tipo de Movimiento (Select)
 * - Gerencia / Dirección General (Select)
 * - Rango de fechas: Fecha Inicio y Fecha Fin (Date inputs)
 * - Estatus del cargo (Select)
 * - Búsqueda rápida en resultados (filtro reactivo instantáneo)
 * - Exportación a PDF con `ReportMovementsPDF`
 * - Hoja de detalle `DetalleMovimiento`
 */
import { useEffect, useMemo, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eraser, Filter, Search, SlidersHorizontal } from "lucide-react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";

import PageLayout from "@/components/layout/page-layout";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/components/select";
import { Badge } from "@/shared/ui/components/badge";
import { DataTable } from "@/shared/ui/components/data-table";
import Loading from "@/shared/ui/components/loading";

import type { MovimientoCargoDTO, PaginaMovimientosDTO } from "../application/dtos/movimientos-dto";
import {
  puedeExportarMovimientosExcel,
  puedeExportarMovimientosPdf,
  puedeVerMovimientos,
} from "../application/use-cases/permisos-movimiento";
import type {
  CatalogoTiposMovimientoInfo,
  FiltrosMovimiento,
} from "../domain/ports/repo-movimientos";
import {
  getHistorialGeneralAction,
  getTiposMovimientoDisponiblesAction,
} from "../infrastructure/actions/movimientos-actions";
import { getDireccionesGeneralesAction } from "@/modules/organizacion/infrastructure/actions/organizacion-actions";
import { avisoTopeDeFilas } from "@/shared/lib/aviso-tope";
import { descargarHistorialMovimientos } from "./services/descargas-movimientos";
import { DetalleMovimiento } from "./detalle-movimiento";
import { construirColumnasMovimientos } from "./movimientos-columns";
import { consultaHistorialSchema, type ConsultaHistorialFormType } from "./schema/schema-historial";

const TAMANO_PAGINA = 10;

const CATEGORIAS_INICIALES = [
  "INGRESO",
  "TRASLADO",
  "EGRESO",
  "ENCARGADURIA",
  "ESTATUS",
  "ESTATUS PASIVO",
];

const MOTIVOS_POR_CATEGORIA_INICIALES: Record<string, string[]> = {
  INGRESO: ["INGRESO"],
  TRASLADO: [
    "ASCENSO PERSONAL EMPLEADO",
    "ASIGNACION DE CARGO",
    "CLASIFICACION DE CARGO OBRERO",
    "ENCARGADURIA EN CALIDAD DE COMISION DE SERVICIO",
    "ENCARGADURIA INTERNA",
    "NOMBRAMIENTO DE LIBRE Y REMOCION",
    "TRASLADO DE NOMINA",
    "TRASLADO FISICO Y ADMINISTRATIVO A OTRA DEPENDENCIA",
  ],
  EGRESO: [
    "ABANDONO DE CARGO",
    "ANULACION DE MOVIMIENTO",
    "DESPIDO DE OBRERO",
    "DESTITUCION",
    "EGRESO POR TRANSFERENCIA",
    "FALLECIMIENTO",
    "JUBILACION DE DERECHO",
    "PENSION DE INVALIDEZ",
    "PENSION POR SOBREVIVIENTE",
    "RENUNCIA",
    "RETIRO POR REDUCCION DE PERSONAL",
  ],
  ENCARGADURIA: ["REPOSO MEDICO"],
  ESTATUS: [
    "SUSPENDIDO POR ABANDONO DE CARGO",
    "SUSPENDIDO POR COMISION DE SERVICIO",
    "SUSPENDIDO POR ENCARGADURIA",
    "SUSPENDIDO POR TRAMITES ADMINISTRATIVOS",
  ],
  "ESTATUS PASIVO": ["CAMBIO DE ESTATUS POR TRAMITES ADMINISTRATIVOS"],
};

const GERENCIAS_OPCIONES = [
  "OFICINA DE SISTEMAS Y TECNOLOGIA DE LA INFORMACION",
  "OFICINA DE GESTION HUMANA",
  "OFICINA DE ATENCION AL CIUDADANO",
  "OFICINA DE GESTION ADMINISTRATIVA",
  "OFICINA DE GESTION COMUNICACIONAL",
  "OFICINA DE INFORMACION ESTADISTICA Y GEOGRAFICA",
  "OFICINA DE PLANIFICACION PRESUPUESTO Y SEGUIMIENTO DE LA GESTION",
  "OFICINA DE PROTECCION Y SEGURIDAD INTEGRAL",
  "GERENCIA DE ADMINISTRACION DE DOMINIOS NIC. VE",
  "GERENCIA DE FORMACION",
  "GERENCIA DE GESTION DE SERVICIOS DE TELECOMUNICACIONES",
  "GERENCIA DE PLANIFICACION Y DESARROLLO DEL SECTOR TELECOMUNICACIONES",
  "GERENCIA DE RECAUDACION Y FISCALIZACION",
  "GERENCIA DE REGIONES",
  "GERENCIA DE RESPONSABILIDAD SOCIAL Y PARTICIPACION",
  "GERENCIA DE SEGUIMIENTO REGULATORIO",
  "CONSULTORIA JURIDICA",
  "DIRECCION GENERAL",
  "UNIDAD DE AUDITORIA INTERNA",
  "CONSEJO DIRECTIVO",
] as const;

const ESTATUS_CARGO = ["ACTIVO", "PASIVO", "VACANTE", "SUSPENDIDO", "EGRESADO"] as const;

type TipoConsulta = { tipo: "empleado" | "cargo" | "general"; valor: string } | null;

export default function MovimientosPage() {
  const { data: session } = useSession();
  const permisos = session?.user?.permisos;
  const puedeVer = puedeVerMovimientos(permisos);
  const puedeExportarPdf = puedeExportarMovimientosPdf(permisos);
  const puedeExportarExcel = puedeExportarMovimientosExcel(permisos);

  const [movimientos, setMovimientos] = useState<MovimientoCargoDTO[]>([]);
  const [busquedaLibre, setBusquedaLibre] = useState("");
  const [consulta, setConsulta] = useState<TipoConsulta>(null);
  const [ultimosFiltros, setUltimosFiltros] = useState<FiltrosMovimiento>({});
  const [buscado, setBuscado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [exportandoPdf, setExportandoPdf] = useState(false);
  const [exportandoExcel, setExportandoExcel] = useState(false);
  const [avisoTope, setAvisoTope] = useState<string | null>(null);
  const [paginaActual, setPaginaActual] = useState(1);
  const [totalPaginas, setTotalPaginas] = useState(1);
  const [totalMovimientos, setTotalMovimientos] = useState(0);

  const [viendoDetalle, setViendoDetalle] = useState<MovimientoCargoDTO | null>(null);
  const [detalleAbierto, setDetalleAbierto] = useState(false);

  const [catalogoTipos, setCatalogoTipos] = useState<CatalogoTiposMovimientoInfo>({
    categorias: CATEGORIAS_INICIALES,
    motivos_por_categoria: MOTIVOS_POR_CATEGORIA_INICIALES,
  });
  const [gerencias, setGerencias] = useState<string[]>(GERENCIAS_OPCIONES as unknown as string[]);

  useEffect(() => {
    let montado = true;
    getTiposMovimientoDisponiblesAction()
      .then((data) => {
        if (
          montado &&
          data &&
          typeof data === "object" &&
          "categorias" in data &&
          Array.isArray(data.categorias) &&
          data.categorias.length > 0
        ) {
          setCatalogoTipos({
            categorias: data.categorias,
            motivos_por_categoria: data.motivos_por_categoria ?? MOTIVOS_POR_CATEGORIA_INICIALES,
          });
        }
      })
      .catch(() => {});

    getDireccionesGeneralesAction()
      .then((dirs) => {
        if (montado && Array.isArray(dirs) && dirs.length > 0) {
          const nombres = dirs
            .map((d) => d.nombre)
            .filter((n): n is string => typeof n === "string" && n.trim().length > 0);
          if (nombres.length > 0) {
            setGerencias(nombres);
          }
        }
      })
      .catch(() => {});

    return () => {
      montado = false;
    };
  }, []);

  const form = useForm<ConsultaHistorialFormType>({
    resolver: zodResolver(consultaHistorialSchema),
    defaultValues: {
      cedulaidentidad: "",
      codigoPuesto: "",
      categoria: "ALL",
      tipoMovimiento: "ALL",
      fechaInicio: "",
      fechaFin: "",
      gerencia: "ALL",
      estatus: "ALL",
    },
  });

  const categoriaSeleccionada = form.watch("categoria");
  const motivosDisponibles = useMemo(() => {
    if (!categoriaSeleccionada || categoriaSeleccionada === "ALL") {
      return [];
    }
    return catalogoTipos.motivos_por_categoria[categoriaSeleccionada] ?? [];
  }, [categoriaSeleccionada, catalogoTipos]);

  const onSearch = (values: ConsultaHistorialFormType, paginaDestino = 1) => {
    const cedula = values.cedulaidentidad?.trim();
    const codigo = values.codigoPuesto?.trim();
    const categoria = values.categoria?.trim();
    const tipo = values.tipoMovimiento?.trim();
    const fechaInicio = values.fechaInicio?.trim();
    const fechaFin = values.fechaFin?.trim();
    const gerencia = values.gerencia?.trim();
    const estatus = values.estatus?.trim();

    if (fechaInicio && fechaFin && fechaInicio > fechaFin) {
      setError("La fecha de inicio no puede ser posterior a la fecha de fin.");
      return;
    }

    if (!puedeVer) return;

    setError(null);
    setBuscado(true);

    startTransition(async () => {
      try {
        const filtros: FiltrosMovimiento = {};
        if (cedula) filtros.cedula = cedula;
        if (codigo) filtros.codigoPuesto = codigo.toUpperCase();
        if (categoria && categoria !== "ALL") filtros.categoria = categoria;
        if (tipo && tipo !== "ALL") filtros.tipoMovimiento = tipo;
        if (fechaInicio) filtros.fechaInicio = fechaInicio;
        if (fechaFin) filtros.fechaFin = fechaFin;
        if (gerencia && gerencia !== "ALL") filtros.gerencia = gerencia;
        if (estatus && estatus !== "ALL") filtros.estatus = estatus;

        const partesResumen = [
          cedula ? `Cédula: ${cedula}` : "",
          codigo ? `Puesto: ${codigo}` : "",
          categoria && categoria !== "ALL" ? `Categoría: ${categoria}` : "",
          tipo && tipo !== "ALL" ? `Motivo: ${tipo}` : "",
          gerencia && gerencia !== "ALL" ? `Gerencia: ${gerencia}` : "",
          fechaInicio ? `Desde: ${fechaInicio}` : "",
          fechaFin ? `Hasta: ${fechaFin}` : "",
          estatus && estatus !== "ALL" ? `Estatus: ${estatus}` : "",
        ].filter(Boolean);
        setConsulta({
          tipo: "general",
          valor: partesResumen.length > 0 ? partesResumen.join(", ") : "Historial General",
        });
        setUltimosFiltros(filtros);

        const resultado = await getHistorialGeneralAction(
          filtros,
          paginaDestino,
          TAMANO_PAGINA,
        );

        if (resultado && typeof resultado === "object" && "error" in resultado) {
          setError((resultado as { error: string }).error);
          setMovimientos([]);
          return;
        }

        const pagina = resultado as PaginaMovimientosDTO;
        setMovimientos(pagina.resultados ?? []);
        setPaginaActual(pagina.pagina ?? paginaDestino);
        setTotalPaginas(pagina.totalPaginas ?? 1);
        setTotalMovimientos(pagina.total ?? 0);
      } catch {
        setError("No fue posible cargar el historial de movimientos.");
        setMovimientos([]);
      }
    });
  };

  const irAPagina = (destino: number) => {
    if (destino < 1 || destino > totalPaginas || destino === paginaActual) return;
    onSearch(form.getValues(), destino);
  };

  const cleanFields = () => {
    form.reset({
      cedulaidentidad: "",
      codigoPuesto: "",
      categoria: "ALL",
      tipoMovimiento: "ALL",
      fechaInicio: "",
      fechaFin: "",
      gerencia: "ALL",
      estatus: "ALL",
    });
    setBusquedaLibre("");
    setConsulta(null);
    setMovimientos([]);
    setBuscado(false);
    setError(null);
    setAvisoTope(null);
    setPaginaActual(1);
    setTotalPaginas(1);
    setTotalMovimientos(0);
  };

  const onVerDetalle = (movimiento: MovimientoCargoDTO) => {
    setViendoDetalle(movimiento);
    setDetalleAbierto(true);
  };

  const columnas = useMemo(() => construirColumnasMovimientos(onVerDetalle, puedeVer), [puedeVer]);

  const movimientosFiltrados = useMemo(() => {
    if (!busquedaLibre.trim()) return movimientos;
    const q = busquedaLibre.trim().toLowerCase();
    return movimientos.filter((m) => {
      return (
        m.empleadoCedula?.toLowerCase().includes(q) ||
        m.codigoPuesto?.toLowerCase().includes(q) ||
        m.tipoMovimiento?.toLowerCase().includes(q) ||
        m.motivoNombre?.toLowerCase().includes(q) ||
        m.especificaNombre?.toLowerCase().includes(q) ||
        m.denominacionNombre?.toLowerCase().includes(q) ||
        m.direccionGeneralNombre?.toLowerCase().includes(q) ||
        m.ejecutadoPorNombre?.toLowerCase().includes(q) ||
        m.estatusNombre?.toLowerCase().includes(q)
      );
    });
  }, [movimientos, busquedaLibre]);

  const descargar = async (formato: "pdf" | "excel") => {
    const autorizado =
      formato === "pdf" ? puedeExportarPdf : puedeExportarExcel;
    if (!autorizado) return;
    const marcarExportando = formato === "pdf" ? setExportandoPdf : setExportandoExcel;
    marcarExportando(true);
    setAvisoTope(null);
    try {
      const { blob, total, limite, truncado } = await descargarHistorialMovimientos(
        formato,
        ultimosFiltros,
      );

      const aviso = avisoTopeDeFilas({ total, limite, truncado });
      setAvisoTope(aviso);
      if (aviso) toast.warning(aviso);

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      const extension = formato === "excel" ? "xlsx" : "pdf";
      a.href = url;
      a.download = `historial-movimientos-${consulta?.valor ? "filtrado" : "reporte"}.${extension}`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      setError(
        error instanceof Error && error.message
          ? error.message
          : `No fue posible descargar el ${formato.toUpperCase()}.`,
      );
    } finally {
      marcarExportando(false);
    }
  };

  return (
    <PageLayout
      title="Consulta De Movimientos De Trabajadores"
      description="Verifique El Movimiento Del Personal"
    >
      <div className="flex flex-col gap-4 mt-2">
        {!puedeVer && (
          <div
            role="alert"
            className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive font-medium"
          >
            No tiene permisos suficientes para consultar el historial de movimientos de personal (se
            requiere movimientos.ver).
          </div>
        )}

        <div className="rounded-xl border bg-card text-card-foreground p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4 pb-2 border-b">
            <SlidersHorizontal className="size-4 text-primary" />
            <h2 className="text-sm font-semibold tracking-tight">Filtros de Búsqueda</h2>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit((values) => onSearch(values, 1))} className="flex flex-col gap-4" noValidate>
              {/* Fila 1: Cédula, Código Puesto, Categoría de Movimiento, Motivo Específico */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
                          placeholder="buscar cédula..."
                          disabled={!puedeVer || isPending}
                          {...field}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  name="codigoPuesto"
                  control={form.control}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Buscar Código Puesto</FormLabel>
                      <FormControl>
                        <Input
                          className="bg-white"
                          type="text"
                          placeholder="buscar código puesto..."
                          disabled={!puedeVer || isPending}
                          {...field}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  name="categoria"
                  control={form.control}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Categoría de Movimiento</FormLabel>
                      <Select
                        value={field.value || "ALL"}
                        onValueChange={(val) => {
                          field.onChange(val === "ALL" ? "" : val);
                          form.setValue("tipoMovimiento", "ALL");
                        }}
                        disabled={!puedeVer || isPending}
                      >
                        <FormControl>
                          <SelectTrigger className="bg-white w-full">
                            <SelectValue placeholder="Todas las categorías" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="max-h-72">
                          <SelectItem value="ALL">Todas las categorías</SelectItem>
                          {catalogoTipos.categorias.map((cat) => (
                            <SelectItem key={cat} value={cat}>
                              {cat}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />

                <FormField
                  name="tipoMovimiento"
                  control={form.control}
                  render={({ field }) => {
                    const tieneCategoria = Boolean(
                      categoriaSeleccionada && categoriaSeleccionada !== "ALL",
                    );
                    return (
                      <FormItem>
                        <FormLabel>Tipo / Motivo Específico</FormLabel>
                        <Select
                          value={field.value || "ALL"}
                          onValueChange={(val) => field.onChange(val === "ALL" ? "" : val)}
                          disabled={!puedeVer || isPending || !tieneCategoria}
                        >
                          <FormControl>
                            <SelectTrigger className="bg-white w-full">
                              <SelectValue
                                placeholder={
                                  tieneCategoria
                                    ? "Todos los motivos"
                                    : "Seleccione una categoría primero"
                                }
                              />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="max-h-72">
                            <SelectItem value="ALL">
                              {tieneCategoria
                                ? `Todos los motivos (${categoriaSeleccionada})`
                                : "Todos los motivos"}
                            </SelectItem>
                            {motivosDisponibles.map((motivo) => (
                              <SelectItem key={motivo} value={motivo}>
                                {motivo}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormItem>
                    );
                  }}
                />
              </div>

              {/* Fila 2: Gerencia, Estatus, Fecha Inicio, Fecha Fin */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                <FormField
                  name="gerencia"
                  control={form.control}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Gerencia / Dirección</FormLabel>
                      <Select
                        value={field.value || "ALL"}
                        onValueChange={(val) => field.onChange(val === "ALL" ? "" : val)}
                        disabled={!puedeVer || isPending}
                      >
                        <FormControl>
                          <SelectTrigger className="bg-white w-full">
                            <SelectValue placeholder="Todas las gerencias" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="max-h-72">
                          <SelectItem value="ALL">Todas las gerencias</SelectItem>
                          {gerencias.map((g) => (
                            <SelectItem key={g} value={g}>
                              {g}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />

                <FormField
                  name="estatus"
                  control={form.control}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Estatus del Cargo</FormLabel>
                      <Select
                        value={field.value || "ALL"}
                        onValueChange={(val) => field.onChange(val === "ALL" ? "" : val)}
                        disabled={!puedeVer || isPending}
                      >
                        <FormControl>
                          <SelectTrigger className="bg-white w-full">
                            <SelectValue placeholder="Todos los estatus" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="ALL">Todos los estatus</SelectItem>
                          {ESTATUS_CARGO.map((est) => (
                            <SelectItem key={est} value={est}>
                              {est}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />

                <FormField
                  name="fechaInicio"
                  control={form.control}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fecha Inicio</FormLabel>
                      <FormControl>
                        <Input
                          className="bg-white"
                          type="date"
                          disabled={!puedeVer || isPending}
                          {...field}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  name="fechaFin"
                  control={form.control}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fecha Fin</FormLabel>
                      <FormControl>
                        <Input
                          className="bg-white"
                          type="date"
                          disabled={!puedeVer || isPending}
                          {...field}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              {/* Botones de acción */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t">
                <Button
                  variant="outline"
                  className="cursor-pointer"
                  type="button"
                  onClick={cleanFields}
                  disabled={isPending}
                >
                  Limpiar <Eraser className="size-4 ml-1.5" />
                </Button>
                <Button type="submit" className="cursor-pointer" disabled={isPending || !puedeVer}>
                  Buscar <Search className="size-4 ml-1.5" />
                </Button>
              </div>
            </form>
          </Form>
        </div>

        {error && (
          <p role="alert" className="text-sm text-destructive font-medium px-1">
            {error}
          </p>
        )}

        {avisoTope && (
          <p
            role="status"
            className="rounded-md border border-amber-500/50 bg-amber-50 p-3 text-sm font-medium text-amber-900"
          >
            {avisoTope}
          </p>
        )}

        {/* Toolbar de resultados: búsqueda rápida, total, exportaciones y paginación */}
        {(movimientos.length > 0 || totalMovimientos > 0) && (
          <div className="flex flex-col gap-3 bg-muted/40 p-3 rounded-lg border">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="relative max-w-sm flex-1">
                <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Filtrar resultados de esta página (cédula, puesto, cargo, usuario...)"
                  value={busquedaLibre}
                  onChange={(e) => setBusquedaLibre(e.target.value)}
                  className="pl-8 bg-white h-9 text-xs"
                />
              </div>

              <div className="flex items-center gap-3 justify-between sm:justify-end flex-wrap">
                <Badge variant="outline" className="text-xs font-normal">
                  {totalMovimientos} movimiento(s) · página {paginaActual} de {totalPaginas}
                </Badge>

                {(puedeExportarPdf || puedeExportarExcel) && (
                  <div className="flex items-center gap-2">
                    {puedeExportarPdf && (
                      <Button
                        type="button"
                        variant="outline"
                        disabled={exportandoPdf}
                        onClick={() => descargar("pdf")}
                      >
                        {exportandoPdf ? "Generando PDF…" : "Descargar PDF"}
                      </Button>
                    )}
                    {puedeExportarExcel && (
                      <Button
                        type="button"
                        disabled={exportandoExcel}
                        onClick={() => descargar("excel")}
                        className="bg-emerald-600 hover:bg-emerald-800"
                      >
                        {exportandoExcel ? "Generando Excel…" : "Descargar Excel"}
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isPending || paginaActual <= 1}
                onClick={() => irAPagina(paginaActual - 1)}
              >
                Anterior
              </Button>
              <span className="text-xs text-muted-foreground">
                Página {paginaActual} de {totalPaginas}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isPending || paginaActual >= totalPaginas}
                onClick={() => irAPagina(paginaActual + 1)}
              >
                Siguiente
              </Button>
            </div>
          </div>
        )}

        {isPending ? (
          <Loading promiseMessage="Cargando Información" />
        ) : (
          <DataTable
            columns={columnas}
            data={movimientosFiltrados}
            emptyMessage={
              buscado
                ? "No hay movimientos registrados para los criterios indicados."
                : "Configure los filtros y presione Buscar para consultar el historial de movimientos."
            }
          />
        )}

        <DetalleMovimiento
          movimiento={viendoDetalle}
          open={detalleAbierto}
          onOpenChange={setDetalleAbierto}
        />
      </div>
    </PageLayout>
  );
}
