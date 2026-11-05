"use client";

import { ContadorCaracteres } from "@/components/contador-caracteres";
import { LIMITES_TEXTO } from "@/shared/validation/limites-texto";
import React, { useState, useTransition } from "react";
import useSWR from "swr";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Filter,
  Loader2,
  RefreshCw,
  Search,
  UserCheck,
} from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/components/card";
import { Badge } from "@/shared/ui/components/badge";
import { Button } from "@/shared/ui/components/button";
import { Input } from "@/shared/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/components/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/components/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/components/dialog";
import { Label } from "@/shared/ui/components/label";
import { Textarea } from "@/shared/ui/components/textarea";
import { VistaCargando, VistaError } from "@/shared/ui/components/vista-estados";
import { formatearFecha } from "@/shared/lib/formato-fecha";
import {
  atenderReporteErrorLaboralAction,
  getReportesErrorLaboralAction,
} from "../../infrastructure/actions/personal-actions";
import type { ReporteErrorLaboralApiItem } from "../../infrastructure/http/personal-api";

const ETIQUETAS_DATO: Record<string, string> = {
  cargo: "Cargo",
  oficina: "Oficina / Gerencia",
  fecha_ingreso: "Fecha de ingreso",
  otro: "Otro dato laboral",
};

export function ReportesErrorLaboralPageView() {
  const [filtroEstado, setFiltroEstado] = useState<string>("TODOS");
  const [filtroDato, setFiltroDato] = useState<string>("TODOS");
  const [busqueda, setBusqueda] = useState<string>("");

  const [reporteAAtender, setReporteAAtender] = useState<ReporteErrorLaboralApiItem | null>(null);
  const [observacionesAtencion, setObservacionesAtencion] = useState<string>("");
  const [guardandoAtencion, startTransition] = useTransition();
  const [feedbackAtencion, setFeedbackAtencion] = useState<string | null>(null);

  const { data, error, isLoading, mutate } = useSWR(
    ["reportes-error-laboral", filtroEstado, filtroDato],
    () =>
      getReportesErrorLaboralAction({
        estado: filtroEstado !== "TODOS" ? filtroEstado : undefined,
        dato: filtroDato !== "TODOS" ? filtroDato : undefined,
      }),
  );

  const items = (data ?? []).filter((r) => {
    if (!busqueda.trim()) return true;
    const q = busqueda.toLowerCase().trim();
    return (
      r.trabajador_cedula.toLowerCase().includes(q) ||
      r.trabajador_nombre.toLowerCase().includes(q) ||
      r.descripcion.toLowerCase().includes(q)
    );
  });

  const handleAbrirAtender = (reporte: ReporteErrorLaboralApiItem) => {
    setReporteAAtender(reporte);
    setObservacionesAtencion("");
    setFeedbackAtencion(null);
  };

  const largoAtencion = observacionesAtencion.trim().length;
  const errorAtencion =
    largoAtencion > 0 && largoAtencion < LIMITES_TEXTO.observacion.min
      ? `La observación debe tener al menos ${LIMITES_TEXTO.observacion.min} caracteres`
      : null;

  const handleConfirmarAtender = () => {
    if (!reporteAAtender || errorAtencion) return;
    startTransition(async () => {
      const res = await atenderReporteErrorLaboralAction(
        reporteAAtender.id,
        observacionesAtencion.trim() || undefined,
      );
      if (res.success) {
        setReporteAAtender(null);
        mutate();
      } else {
        setFeedbackAtencion(res.error ?? "No se pudo marcar como atendido.");
      }
    });
  };

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <AlertCircle className="w-6 h-6 text-amber-600" />
            Reportes de Error en Datos Laborales
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Bandeja de incidencias reportadas por los trabajadores desde su ficha de autogestión.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => mutate()}
          disabled={isLoading}
          className="gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          Actualizar
        </Button>
      </div>

      {/* Filtros */}
      <Card className="border-border/60 shadow-sm">
        <CardContent className="pt-4 pb-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Búsqueda rápida</Label>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Cédula, nombre o descripción…"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  className="pl-9 h-9"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Estado</Label>
              <Select value={filtroEstado} onValueChange={setFiltroEstado}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Estado..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TODOS">Todos los estados</SelectItem>
                  <SelectItem value="PENDIENTE">Pendientes</SelectItem>
                  <SelectItem value="ATENDIDO">Atendidos</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Dato reportado</Label>
              <Select value={filtroDato} onValueChange={setFiltroDato}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Campo..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TODOS">Todos los campos</SelectItem>
                  <SelectItem value="cargo">Cargo</SelectItem>
                  <SelectItem value="oficina">Oficina / Gerencia</SelectItem>
                  <SelectItem value="fecha_ingreso">Fecha de ingreso</SelectItem>
                  <SelectItem value="otro">Otro dato laboral</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contenido / Listado */}
      <Card className="border-border/60 shadow-sm">
        <CardHeader className="pb-3 border-b bg-muted/20">
          <CardTitle className="text-base font-semibold">
            Listado de Reportes ({items.length})
          </CardTitle>
          <CardDescription className="text-xs">
            Revise los casos y actualice el expediente maestro en Talento Humano si corresponde.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8">
              <VistaCargando mensaje="Cargando reportes de error…" />
            </div>
          ) : error ? (
            <div className="p-8">
              <VistaError
                mensaje="No se pudieron cargar los reportes de error laboral."
                onReintentar={() => mutate()}
              />
            </div>
          ) : items.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <CheckCircle2 className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
              <p className="text-sm font-medium">No se encontraron reportes con los filtros seleccionados.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-32">Fecha</TableHead>
                    <TableHead className="w-48">Trabajador</TableHead>
                    <TableHead className="w-36">Dato</TableHead>
                    <TableHead>Descripción de la discrepancia</TableHead>
                    <TableHead className="w-28 text-center">Estado</TableHead>
                    <TableHead className="w-48">Atención</TableHead>
                    <TableHead className="w-28 text-right">Acción</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((r) => {
                    const esPendiente = r.estado === "PENDIENTE";
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatearFecha(r.creado_el)}
                        </TableCell>
                        <TableCell className="font-medium">
                          <div>{r.trabajador_nombre || "—"}</div>
                          <div className="text-xs text-muted-foreground">
                            C.I. {r.trabajador_cedula}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-normal text-xs">
                            {ETIQUETAS_DATO[r.dato] ?? r.dato}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm max-w-md">
                          <p className="line-clamp-3 text-muted-foreground">{r.descripcion}</p>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge
                            className={
                              esPendiente
                                ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-300"
                                : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300"
                            }
                            variant="outline"
                          >
                            {esPendiente ? (
                              <Clock className="w-3 h-3 mr-1" />
                            ) : (
                              <CheckCircle2 className="w-3 h-3 mr-1" />
                            )}
                            {r.estado}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">
                          {r.atendido_por_cedula ? (
                            <div>
                              <div className="font-medium text-foreground">
                                {r.atendido_por_nombre || `C.I. ${r.atendido_por_cedula}`}
                              </div>
                              <div className="text-muted-foreground">
                                {r.atendido_el ? formatearFecha(r.atendido_el) : ""}
                              </div>
                              {r.observacion_atencion && (
                                <div className="text-muted-foreground/80 italic mt-0.5 line-clamp-2">
                                  «{r.observacion_atencion}»
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground/60">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {esPendiente ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleAbrirAtender(r)}
                              className="gap-1.5 text-xs text-indigo-600 hover:text-indigo-700"
                            >
                              <UserCheck className="w-3.5 h-3.5" />
                              Atender
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground/60">Atendido</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Diálogo para marcar como atendido */}
      <Dialog
        open={!!reporteAAtender}
        onOpenChange={(open) => {
          if (!open) setReporteAAtender(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-indigo-600" />
              Marcar reporte como atendido
            </DialogTitle>
            <DialogDescription>
              Confirme que ha revisado la discrepancia reportada por el trabajador{" "}
              <strong>{reporteAAtender?.trabajador_nombre}</strong> (C.I.{" "}
              {reporteAAtender?.trabajador_cedula}).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="bg-muted/40 p-3 rounded-lg text-xs space-y-1">
              <div>
                <span className="font-semibold text-foreground">Dato:</span>{" "}
                {reporteAAtender ? ETIQUETAS_DATO[reporteAAtender.dato] ?? reporteAAtender.dato : ""}
              </div>
              <div>
                <span className="font-semibold text-foreground">Descripción del trabajador:</span>{" "}
                <span className="text-muted-foreground">{reporteAAtender?.descripcion}</span>
              </div>
            </div>

            {feedbackAtencion && (
              <div className="text-xs text-destructive bg-destructive/10 p-2 rounded">
                {feedbackAtencion}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="obs-atencion">Observación o acción tomada (opcional)</Label>
              <Textarea
                id="obs-atencion"
                placeholder="Ej. Se corrigió el cargo en la asignación correspondiente según nombramiento."
                rows={3}
                value={observacionesAtencion}
                onChange={(e) => setObservacionesAtencion(e.target.value)}
                disabled={guardandoAtencion}
                maxLength={LIMITES_TEXTO.observacion.max}
                className="resize-none"
                aria-invalid={errorAtencion ? true : undefined}
              />
              <ContadorCaracteres valor={observacionesAtencion} max={LIMITES_TEXTO.observacion.max} />
              {errorAtencion ? (
                <p role="alert" className="text-sm font-medium text-destructive">
                  {errorAtencion}
                </p>
              ) : null}
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setReporteAAtender(null)}
              disabled={guardandoAtencion}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleConfirmarAtender}
              disabled={guardandoAtencion}
              className="gap-2"
            >
              {guardandoAtencion ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Guardando…
                </>
              ) : (
                "Marcar como Atendido"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
