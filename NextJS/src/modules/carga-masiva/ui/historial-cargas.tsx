"use client";

import { useEffect, useState, useMemo } from "react";
import {
  Check,
  Download,
  Eye,
  History,
  Play,
  RefreshCw,
  RotateCcw,
  Search,
  X,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BadgeEstadoCarga, BadgeEstadoFila } from "./badge-estado-carga";
import { ResumenMovimiento } from "./paso-revision-analisis";
import type {
  CargaMasivaDetalle,
  CargaMasivaResumen,
  PoblacionCarga,
} from "../domain/entities/carga-masiva";
import {
  aplicarCargaAction,
  aprobarCargaAction,
  listarCargasAction,
  obtenerDetalleCargaAction,
  rechazarCargaAction,
  revertirCargaAction,
} from "../infrastructure/actions/carga-masiva-actions";

export function HistorialCargas({ poblacionFija }: { poblacionFija?: PoblacionCarga }) {
  const { data: session } = useSession();
  const permisosUsuario = useMemo(
    () => new Set(session?.user?.permisos ?? []),
    [session],
  );

  const puedeCargarActivos = permisosUsuario.has("personal.carga_masiva");
  const puedeCargarPasivos = permisosUsuario.has("pasivos.carga_masiva");
  const puedeAprobar = permisosUsuario.has("personal.carga_masiva_aprobar");
  const puedeRevertir = permisosUsuario.has("personal.carga_masiva_revertir");
  const puedeAplicar = permisosUsuario.has("personal.carga_masiva_aplicar");

  const puedeGestionar = (carga: CargaMasivaResumen) =>
    puedeAprobar ||
    (carga.poblacion === "PASIVOS" ? puedeCargarPasivos : puedeCargarActivos);

  const [cargas, setCargas] = useState<CargaMasivaResumen[]>([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [filtroPoblacion, setFiltroPoblacion] = useState<PoblacionCarga | "TODAS">(
    poblacionFija ?? "TODAS",
  );

  // Diálogo de detalle
  const [cargaDetalleId, setCargaDetalleId] = useState<string | null>(null);
  const [detalle, setDetalle] = useState<CargaMasivaDetalle | null>(null);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const [filtroEstadoFila, setFiltroEstadoFila] = useState("TODAS");

  // Modal Rechazar
  const [cargaARechazar, setCargaARechazar] = useState<string | null>(null);
  const [motivoRechazo, setMotivoRechazo] = useState("");
  const [procesandoRechazo, setProcesandoRechazo] = useState(false);

  // Modal Revertir
  const [cargaARevertir, setCargaARevertir] = useState<CargaMasivaResumen | null>(null);
  const [procesandoReversion, setProcesandoReversion] = useState(false);

  const cargarHistorial = async () => {
    setCargando(true);
    const res = await listarCargasAction(
      filtroPoblacion === "TODAS" ? undefined : filtroPoblacion,
    );
    if (res.success && res.data) {
      setCargas(res.data);
    } else {
      toast.error(res.error || "No se pudo cargar el historial.");
    }
    setCargando(false);
  };

  useEffect(() => {
    cargarHistorial();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtroPoblacion]);

  const verDetalle = async (id: string) => {
    setCargaDetalleId(id);
    setCargandoDetalle(true);
    const res = await obtenerDetalleCargaAction(id);
    if (res.success && res.data) {
      setDetalle(res.data);
    } else {
      toast.error(res.error || "Error al obtener el detalle.");
    }
    setCargandoDetalle(false);
  };

  const aplicarDirecto = async (id: string) => {
    try {
      const res = await aplicarCargaAction(id);
      if (res.success) {
        toast.success(
          res.data?.estado === "PENDIENTE_APROBACION"
            ? "Carga enviada a aprobación."
            : "Carga procesada correctamente.",
        );
      } else if (res.error && /requiere.*aprobación/i.test(res.error)) {
        toast.info(res.error);
      } else {
        toast.error(res.error || "No se pudo aplicar la carga.");
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error al aplicar");
    } finally {
      await cargarHistorial();
    }
  };

  const aprobarDirecto = async (id: string) => {
    try {
      const res = await aprobarCargaAction(id);
      if (res.success) {
        toast.success("Carga aprobada y aplicada exitosamente.");
      } else {
        toast.error(res.error || "No se pudo aprobar la carga.");
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error al aprobar");
    } finally {
      await cargarHistorial();
    }
  };

  const confirmarRechazo = async () => {
    if (!cargaARechazar || !motivoRechazo.trim()) {
      toast.error("Debe indicar el motivo de rechazo.");
      return;
    }
    setProcesandoRechazo(true);
    try {
      const res = await rechazarCargaAction(cargaARechazar, motivoRechazo);
      if (res.success) {
        toast.success("Carga rechazada exitosamente.");
        setCargaARechazar(null);
        setMotivoRechazo("");
      } else {
        toast.error(res.error || "No se pudo rechazar la carga.");
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error al rechazar");
    } finally {
      setProcesandoRechazo(false);
      await cargarHistorial();
    }
  };

  const confirmarReversion = async () => {
    if (!cargaARevertir) return;
    setProcesandoReversion(true);
    try {
      const res = await revertirCargaAction(cargaARevertir.id);
      if (res.success) {
        toast.success("Carga masiva revertida exitosamente.");
        setCargaARevertir(null);
      } else {
        toast.error(res.error || "No se pudo revertir la carga.");
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error al revertir");
    } finally {
      setProcesandoReversion(false);
      await cargarHistorial();
    }
  };

  const descargarResultados = async (id: string) => {
    try {
      const response = await fetch(`/api/carga-masiva/${id}/resultados`);
      if (!response.ok) throw new Error("Error al descargar resultados.");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `resultados-${id}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success("Resultados descargados.");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error al descargar resultados");
    }
  };

  const cargasFiltradas = useMemo(() => {
    if (!busqueda) return cargas;
    const term = busqueda.toLowerCase();
    return cargas.filter(
      (c) =>
        c.archivo.toLowerCase().includes(term) ||
        c.estado.toLowerCase().includes(term) ||
        c.poblacion.toLowerCase().includes(term) ||
        c.tipos.some((t) => t.toLowerCase().includes(term)),
    );
  }, [cargas, busqueda]);

  const filasDetalleFiltradas = useMemo(() => {
    if (!detalle?.filas) return [];
    if (filtroEstadoFila === "TODAS") return detalle.filas;
    return detalle.filas.filter((f) => f.estado === filtroEstadoFila);
  }, [detalle, filtroEstadoFila]);

  const formatearFecha = (iso: string) => {
    try {
      return new Date(iso).toLocaleString("es-VE", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return iso;
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <History className="size-5 text-primary" />
              Historial de Cargas Masivas
            </CardTitle>
            <CardDescription>
              Registro histórico de auditoría, trazabilidad de archivos procesados, reversiones y aprobaciones.
            </CardDescription>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={cargarHistorial}
              disabled={cargando}
              className="h-8 text-xs"
            >
              <RefreshCw className={`size-3.5 mr-1 ${cargando ? "animate-spin" : ""}`} />
              Actualizar
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Filtro de población y buscador */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {!poblacionFija && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-semibold text-muted-foreground mr-1">Población:</span>
              {(["TODAS", "ACTIVOS", "PASIVOS"] as const).map((pob) => (
                <Button
                  key={pob}
                  variant={filtroPoblacion === pob ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFiltroPoblacion(pob)}
                  className="h-7 px-2.5 text-xs"
                >
                  {pob === "TODAS" ? "Todas" : pob === "ACTIVOS" ? "Activos" : "Pasivos"}
                </Button>
              ))}
            </div>
          )}
          <div className="relative w-full sm:w-72">
            <Search className="size-4 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
            <Input
              placeholder="Buscar por archivo, estado o población..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="pl-8 h-8 text-xs"
            />
          </div>
        </div>

        {/* Tabla */}
        {cargando ? (
          <div className="py-12 flex flex-col items-center justify-center space-y-2 text-muted-foreground">
            <Loader2 className="size-6 animate-spin text-primary" />
            <p className="text-xs">Cargando historial...</p>
          </div>
        ) : cargasFiltradas.length === 0 ? (
          <div className="py-10 text-center text-xs text-muted-foreground border rounded-lg">
            No hay registros de cargas masivas registradas en el sistema.
          </div>
        ) : (
          <div className="rounded-lg border overflow-hidden">
            <ScrollArea className="h-[440px] w-full">
              <Table>
                <TableHeader className="bg-muted/50 sticky top-0 z-10 backdrop-blur-sm">
                  <TableRow>
                    <TableHead className="text-xs">Archivo / Fecha</TableHead>
                    <TableHead className="w-24 text-xs">Población</TableHead>
                    <TableHead className="text-xs">Tipos Incluidos</TableHead>
                    <TableHead className="w-32 text-center text-xs">Métricas</TableHead>
                    <TableHead className="w-36 text-center text-xs">Estado</TableHead>
                    <TableHead className="w-48 text-right text-xs">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cargasFiltradas.map((carga) => (
                    <TableRow key={carga.id}>
                      <TableCell className="space-y-0.5">
                        <p className="text-xs font-semibold truncate max-w-xs">{carga.archivo}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {formatearFecha(carga.creada_en)}
                        </p>
                      </TableCell>

                      <TableCell className="text-xs">
                        <span className="px-1.5 py-0.5 rounded bg-muted text-[10px] font-semibold">
                          {carga.poblacion === "PASIVOS" ? "Pasivos" : "Activos"}
                        </span>
                      </TableCell>

                      <TableCell className="text-xs text-muted-foreground">
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {carga.tipos.map((t) => (
                            <span
                              key={t}
                              className="px-1.5 py-0.5 rounded bg-muted text-[10px] capitalize font-medium"
                            >
                              {t.replace(/_/g, " ")}
                            </span>
                          ))}
                        </div>
                      </TableCell>

                      <TableCell className="text-center font-mono text-xs">
                        <span className="text-foreground font-semibold">{carga.filas_total}</span>
                        <span className="text-muted-foreground"> / </span>
                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                          {carga.filas_validas}
                        </span>
                        {carga.filas_error > 0 && (
                          <>
                            <span className="text-muted-foreground"> / </span>
                            <span className="text-rose-600 dark:text-rose-400 font-semibold">
                              {carga.filas_error}
                            </span>
                          </>
                        )}
                        {carga.filas_confirmacion > 0 && (
                          <span className="block text-[10px] text-amber-600 dark:text-amber-400">
                            {carga.filas_confirmadas}/{carga.filas_confirmacion} confirmadas
                          </span>
                        )}
                      </TableCell>

                      <TableCell className="text-center">
                        <BadgeEstadoCarga estado={carga.estado} />
                      </TableCell>

                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => verDetalle(carga.id)}
                            className="size-7 p-0"
                            title="Ver detalle de filas"
                          >
                            <Eye className="size-3.5" />
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => descargarResultados(carga.id)}
                            className="size-7 p-0"
                            title="Descargar Excel de resultados"
                          >
                            <Download className="size-3.5" />
                          </Button>

                          {/* Aplicar si está analizada y no quedan cambios de condición sin confirmar */}
                          {carga.estado === "ANALIZADA" && puedeAplicar && puedeGestionar(carga) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => aplicarDirecto(carga.id)}
                              disabled={
                                carga.filas_confirmacion > 0 &&
                                carga.filas_confirmadas < carga.filas_confirmacion
                              }
                              className="size-7 p-0 text-primary hover:text-primary hover:bg-primary/10 disabled:opacity-40"
                              title={
                                carga.filas_confirmacion > 0 &&
                                carga.filas_confirmadas < carga.filas_confirmacion
                                  ? "Confirme las filas de cambio de condición antes de aplicar"
                                  : "Aplicar carga masiva"
                              }
                            >
                              <Play className="size-3.5" />
                            </Button>
                          )}

                          {/* Aprobar / Rechazar si está pendiente */}
                          {carga.estado === "PENDIENTE_APROBACION" && puedeAprobar && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => aprobarDirecto(carga.id)}
                                className="size-7 p-0 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                                title="Aprobar carga"
                              >
                                <Check className="size-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setCargaARechazar(carga.id);
                                  setMotivoRechazo("");
                                }}
                                className="size-7 p-0 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                                title="Rechazar carga"
                              >
                                <X className="size-3.5" />
                              </Button>
                            </>
                          )}

                          {/* Revertir si está aplicada */}
                          {carga.estado === "APLICADA" && puedeRevertir && puedeGestionar(carga) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setCargaARevertir(carga)}
                              className="size-7 p-0 text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                              title="Revertir carga completa"
                            >
                              <RotateCcw className="size-3.5" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>
        )}
      </CardContent>

      {/* Diálogo de Detalle de Carga Histórica */}
      <Dialog
        open={cargaDetalleId !== null}
        onOpenChange={(abierto) => !abierto && setCargaDetalleId(null)}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <DialogTitle className="text-base font-semibold">
                Detalle de Carga: {detalle?.archivo}
              </DialogTitle>
              {detalle && <BadgeEstadoCarga estado={detalle.estado} />}
            </div>
            <DialogDescription className="text-xs">
              Población: <strong>{detalle?.poblacion === "PASIVOS" ? "Pasivos" : "Activos"}</strong>.
              Métricas: {detalle?.filas_total} filas totales | {detalle?.filas_validas} válidas |{" "}
              {detalle?.filas_error} con error | {detalle?.filas_confirmadas}/{detalle?.filas_confirmacion} confirmadas
            </DialogDescription>
          </DialogHeader>

          {cargandoDetalle ? (
            <div className="py-12 flex justify-center">
              <Loader2 className="size-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-3 py-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-semibold text-muted-foreground mr-1">Filtrar:</span>
                {["TODAS", "ERROR", "REQUIERE_CONFIRMACION", "POSIBLE_DUPLICADO", "NUEVO", "ACTUALIZAR", "SIN_CAMBIOS", "ADVERTENCIA"].map((est) => (
                  <Button
                    key={est}
                    variant={filtroEstadoFila === est ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFiltroEstadoFila(est)}
                    className="h-6 px-2 text-[11px]"
                  >
                    {est === "TODAS"
                      ? "Todas"
                      : est === "REQUIERE_CONFIRMACION"
                      ? "Requiere confirmación"
                      : est === "POSIBLE_DUPLICADO"
                      ? "Posible duplicado"
                      : est}
                  </Button>
                ))}
              </div>

              <ScrollArea className="h-72 rounded-md border">
                <Table>
                  <TableHeader className="bg-muted/50 sticky top-0 z-10 backdrop-blur-sm">
                    <TableRow>
                      <TableHead className="w-14 text-center text-xs">Fila</TableHead>
                      <TableHead className="w-36 text-xs">Tipo</TableHead>
                      <TableHead className="w-40 text-center text-xs">Estado</TableHead>
                      <TableHead className="text-xs">Detalle</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filasDetalleFiltradas.map((f) => (
                      <TableRow
                        key={f.id}
                        className={
                          f.estado === "REQUIERE_CONFIRMACION" ||
                          f.estado === "POSIBLE_DUPLICADO"
                            ? f.confirmada
                              ? "bg-emerald-50/40 dark:bg-emerald-950/20"
                              : "bg-amber-50/60 dark:bg-amber-950/25"
                            : undefined
                        }
                      >
                        <TableCell className="text-center font-mono text-xs">{f.numero_fila}</TableCell>
                        <TableCell className="text-xs capitalize font-medium">
                          {f.tipo.replace(/_/g, " ")}
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex flex-col items-center gap-1">
                            <BadgeEstadoFila estado={f.estado} />
                            {(f.estado === "REQUIERE_CONFIRMACION" ||
                              f.estado === "POSIBLE_DUPLICADO") && (
                              <span
                                className={`text-[10px] font-semibold ${
                                  f.confirmada
                                    ? "text-emerald-600 dark:text-emerald-400"
                                    : "text-amber-700 dark:text-amber-300"
                                }`}
                              >
                                {f.confirmada ? "Confirmada" : "Sin confirmar"}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground space-y-1">
                          <p>{f.detalle}</p>
                          {f.movimiento?.tipo ? <ResumenMovimiento movimiento={f.movimiento} /> : null}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Diálogo Rechazo con Motivo */}
      <Dialog
        open={cargaARechazar !== null}
        onOpenChange={(abierto) => !abierto && setCargaARechazar(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Rechazar Carga Masiva</DialogTitle>
            <DialogDescription className="text-xs">
              Indique obligatoriamente el motivo administrativo por el cual se rechaza esta carga.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2">
            <Textarea
              placeholder="Escriba aquí las razones del rechazo (ej. inconsistencias en los cargos)..."
              value={motivoRechazo}
              onChange={(e) => setMotivoRechazo(e.target.value)}
              className="min-h-[100px] text-xs"
            />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCargaARechazar(null)}
              disabled={procesandoRechazo}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={confirmarRechazo}
              disabled={procesandoRechazo || !motivoRechazo.trim()}
            >
              {procesandoRechazo ? "Rechazando..." : "Confirmar Rechazo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Alerta de Reversión */}
      <AlertDialog
        open={cargaARevertir !== null}
        onOpenChange={(abierto) => !abierto && setCargaARevertir(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-amber-500" />
              ¿Confirmar Reversión de Carga?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              Esta operación revertirá todos los registros aplicados del archivo{" "}
              <strong>{cargaARevertir?.archivo}</strong>: los registros creados serán eliminados y los
              actualizados volverán a sus valores previos. Quedará registro de auditoría del evento.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={procesandoReversion}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmarReversion}
              disabled={procesandoReversion}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              {procesandoReversion ? "Revirtiendo..." : "Sí, Revertir Carga"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
