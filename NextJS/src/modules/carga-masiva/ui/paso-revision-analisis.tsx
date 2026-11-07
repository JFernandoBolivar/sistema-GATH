"use client";

import { useEffect, useState, useMemo } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Filter,
  Search,
  XCircle,
  Eye,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BadgeEstadoCarga, BadgeEstadoFila } from "./badge-estado-carga";
import type {
  CargaMasivaDetalle,
  CargaMasivaFila,
  CargaMasivaResumen,
  MovimientoCondicion,
} from "../domain/entities/carga-masiva";
import {
  confirmarFilasCargaAction,
  obtenerDetalleCargaAction,
} from "../infrastructure/actions/carga-masiva-actions";

interface PropsPasoRevisionAnalisis {
  resumen: CargaMasivaResumen;
  onRetroceder: () => void;
  onContinuar: (detalle: CargaMasivaDetalle) => void;
}

export function ResumenMovimiento({ movimiento }: { movimiento: MovimientoCondicion }) {
  return (
    <div className="rounded-md border border-amber-300 dark:border-amber-800 bg-amber-50/70 dark:bg-amber-950/30 p-3 text-xs space-y-1">
      <p className="font-semibold text-amber-900 dark:text-amber-200">
        {movimiento.condicion_actual} → {movimiento.condicion_nueva}
      </p>
      <p className="text-amber-900/90 dark:text-amber-200/90">{movimiento.descripcion}</p>
      <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-amber-900/80 dark:text-amber-200/80">
        <span>Fecha: {movimiento.fecha || "—"}</span>
        <span>Motivo: {movimiento.motivo || "—"}</span>
        {movimiento.tipo_nomina ? <span>Nómina: {movimiento.tipo_nomina}</span> : null}
        {movimiento.cargo_codigo ? <span>Cargo: {movimiento.cargo_codigo}</span> : null}
      </div>
      {!movimiento.completo && (
        <p className="font-medium text-rose-700 dark:text-rose-300">
          Faltan datos del movimiento: {(movimiento.faltantes ?? []).join(", ")}.
        </p>
      )}
    </div>
  );
}

export function PasoRevisionAnalisis({
  resumen,
  onRetroceder,
  onContinuar,
}: PropsPasoRevisionAnalisis) {
  const [detalle, setDetalle] = useState<CargaMasivaDetalle | null>(null);
  const [cargando, setCargando] = useState(true);
  const [filtroEstado, setFiltroEstado] = useState<string>("TODAS");
  const [busqueda, setBusqueda] = useState<string>("");
  const [filaSeleccionada, setFilaSeleccionada] = useState<CargaMasivaFila | null>(null);
  const [descargandoResultados, setDescargandoResultados] = useState(false);
  const [seleccionadas, setSeleccionadas] = useState<Set<string>>(new Set());
  const [dialogoConfirmar, setDialogoConfirmar] = useState(false);
  const [confirmando, setConfirmando] = useState(false);

  const cargarDetalle = async () => {
    const res = await obtenerDetalleCargaAction(resumen.id);
    if (res.success && res.data) {
      setDetalle(res.data);
      setSeleccionadas(new Set());
    } else {
      toast.error(res.error || "No se pudo cargar el detalle de filas.");
    }
  };

  useEffect(() => {
    let activo = true;
    async function cargar() {
      setCargando(true);
      const res = await obtenerDetalleCargaAction(resumen.id);
      if (activo) {
        if (res.success && res.data) {
          setDetalle(res.data);
        } else {
          toast.error(res.error || "No se pudo cargar el detalle de filas.");
        }
        setCargando(false);
      }
    }
    cargar();
    return () => {
      activo = false;
    };
  }, [resumen.id]);

  const filasFiltradas = useMemo(() => {
    if (!detalle?.filas) return [];
    return detalle.filas.filter((f) => {
      if (filtroEstado !== "TODAS" && f.estado !== filtroEstado) return false;
      if (!busqueda) return true;
      const term = busqueda.toLowerCase();
      const enTipo = f.tipo.toLowerCase().includes(term);
      const enDetalle = f.detalle.toLowerCase().includes(term);
      const enDatos = JSON.stringify(f.datos).toLowerCase().includes(term);
      return enTipo || enDetalle || enDatos;
    });
  }, [detalle, filtroEstado, busqueda]);

  const filasConfirmacion = useMemo(
    () => detalle?.filas.filter((f) => f.estado === "REQUIERE_CONFIRMACION") ?? [],
    [detalle],
  );
  const pendientesConfirmacion = filasConfirmacion.filter((f) => !f.confirmada);
  const seleccionadasDetalle = filasConfirmacion.filter((f) => seleccionadas.has(f.id));
  const todasSeleccionadas =
    pendientesConfirmacion.length > 0 &&
    pendientesConfirmacion.every((f) => seleccionadas.has(f.id));

  const alternarSeleccion = (fila: CargaMasivaFila) => {
    if (fila.confirmada) return;
    setSeleccionadas((prev) => {
      const nueva = new Set(prev);
      if (nueva.has(fila.id)) nueva.delete(fila.id);
      else nueva.add(fila.id);
      return nueva;
    });
  };

  const alternarTodas = () => {
    if (todasSeleccionadas) {
      setSeleccionadas(new Set());
    } else {
      setSeleccionadas(new Set(pendientesConfirmacion.map((f) => f.id)));
    }
  };

  const confirmarSeleccionadas = async () => {
    setConfirmando(true);
    try {
      const res = await confirmarFilasCargaAction(
        resumen.id,
        Array.from(seleccionadas),
      );
      if (res.success) {
        toast.success(
          `${seleccionadas.size} fila(s) confirmada(s). El movimiento se registrará al aplicar la carga.`,
        );
        setDialogoConfirmar(false);
        await cargarDetalle();
      } else {
        toast.error(res.error || "No se pudieron confirmar las filas.");
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error al confirmar las filas");
    } finally {
      setConfirmando(false);
    }
  };

  const descargarResultadosExcel = async () => {
    setDescargandoResultados(true);
    try {
      const response = await fetch(`/api/carga-masiva/${resumen.id}/resultados`);
      if (!response.ok) throw new Error("Error al descargar resultados.");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `resultados-${resumen.id}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success("Resultados descargados en Excel.");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error al descargar resultados");
    } finally {
      setDescargandoResultados(false);
    }
  };

  const totalFilas = detalle?.filas_total ?? resumen.filas_total;
  const filasValidas = detalle?.filas_validas ?? resumen.filas_validas;
  const filasError = detalle?.filas_error ?? resumen.filas_error;
  const filasConfirmadas = detalle?.filas_confirmadas ?? resumen.filas_confirmadas;
  const filasConfirmacionTotal = detalle?.filas_confirmacion ?? resumen.filas_confirmacion;

  return (
    <div className="space-y-6">
      {/* Encabezado y tarjetas de métricas */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <FileSpreadsheet className="size-5 text-primary" />
                  Paso 3: Resultados del Análisis Preliminar
                </CardTitle>
                <BadgeEstadoCarga estado={detalle?.estado ?? resumen.estado} />
              </div>
              <CardDescription>
                Archivo: <span className="font-medium text-foreground">{resumen.archivo}</span>.
                Población: <strong className="text-foreground">{resumen.poblacion === "PASIVOS" ? "Pasivos" : "Activos"}</strong>.
                Revise cada registro antes de confirmar la aplicación definitiva.
              </CardDescription>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={descargarResultadosExcel}
              disabled={descargandoResultados}
              className="h-9 shrink-0"
            >
              <Download className="size-4 mr-2" />
              {descargandoResultados ? "Descargando..." : "Descargar Resultados (.xlsx)"}
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Métricas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl border bg-card flex items-center gap-3.5">
              <div className="size-10 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                <FileSpreadsheet className="size-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Total de Filas</p>
                <p className="text-2xl font-bold tracking-tight">{totalFilas}</p>
              </div>
            </div>

            <div className="p-4 rounded-xl border bg-card flex items-center gap-3.5">
              <div className="size-10 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <CheckCircle2 className="size-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Filas Válidas</p>
                <p className="text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
                  {filasValidas}
                </p>
              </div>
            </div>

            <div className="p-4 rounded-xl border bg-card flex items-center gap-3.5">
              <div className="size-10 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <ShieldCheck className="size-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Requieren Confirmación</p>
                <p className="text-2xl font-bold tracking-tight text-amber-600 dark:text-amber-400">
                  {filasConfirmadas} / {filasConfirmacionTotal}
                </p>
              </div>
            </div>

            <div className="p-4 rounded-xl border bg-card flex items-center gap-3.5">
              <div className="size-10 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                <XCircle className="size-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Filas con Error</p>
                <p className="text-2xl font-bold tracking-tight text-rose-600 dark:text-rose-400">
                  {filasError}
                </p>
              </div>
            </div>
          </div>

          {/* Filtros y Buscador */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2 border-t">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-semibold text-muted-foreground mr-1 flex items-center">
                <Filter className="size-3 mr-1" />
                Estado:
              </span>
              {["TODAS", "ERROR", "REQUIERE_CONFIRMACION", "NUEVO", "ACTUALIZAR", "SIN_CAMBIOS", "ADVERTENCIA"].map((est) => (
                <Button
                  key={est}
                  variant={filtroEstado === est ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFiltroEstado(est)}
                  className="h-7 px-2.5 text-xs"
                >
                  {est === "TODAS"
                    ? "Todas"
                    : est === "REQUIERE_CONFIRMACION"
                    ? "Requiere confirmación"
                    : est}
                </Button>
              ))}
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="size-4 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
              <Input
                placeholder="Buscar cédula, tipo o detalle..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="pl-8 h-8 text-xs"
              />
            </div>
          </div>

          {/* Acciones de confirmación */}
          {filasConfirmacion.length > 0 && (
            <div className="rounded-md border border-amber-300 dark:border-amber-800 bg-amber-50/70 dark:bg-amber-950/30 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-2.5 text-xs text-amber-900 dark:text-amber-200">
                <AlertTriangle className="size-4 shrink-0 mt-0.5" />
                <p>
                  <strong>{pendientesConfirmacion.length} fila(s)</strong> cambian la condición del
                  trabajador. Selecciónelas y confirme el movimiento: sin confirmación no se aplican.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={alternarTodas}
                  className="h-8 text-xs"
                >
                  {todasSeleccionadas ? "Quitar selección" : "Seleccionar pendientes"}
                </Button>
                <Button
                  size="sm"
                  onClick={() => setDialogoConfirmar(true)}
                  disabled={seleccionadas.size === 0}
                  className="h-8 text-xs"
                >
                  <ShieldCheck className="size-3.5 mr-1" />
                  Confirmar seleccionadas ({seleccionadas.size})
                </Button>
              </div>
            </div>
          )}

          {/* Tabla de Filas con ScrollArea */}
          {cargando ? (
            <div className="py-12 flex flex-col items-center justify-center space-y-2 text-muted-foreground">
              <Loader2 className="size-6 animate-spin text-primary" />
              <p className="text-xs">Cargando registros analizados...</p>
            </div>
          ) : filasFiltradas.length === 0 ? (
            <div className="py-10 text-center text-xs text-muted-foreground border rounded-lg">
              No se encontraron filas con el filtro aplicado.
            </div>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <ScrollArea className="h-[420px] w-full">
                <Table>
                  <TableHeader className="bg-muted/50 sticky top-0 z-10 backdrop-blur-sm">
                    <TableRow>
                      <TableHead className="w-12 text-center text-xs">Conf.</TableHead>
                      <TableHead className="w-16 text-center text-xs">Fila</TableHead>
                      <TableHead className="w-40 text-xs">Tipo</TableHead>
                      <TableHead className="w-36 text-center text-xs">Estado</TableHead>
                      <TableHead className="text-xs">Detalle / Diagnóstico</TableHead>
                      <TableHead className="w-20 text-center text-xs">Acción</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filasFiltradas.map((fila) => {
                      const requiere = fila.estado === "REQUIERE_CONFIRMACION";
                      const claseFila = requiere
                        ? fila.confirmada
                          ? "bg-emerald-50/40 dark:bg-emerald-950/20 hover:bg-emerald-50/60"
                          : "bg-amber-50/50 dark:bg-amber-950/25 hover:bg-amber-50/70"
                        : fila.estado === "ERROR"
                        ? "bg-rose-50/30 dark:bg-rose-950/20 hover:bg-rose-50/50"
                        : undefined;
                      return (
                        <TableRow key={fila.id} className={claseFila}>
                          <TableCell className="text-center">
                            {requiere ? (
                              <Checkbox
                                checked={fila.confirmada || seleccionadas.has(fila.id)}
                                disabled={fila.confirmada}
                                onCheckedChange={() => alternarSeleccion(fila)}
                                aria-label={`Confirmar fila ${fila.numero_fila}`}
                              />
                            ) : null}
                          </TableCell>
                          <TableCell className="text-center font-mono text-xs">
                            {fila.numero_fila}
                          </TableCell>
                          <TableCell className="text-xs font-medium capitalize">
                            {fila.tipo.replace(/_/g, " ")}
                          </TableCell>
                          <TableCell className="text-center">
                            <BadgeEstadoFila estado={fila.estado} />
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            <p className="line-clamp-3">{fila.detalle || "Sin observaciones."}</p>
                          </TableCell>
                          <TableCell className="text-center">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setFilaSeleccionada(fila)}
                              className="size-7 p-0"
                              title="Ver datos de la fila"
                            >
                              <Eye className="size-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </ScrollArea>
            </div>
          )}

          {/* Nota de aplicación */}
          {filasError > 0 && (
            <div className="rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2.5">
              <AlertTriangle className="size-4 shrink-0 mt-0.5" />
              <p>
                <strong>Atención:</strong> Existen <strong>{filasError} fila(s) con error</strong> que serán
                omitidas durante la aplicación. Puede continuar para aplicar únicamente las {filasValidas} fila(s) válidas,
                o descargar los resultados en Excel para corregir el archivo y volver a analizar.
              </p>
            </div>
          )}

          {pendientesConfirmacion.length > 0 && (
            <div className="rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2.5">
              <ShieldCheck className="size-4 shrink-0 mt-0.5" />
              <p>
                Quedan <strong>{pendientesConfirmacion.length} fila(s) por confirmar</strong>.
                Debe confirmarlas para continuar; de lo contrario el cambio de condición no se aplicará.
              </p>
            </div>
          )}

          {/* Botones de navegación */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-3 border-t">
            <Button variant="outline" onClick={onRetroceder} className="w-full sm:w-auto">
              <ArrowLeft className="size-4 mr-2" />
              Atrás (Cargar otro archivo)
            </Button>

            <Button
              onClick={() => detalle && onContinuar(detalle)}
              disabled={
                !detalle ||
                filasValidas === 0 ||
                pendientesConfirmacion.length > 0
              }
              className="w-full sm:w-auto"
            >
              Continuar a Confirmación ({filasValidas} válidas)
              <ArrowRight className="size-4 ml-2" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Diálogo de Detalle de Fila */}
      <Dialog
        open={filaSeleccionada !== null}
        onOpenChange={(abierto) => !abierto && setFilaSeleccionada(null)}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <DialogTitle className="text-base font-semibold">
                Fila N.º {filaSeleccionada?.numero_fila} — {filaSeleccionada?.tipo.replace(/_/g, " ")}
              </DialogTitle>
              {filaSeleccionada && <BadgeEstadoFila estado={filaSeleccionada.estado} />}
            </div>
            <DialogDescription className="text-xs">
              Detalle del análisis y valores leídos desde la hoja de cálculo.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <span className="text-xs font-semibold text-muted-foreground">Diagnóstico:</span>
              <p className="text-xs rounded-md bg-muted p-2.5 border">
                {filaSeleccionada?.detalle || "Registro validado sin errores."}
              </p>
            </div>

            {filaSeleccionada?.movimiento?.tipo ? (
              <div className="space-y-1">
                <span className="text-xs font-semibold text-muted-foreground">Movimiento de condición:</span>
                <ResumenMovimiento movimiento={filaSeleccionada.movimiento} />
                {filaSeleccionada.estado === "REQUIERE_CONFIRMACION" && !filaSeleccionada.confirmada && (
                  <Button
                    size="sm"
                    className="mt-2 h-8 text-xs"
                    onClick={() => {
                      setSeleccionadas(new Set([filaSeleccionada.id]));
                      setFilaSeleccionada(null);
                      setDialogoConfirmar(true);
                    }}
                  >
                    <ShieldCheck className="size-3.5 mr-1" />
                    Confirmar esta fila
                  </Button>
                )}
              </div>
            ) : null}

            <div className="space-y-1">
              <span className="text-xs font-semibold text-muted-foreground">Datos del Registro:</span>
              <ScrollArea className="max-h-56 rounded-md border p-2.5 bg-muted/40 font-mono text-xs">
                {filaSeleccionada && Object.keys(filaSeleccionada.datos).length > 0 ? (
                  <div className="space-y-1.5">
                    {Object.entries(filaSeleccionada.datos).map(([clave, valor]) => (
                      <div key={clave} className="flex justify-between border-b pb-1 last:border-0">
                        <span className="text-muted-foreground capitalize">{clave.replace(/_/g, " ")}:</span>
                        <span className="font-semibold text-foreground">{String(valor ?? "")}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <span className="text-muted-foreground">Sin datos registrados.</span>
                )}
              </ScrollArea>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Diálogo de confirmación del movimiento */}
      <Dialog open={dialogoConfirmar} onOpenChange={setDialogoConfirmar}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold flex items-center gap-2">
              <ShieldCheck className="size-5 text-amber-600" />
              Confirmar cambio de condición
            </DialogTitle>
            <DialogDescription className="text-xs">
              Revise el movimiento que se registrará. Sin esta confirmación la fila no se aplica.
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-80">
            <div className="space-y-2 py-1 pr-2">
              {seleccionadasDetalle.map((fila) => (
                <div key={fila.id} className="space-y-1">
                  <p className="text-xs font-semibold">
                    Fila {fila.numero_fila} — {fila.tipo.replace(/_/g, " ")}
                  </p>
                  {fila.movimiento ? (
                    <ResumenMovimiento movimiento={fila.movimiento} />
                  ) : (
                    <p className="text-xs text-rose-600">La fila no tiene datos de movimiento.</p>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDialogoConfirmar(false)}
              disabled={confirmando}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={confirmarSeleccionadas}
              disabled={
                confirmando ||
                seleccionadasDetalle.length === 0 ||
                seleccionadasDetalle.some((f) => !f.movimiento?.completo)
              }
            >
              {confirmando ? (
                <>
                  <Loader2 className="size-3.5 mr-1 animate-spin" />
                  Confirmando...
                </>
              ) : (
                <>
                  <ShieldCheck className="size-3.5 mr-1" />
                  Confirmar {seleccionadasDetalle.length} movimiento(s)
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
