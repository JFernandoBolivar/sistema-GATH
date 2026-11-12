"use client";

/**
 * Bitácora de auditoría profesional (D10, FIX-DIS4).
 *
 * Incluye:
 *  - Encabezado con métricas y resumen real del período.
 *  - Filtros estructurados con el componente BarraFiltros de FIX-DIS1.
 *  - Selector de acción con Combobox accesible agrupado por módulo y etiquetas en español.
 *  - Pestañas grandes (h-11) con contadores reales y separación superior >= 24px.
 *  - Visualización semántica por colores de severidad/tipo de acción.
 *  - Detalle saneado en modal sin JSON crudo.
 *  - Exportaciones asíncronas en PDF y Excel (sin CSV).
 */
import { useEffect, useMemo, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import useSWR from "swr";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import {
  Activity,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  Filter,
  Layers,
  RotateCcw,
  Shield,
  ShieldAlert,
  User,
  XCircle,
} from "lucide-react";

import PageLayout from "@/components/layout/page-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { tienePermiso } from "@/shared/lib/evaluador-iam";
import { avisoTopeDeFilas } from "@/shared/lib/aviso-tope";
import { aplicarErroresServidor } from "@/shared/ui/forms/aplicar-errores-servidor";
import { BarraFiltros, type FiltroActivoChip } from "@/shared/ui/components/barra-filtros";

import type {
  FiltrosAuditoria,
  PaginaAuditoriaDTO,
  PaginaIncidentesDTO,
} from "../application/dtos/auditoria-dto";
import {
  consultarAuditoriaAction,
  consultarIncidentesAction,
  getOpcionesAuditoriaAction,
} from "../infrastructure/actions/auditoria-actions";
import {
  ETIQUETA_RESULTADO,
  PERMISO_AUDITORIA,
} from "../domain/value-objects/permisos-auditoria";
import {
  NOMBRES_MODULOS,
  obtenerEtiquetaAccion,
  obtenerSeveridadAccion,
  type SeveridadAccion,
} from "../domain/value-objects/catalogo-acciones";
import {
  FILTROS_VACIOS,
  filtrosAuditoriaSchema,
  type FiltrosAuditoriaForm,
} from "./schema/schema-auditoria";
import { descargarBitacora } from "./services/descargas-auditoria";
import { esCancelacion } from "@/shared/lib/exportaciones-asincronas";
import { useProgresoExportacion } from "@/shared/lib/use-progreso-exportacion";
import { ComboboxAcciones } from "./components/combobox-acciones";
import { DetalleAuditoriaModal } from "./components/detalle-auditoria-modal";

const TAMANO_PAGINA = 10;

function formatearFecha(iso: string): string {
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return iso;
  return new Intl.DateTimeFormat("es-VE", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(fecha);
}

function esError(valor: unknown): valor is { error: string; errores?: Record<string, string[]> } {
  return !!valor && typeof valor === "object" && "error" in valor;
}

export function AuditoriaPage() {
  const { data: session } = useSession();
  const permisos = session?.user?.permisos;
  const puedeVer = tienePermiso(permisos, PERMISO_AUDITORIA.verLogs);
  const puedeExportar = tienePermiso(permisos, PERMISO_AUDITORIA.exportar);
  const puedeVerSeguridad = tienePermiso(permisos, PERMISO_AUDITORIA.verSeguridad);

  const form = useForm<FiltrosAuditoriaForm>({
    resolver: zodResolver(filtrosAuditoriaSchema),
    defaultValues: FILTROS_VACIOS,
  });

  const [filtros, setFiltros] = useState<FiltrosAuditoria>({});
  const [tabActiva, setTabActiva] = useState<"bitacora" | "incidentes">("bitacora");
  const [pagina, setPagina] = useState(1);
  const [paginaIncidentes, setPaginaIncidentes] = useState(1);
  const [detalleId, setDetalleId] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [exportando, setExportando] = useState<string | null>(null);
  const exportacion = useProgresoExportacion();
  const [, startTransition] = useTransition();

  const { data: opciones } = useSWR("auditoria-opciones", getOpcionesAuditoriaAction);
  const opcionesUtiles = opciones && !esError(opciones) ? opciones : null;

  const { data, isLoading, mutate } = useSWR(
    puedeVer ? ["auditoria", filtros, pagina] : null,
    () => consultarAuditoriaAction(filtros, pagina, TAMANO_PAGINA),
  );

  const { data: incidentes, isLoading: cargandoIncidentes } = useSWR(
    puedeVerSeguridad ? ["auditoria-incidentes", filtros, paginaIncidentes] : null,
    () => consultarIncidentesAction(filtros, paginaIncidentes, TAMANO_PAGINA),
  );

  const paginaDatos = data && !esError(data) ? (data as PaginaAuditoriaDTO) : null;
  const paginaIncidentesDatos =
    incidentes && !esError(incidentes) ? (incidentes as PaginaIncidentesDTO) : null;
  const error = esError(data) ? data.error : null;

  useEffect(() => {
    if (!esError(data) || !data.errores) return;
    const sinUbicar = aplicarErroresServidor(form, data.errores);
    if (sinUbicar.length > 0) setAviso(sinUbicar.join(" "));
  }, [data, form]);

  function aplicar(valores: FiltrosAuditoriaForm) {
    setAviso(null);
    setPagina(1);
    setPaginaIncidentes(1);
    setFiltros({
      usuario: valores.usuario || undefined,
      accion: valores.accion || undefined,
      modulo: valores.modulo || undefined,
      recurso: valores.recurso || undefined,
      ip: valores.ip || undefined,
      desde: valores.desde || undefined,
      hasta: valores.hasta || undefined,
      resultado: valores.resultado || undefined,
    });
  }

  function limpiar() {
    form.reset(FILTROS_VACIOS);
    setAviso(null);
    setFiltros({});
    setPagina(1);
    setPaginaIncidentes(1);
  }

  function exportar(formato: "pdf" | "excel") {
    setExportando(formato);
    setAviso(null);
    startTransition(async () => {
      try {
        const archivo = await descargarBitacora(formato, filtros, exportacion.iniciar());
        const mensaje = avisoTopeDeFilas(archivo);
        setAviso(mensaje);
        if (mensaje) toast.warning(mensaje);
        const url = window.URL.createObjectURL(archivo.blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `bitacora-auditoria.${formato === "excel" ? "xlsx" : "pdf"}`;
        a.click();
        window.URL.revokeObjectURL(url);
      } catch (error) {
        if (esCancelacion(error)) return;
        toast.error(error instanceof Error ? error.message : "No fue posible exportar la bitácora.");
      } finally {
        setExportando(null);
      }
    });
  }

  // Chips para filtros activos en BarraFiltros
  const chipsActivos = useMemo<FiltroActivoChip[]>(() => {
    const items: FiltroActivoChip[] = [];
    if (filtros.usuario) {
      items.push({
        id: "chip-usuario",
        label: "Usuario",
        valorLegible: filtros.usuario,
        onRemover: () => {
          form.setValue("usuario", "");
          aplicar({ ...form.getValues(), usuario: "" });
        },
      });
    }
    if (filtros.accion) {
      items.push({
        id: "chip-accion",
        label: "Acción",
        valorLegible: obtenerEtiquetaAccion(filtros.accion),
        onRemover: () => {
          form.setValue("accion", "");
          aplicar({ ...form.getValues(), accion: "" });
        },
      });
    }
    if (filtros.modulo) {
      items.push({
        id: "chip-modulo",
        label: "Módulo",
        valorLegible: NOMBRES_MODULOS[filtros.modulo] || filtros.modulo,
        onRemover: () => {
          form.setValue("modulo", "");
          aplicar({ ...form.getValues(), modulo: "" });
        },
      });
    }
    if (filtros.resultado) {
      items.push({
        id: "chip-resultado",
        label: "Resultado",
        valorLegible: ETIQUETA_RESULTADO[filtros.resultado] ?? filtros.resultado,
        onRemover: () => {
          form.setValue("resultado", "");
          aplicar({ ...form.getValues(), resultado: "" });
        },
      });
    }
    if (filtros.desde) {
      items.push({
        id: "chip-desde",
        label: "Desde",
        valorLegible: filtros.desde,
        onRemover: () => {
          form.setValue("desde", "");
          aplicar({ ...form.getValues(), desde: "" });
        },
      });
    }
    if (filtros.hasta) {
      items.push({
        id: "chip-hasta",
        label: "Hasta",
        valorLegible: filtros.hasta,
        onRemover: () => {
          form.setValue("hasta", "");
          aplicar({ ...form.getValues(), hasta: "" });
        },
      });
    }
    if (filtros.recurso) {
      items.push({
        id: "chip-recurso",
        label: "Recurso",
        valorLegible: filtros.recurso,
        onRemover: () => {
          form.setValue("recurso", "");
          aplicar({ ...form.getValues(), recurso: "" });
        },
      });
    }
    if (filtros.ip) {
      items.push({
        id: "chip-ip",
        label: "IP",
        valorLegible: filtros.ip,
        onRemover: () => {
          form.setValue("ip", "");
          aplicar({ ...form.getValues(), ip: "" });
        },
      });
    }
    return items;
  }, [filtros, form]);

  const hayFiltros = chipsActivos.length > 0;

  if (!puedeVer) {
    return (
      <PageLayout title="Bitácora de auditoría">
        <p
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive"
        >
          No tiene el permiso «{PERMISO_AUDITORIA.verLogs}» para consultar la bitácora de auditoría.
        </p>
      </PageLayout>
    );
  }

  const badgeSeveridad = (severidad: SeveridadAccion) => {
    switch (severidad) {
      case "creacion":
        return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300";
      case "actualizacion":
        return "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300";
      case "aprobacion":
        return "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/40 dark:text-teal-300";
      case "advertencia":
        return "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300";
      case "peligro":
        return "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300";
      case "consulta":
      default:
        return "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-900/50 dark:text-slate-300";
    }
  };

  return (
    <PageLayout
      title="Bitácora de Auditoría"
      description="Supervisión y trazabilidad de eventos del sistema, acciones administrativas e incidentes de seguridad."
    >
      <div className="space-y-6">
        {/* Encabezado con Métricas y Resumen Real */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Card className="border-border/60 shadow-sm bg-card">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="space-y-0.5">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Registros en Bitácora
                </span>
                <p className="text-2xl font-bold tracking-tight text-foreground">
                  {isLoading ? "…" : (paginaDatos?.total ?? 0)}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Eventos registrados bajo los filtros actuales
                </p>
              </div>
              <div className="p-2.5 rounded-lg bg-primary/10 text-primary shrink-0">
                <Activity className="size-5" aria-hidden="true" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/60 shadow-sm bg-card">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="space-y-0.5">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Incidentes de Seguridad
                </span>
                <p className="text-2xl font-bold tracking-tight text-foreground">
                  {cargandoIncidentes ? "…" : (paginaIncidentesDatos?.total ?? 0)}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Intentos de acceso fallidos o bloqueos
                </p>
              </div>
              <div className="p-2.5 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 shrink-0">
                <ShieldAlert className="size-5" aria-hidden="true" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/60 shadow-sm bg-card sm:col-span-2 lg:col-span-1">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="space-y-0.5">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Tipos de Acciones
                </span>
                <p className="text-2xl font-bold tracking-tight text-foreground">
                  {opcionesUtiles?.acciones ? opcionesUtiles.acciones.length : "…"}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Operaciones auditadas y catalogadas
                </p>
              </div>
              <div className="p-2.5 rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400 shrink-0">
                <Shield className="size-5" aria-hidden="true" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Bloque de Filtros Unificado mediante BarraFiltros */}
        <BarraFiltros
          busqueda={form.watch("usuario")}
          onBusquedaChange={(val) => {
            form.setValue("usuario", val);
            aplicar({ ...form.getValues(), usuario: val });
          }}
          placeholderBusqueda="Buscar por cédula o nombre de usuario…"
          totalResultados={tabActiva === "bitacora" ? paginaDatos?.total : paginaIncidentesDatos?.total}
          etiquetaResultados={tabActiva === "bitacora" ? "registros" : "incidentes"}
          hayFiltrosActivos={hayFiltros}
          onLimpiarFiltros={limpiar}
          chipsActivos={chipsActivos}
          tituloFiltrosMovil="Filtros avanzados de auditoría"
          accionesSuperiores={
            puedeExportar ? (
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={exportando !== null}
                  onClick={() => exportar("pdf")}
                  className="h-10 flex-1 sm:flex-none px-3 text-sm font-medium gap-1.5"
                  title="Exportar registros filtrados a documento PDF"
                >
                  <FileText className="size-4" aria-hidden="true" />
                  <span>{exportando === "pdf" ? `PDF · ${exportacion.texto}` : "Exportar PDF"}</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={exportando !== null}
                  onClick={() => exportar("excel")}
                  className="h-10 flex-1 sm:flex-none px-3 text-sm font-medium gap-1.5"
                  title="Exportar registros filtrados a hoja de cálculo Excel"
                >
                  <FileSpreadsheet className="size-4" aria-hidden="true" />
                  <span>{exportando === "excel" ? `Excel · ${exportacion.texto}` : "Exportar Excel"}</span>
                </Button>
              </div>
            ) : undefined
          }
        >
          <form
            onSubmit={form.handleSubmit(aplicar)}
            className="grid grid-cols-1 gap-4 sm:col-span-2 lg:col-span-4 sm:grid-cols-2 lg:grid-cols-4"
            noValidate
          >
            {/* Combobox de Acción */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="aud-accion" className="text-sm font-medium">
                Acción
              </Label>
              <ComboboxAcciones
                id="aud-accion"
                accionesDisponibles={opcionesUtiles?.acciones ?? []}
                valor={form.watch("accion") || ""}
                onCambiar={(val) => {
                  form.setValue("accion", val);
                  aplicar({ ...form.getValues(), accion: val });
                }}
              />
            </div>

            {/* Selector de Módulo */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="aud-modulo" className="text-sm font-medium">
                Módulo
              </Label>
              <select
                id="aud-modulo"
                {...form.register("modulo")}
                onChange={(e) => {
                  form.register("modulo").onChange(e);
                  aplicar({ ...form.getValues(), modulo: e.target.value });
                }}
                className="h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">Todos los módulos</option>
                {(opcionesUtiles?.modulos ?? []).map((modulo) => (
                  <option key={modulo} value={modulo}>
                    {NOMBRES_MODULOS[modulo] || modulo}
                  </option>
                ))}
              </select>
            </div>

            {/* Selector de Resultado */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="aud-resultado" className="text-sm font-medium">
                Resultado
              </Label>
              <select
                id="aud-resultado"
                {...form.register("resultado")}
                onChange={(e) => {
                  form.register("resultado").onChange(e);
                  aplicar({ ...form.getValues(), resultado: e.target.value });
                }}
                className="h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">Todos los resultados</option>
                {(opcionesUtiles?.resultados ?? []).map((resultado) => (
                  <option key={resultado} value={resultado}>
                    {ETIQUETA_RESULTADO[resultado] ?? resultado}
                  </option>
                ))}
              </select>
            </div>

            {/* Filtro Recurso */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="aud-recurso" className="text-sm font-medium">
                Recurso
              </Label>
              <Input
                id="aud-recurso"
                placeholder="Tipo o ID de recurso"
                maxLength={100}
                {...form.register("recurso")}
                className="h-10 text-sm bg-background"
              />
            </div>

            {/* Filtro IP */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="aud-ip" className="text-sm font-medium">
                Dirección IP
              </Label>
              <Input
                id="aud-ip"
                placeholder="Ej. 10.0.0.1"
                maxLength={45}
                {...form.register("ip")}
                className="h-10 text-sm bg-background font-mono"
              />
            </div>

            {/* Rango de Fechas: Desde */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="aud-desde" className="text-sm font-medium">
                Desde
              </Label>
              <Input
                id="aud-desde"
                type="date"
                {...form.register("desde")}
                className="h-10 text-sm bg-background"
              />
            </div>

            {/* Rango de Fechas: Hasta */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="aud-hasta" className="text-sm font-medium">
                Hasta
              </Label>
              <Input
                id="aud-hasta"
                type="date"
                {...form.register("hasta")}
                className="h-10 text-sm bg-background"
              />
              {form.formState.errors.hasta && (
                <p role="alert" className="text-sm text-destructive">
                  {form.formState.errors.hasta.message}
                </p>
              )}
            </div>

            {/* Botones de acción del formulario */}
            <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-1">
              <Button
                type="submit"
                disabled={form.formState.isSubmitting}
                className="h-10 px-4 text-sm font-medium gap-1.5 flex-1"
              >
                <Filter className="size-4" aria-hidden="true" />
                <span>Aplicar</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={limpiar}
                className="h-10 px-3 text-sm font-medium gap-1.5"
                title="Limpiar todos los filtros"
              >
                <RotateCcw className="size-4" aria-hidden="true" />
                <span className="sr-only sm:not-sr-only">Limpiar</span>
              </Button>
            </div>
          </form>

          {aviso && (
            <p
              role="status"
              className="mt-3 rounded-md border border-amber-500/50 bg-amber-50 dark:bg-amber-950/20 p-3 text-sm text-amber-900 dark:text-amber-200"
            >
              {aviso}
            </p>
          )}
        </BarraFiltros>

        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

        {/* Pestañas Bitácora / Incidentes de Seguridad (h-11, texto base, margen superior >= 24px) */}
        <div className="mt-6">
          <Tabs
            defaultValue="bitacora"
            value={tabActiva}
            onValueChange={(val) => setTabActiva(val as "bitacora" | "incidentes")}
            className="space-y-4"
          >
            <TabsList className="h-11 p-1 bg-muted/60 border border-border/70 gap-1 rounded-lg">
              <TabsTrigger
                value="bitacora"
                className="h-9 px-4 text-sm font-medium gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md"
              >
                <span>Bitácora de Eventos</span>
                <Badge
                  variant="secondary"
                  className="px-2 py-0 text-xs font-semibold h-5 min-w-[20px] justify-center bg-muted text-foreground"
                >
                  {paginaDatos?.total ?? 0}
                </Badge>
              </TabsTrigger>

              {puedeVerSeguridad && (
                <TabsTrigger
                  value="incidentes"
                  className="h-9 px-4 text-sm font-medium gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md"
                >
                  <ShieldAlert className="size-4 text-rose-500" aria-hidden="true" />
                  <span>Incidentes de Seguridad</span>
                  <Badge
                    variant="secondary"
                    className="px-2 py-0 text-xs font-semibold h-5 min-w-[20px] justify-center bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
                  >
                    {paginaIncidentesDatos?.total ?? 0}
                  </Badge>
                </TabsTrigger>
              )}
            </TabsList>

            {/* Contenido Pestaña Bitácora */}
            <TabsContent value="bitacora" className="space-y-4">
              {isLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-64 w-full" />
                </div>
              ) : !paginaDatos || paginaDatos.resultados.length === 0 ? (
                <Card className="border-border/60">
                  <CardContent className="py-12 text-center text-sm text-muted-foreground space-y-2">
                    <Activity className="size-8 mx-auto text-muted-foreground/50" aria-hidden="true" />
                    <p className="font-medium text-foreground">No se encontraron registros de auditoría.</p>
                    <p className="text-xs">
                      {hayFiltros
                        ? "Pruebe a modificar o limpiar los filtros seleccionados."
                        : "Aún no se han registrado eventos en la bitácora."}
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <>
                  {/* Vista Móvil: Tarjetas responsivas (< 768px) */}
                  <div className="block md:hidden space-y-3">
                    {paginaDatos.resultados.map((registro) => {
                      const etiqueta = obtenerEtiquetaAccion(registro.accion);
                      const sev = obtenerSeveridadAccion(registro.accion);
                      return (
                        <Card key={registro.id} className="border-border/70 shadow-xs">
                          <CardContent className="p-3.5 space-y-2 text-xs">
                            <div className="flex items-center justify-between gap-2 border-b pb-2">
                              <Badge variant="outline" className={`font-medium ${badgeSeveridad(sev)}`}>
                                {etiqueta}
                              </Badge>
                              <Badge
                                variant={registro.resultado === "SUCCESS" ? "secondary" : "destructive"}
                                className="text-[10px] h-5"
                              >
                                {ETIQUETA_RESULTADO[registro.resultado] ?? registro.resultado}
                              </Badge>
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div>
                                <span className="text-muted-foreground block text-[11px]">Usuario:</span>
                                <span className="font-semibold text-foreground">{registro.actorCedula || "—"}</span>
                                {registro.actorNombre && (
                                  <span className="block text-[11px] text-muted-foreground truncate">
                                    {registro.actorNombre}
                                  </span>
                                )}
                              </div>
                              <div>
                                <span className="text-muted-foreground block text-[11px]">Fecha y hora:</span>
                                <span>{formatearFecha(registro.fechaHora)}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground block text-[11px]">Módulo:</span>
                                <span className="capitalize">{NOMBRES_MODULOS[registro.modulo] || registro.modulo}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground block text-[11px]">IP:</span>
                                <span className="font-mono">{registro.ip || "—"}</span>
                              </div>
                            </div>

                            <div className="pt-2 border-t flex justify-end">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setDetalleId(registro.id)}
                                className="h-7 text-xs gap-1"
                              >
                                <Eye className="size-3" aria-hidden="true" />
                                <span>Ver detalle</span>
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>

                  {/* Vista Desktop/Tablet: Tabla completa (>= 768px) */}
                  <div className="hidden md:block rounded-lg border border-border/70 overflow-hidden shadow-xs bg-card">
                    <Table>
                      <TableHeader className="bg-muted/40">
                        <TableRow>
                          <TableHead className="font-semibold">Fecha y Hora</TableHead>
                          <TableHead className="font-semibold">Usuario</TableHead>
                          <TableHead className="font-semibold">Rol</TableHead>
                          <TableHead className="font-semibold">Acción</TableHead>
                          <TableHead className="font-semibold">Módulo</TableHead>
                          <TableHead className="font-semibold">Recurso</TableHead>
                          <TableHead className="font-semibold">IP</TableHead>
                          <TableHead className="font-semibold">Resultado</TableHead>
                          <TableHead className="text-right font-semibold">Detalle</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginaDatos.resultados.map((registro) => {
                          const etiqueta = obtenerEtiquetaAccion(registro.accion);
                          const sev = obtenerSeveridadAccion(registro.accion);
                          return (
                            <TableRow key={registro.id} className="hover:bg-muted/30">
                              <TableCell className="whitespace-nowrap text-xs font-medium">
                                {formatearFecha(registro.fechaHora)}
                              </TableCell>
                              <TableCell>
                                <span className="font-semibold text-xs text-foreground block">
                                  {registro.actorCedula || "—"}
                                </span>
                                {registro.actorNombre && (
                                  <span className="block text-[11px] text-muted-foreground truncate max-w-[150px]">
                                    {registro.actorNombre}
                                  </span>
                                )}
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                {registro.actorRolVisible || registro.actorRol || "—"}
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant="outline"
                                  className={`font-medium text-xs whitespace-nowrap ${badgeSeveridad(sev)}`}
                                  title={registro.accion}
                                >
                                  {etiqueta}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-xs text-foreground/80 font-medium whitespace-nowrap">
                                {NOMBRES_MODULOS[registro.modulo] || registro.modulo}
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground truncate max-w-[120px]" title={`${registro.recursoTipo}#${registro.recursoId}`}>
                                {`${registro.recursoTipo}#${registro.recursoId}`.replace(/^#|#$/g, "") || "—"}
                              </TableCell>
                              <TableCell className="font-mono text-xs text-muted-foreground whitespace-nowrap">
                                {registro.ip || "—"}
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant={registro.resultado === "SUCCESS" ? "secondary" : "destructive"}
                                  className="text-xs"
                                >
                                  {ETIQUETA_RESULTADO[registro.resultado] ?? registro.resultado}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setDetalleId(registro.id)}
                                  className="h-8 px-2 text-xs gap-1 hover:bg-muted cursor-pointer"
                                  title="Ver trazabilidad completa del evento"
                                >
                                  <Eye className="size-3.5" aria-hidden="true" />
                                  <span>Detalle</span>
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>

                  <Paginador
                    pagina={paginaDatos.pagina}
                    totalPaginas={paginaDatos.totalPaginas}
                    totalRegistros={paginaDatos.total}
                    onCambiar={setPagina}
                  />
                </>
              )}
            </TabsContent>

            {/* Contenido Pestaña Incidentes de Seguridad */}
            {puedeVerSeguridad && (
              <TabsContent value="incidentes" className="space-y-4">
                {cargandoIncidentes ? (
                  <Skeleton className="h-64 w-full" />
                ) : !paginaIncidentesDatos || paginaIncidentesDatos.resultados.length === 0 ? (
                  <Card className="border-border/60">
                    <CardContent className="py-12 text-center text-sm text-muted-foreground space-y-2">
                      <Shield className="size-8 mx-auto text-muted-foreground/50" aria-hidden="true" />
                      <p className="font-medium text-foreground">No se registran incidentes de seguridad.</p>
                      <p className="text-xs">Los intentos de autenticación se encuentran dentro de los parámetros seguros.</p>
                    </CardContent>
                  </Card>
                ) : (
                  <>
                    <div className="rounded-lg border border-border/70 overflow-hidden shadow-xs bg-card">
                      <Table>
                        <TableHeader className="bg-muted/40">
                          <TableRow>
                            <TableHead className="font-semibold">Fecha y Hora</TableHead>
                            <TableHead className="font-semibold">Cédula</TableHead>
                            <TableHead className="font-semibold">Nombre Identificado</TableHead>
                            <TableHead className="font-semibold">IP Origen</TableHead>
                            <TableHead className="font-semibold">Resultado de Acceso</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {paginaIncidentesDatos.resultados.map((incidente) => (
                            <TableRow key={incidente.id} className="hover:bg-muted/30">
                              <TableCell className="whitespace-nowrap text-xs font-medium">
                                {formatearFecha(incidente.fechaHora)}
                              </TableCell>
                              <TableCell className="font-semibold text-xs text-foreground">
                                {incidente.cedula}
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                {incidente.nombre || "—"}
                              </TableCell>
                              <TableCell className="font-mono text-xs text-muted-foreground">
                                {incidente.ip || "—"}
                              </TableCell>
                              <TableCell>
                                <Badge variant="destructive" className="text-xs">
                                  {incidente.resultado}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    <Paginador
                      pagina={paginaIncidentesDatos.pagina}
                      totalPaginas={paginaIncidentesDatos.totalPaginas}
                      totalRegistros={paginaIncidentesDatos.total}
                      onCambiar={setPaginaIncidentes}
                    />
                  </>
                )}
              </TabsContent>
            )}
          </Tabs>
        </div>

        {/* Modal de Detalle Profesional */}
        <DetalleAuditoriaModal
          id={detalleId}
          onCerrar={() => setDetalleId(null)}
          onRefrescar={mutate}
        />
      </div>
    </PageLayout>
  );
}

function Paginador({
  pagina,
  totalPaginas,
  totalRegistros,
  onCambiar,
}: {
  pagina: number;
  totalPaginas: number;
  totalRegistros: number;
  onCambiar: (pagina: number) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-xs text-muted-foreground">
      <span>
        Mostrando página <strong className="text-foreground">{pagina}</strong> de{" "}
        <strong className="text-foreground">{totalPaginas || 1}</strong> ({totalRegistros} resultados totales)
      </span>
      <div className="flex items-center gap-1.5">
        <Button
          size="sm"
          variant="outline"
          disabled={pagina <= 1}
          onClick={() => onCambiar(pagina - 1)}
          className="h-8 px-3 text-xs"
        >
          Anterior
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={pagina >= totalPaginas}
          onClick={() => onCambiar(pagina + 1)}
          className="h-8 px-3 text-xs"
        >
          Siguiente
        </Button>
      </div>
    </div>
  );
}
