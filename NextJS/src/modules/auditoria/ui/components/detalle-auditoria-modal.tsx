"use client";

import React from "react";
import useSWR from "swr";
import {
  Calendar,
  CheckCircle2,
  Clock,
  Globe,
  Laptop,
  Layers,
  Shield,
  User,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { DetalleAuditoriaDTO } from "../../application/dtos/auditoria-dto";
import { obtenerDetalleAuditoriaAction } from "../../infrastructure/actions/auditoria-actions";
import {
  NOMBRES_MODULOS,
  obtenerEtiquetaAccion,
  obtenerSeveridadAccion,
} from "../../domain/value-objects/catalogo-acciones";
import { ETIQUETA_RESULTADO } from "../../domain/value-objects/permisos-auditoria";

interface DetalleAuditoriaModalProps {
  id: string | null;
  onCerrar: () => void;
  onRefrescar?: () => void;
}

function esError(valor: unknown): valor is { error: string } {
  return !!valor && typeof valor === "object" && "error" in valor;
}

function formatearFechaCompleta(iso: string): string {
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return iso;
  return new Intl.DateTimeFormat("es-VE", {
    dateStyle: "full",
    timeStyle: "medium",
  }).format(fecha);
}

function formatearValor(valor: unknown): React.ReactNode {
  if (valor === null || valor === undefined || valor === "") {
    return <span className="text-muted-foreground italic">—</span>;
  }
  if (typeof valor === "boolean") {
    return valor ? (
      <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300">
        Sí
      </Badge>
    ) : (
      <Badge variant="outline" className="bg-muted text-muted-foreground">
        No
      </Badge>
    );
  }
  if (Array.isArray(valor)) {
    if (valor.length === 0) return <span className="text-muted-foreground italic">Vacío</span>;
    return (
      <ul className="list-disc list-inside text-xs space-y-0.5">
        {valor.map((item, idx) => (
          <li key={idx}>{String(item)}</li>
        ))}
      </ul>
    );
  }
  if (typeof valor === "object") {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 p-2 bg-muted/40 rounded border text-xs">
        {Object.entries(valor as Record<string, unknown>).map(([k, v]) => (
          <div key={k} className="flex flex-col">
            <span className="font-medium text-foreground/80 capitalize">{k.replace(/_/g, " ")}:</span>
            <span>{typeof v === "object" ? JSON.stringify(v) : String(v ?? "—")}</span>
          </div>
        ))}
      </div>
    );
  }
  return String(valor);
}

export function DetalleAuditoriaModal({
  id,
  onCerrar,
  onRefrescar,
}: DetalleAuditoriaModalProps) {
  const { data, isLoading } = useSWR(
    id ? ["auditoria-detalle", id] : null,
    () => obtenerDetalleAuditoriaAction(id as string),
  );

  const detalle = data && !esError(data) ? (data as DetalleAuditoriaDTO) : null;
  const etiquetaAccion = detalle ? obtenerEtiquetaAccion(detalle.accion) : "";
  const severidad = detalle ? obtenerSeveridadAccion(detalle.accion) : "consulta";

  const colorBadgeSeveridad = {
    creacion: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300",
    actualizacion: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300",
    aprobacion: "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/40 dark:text-teal-300",
    advertencia: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300",
    peligro: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300",
    consulta: "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-900/50 dark:text-slate-300",
  }[severidad];

  return (
    <Dialog
      open={id !== null}
      onOpenChange={(abierto) => {
        if (!abierto) {
          onCerrar();
          onRefrescar?.();
        }
      }}
    >
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto p-6 gap-6">
        <DialogHeader className="space-y-1.5 border-b pb-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <DialogTitle className="text-xl font-semibold tracking-tight">
              Detalle del Registro de Auditoría
            </DialogTitle>
            {detalle && (
              <Badge
                variant={detalle.resultado === "SUCCESS" ? "default" : "destructive"}
                className="gap-1 px-2.5 py-0.5 text-xs font-semibold"
              >
                {detalle.resultado === "SUCCESS" ? (
                  <CheckCircle2 className="size-3.5" aria-hidden="true" />
                ) : (
                  <XCircle className="size-3.5" aria-hidden="true" />
                )}
                {ETIQUETA_RESULTADO[detalle.resultado] ?? detalle.resultado}
              </Badge>
            )}
          </div>
          <DialogDescription className="text-sm text-muted-foreground">
            Trazabilidad del evento, actor responsable y diferencias de estado registradas.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        ) : !detalle ? (
          <p role="alert" className="text-sm text-destructive py-6 text-center">
            No fue posible cargar el detalle del evento seleccionado.
          </p>
        ) : (
          <div className="space-y-6">
            {/* Tarjeta de Metadatos del Evento */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-4 rounded-lg bg-muted/30 border border-border/70 text-sm">
              <div className="space-y-1">
                <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Shield className="size-3.5 text-primary" aria-hidden="true" /> Acción ejecutada
                </span>
                <div>
                  <Badge variant="outline" className={`font-medium ${colorBadgeSeveridad}`}>
                    {etiquetaAccion}
                  </Badge>
                  <p className="text-[11px] font-mono text-muted-foreground mt-0.5">
                    {detalle.accion}
                  </p>
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Layers className="size-3.5 text-primary" aria-hidden="true" /> Módulo y Recurso
                </span>
                <p className="font-medium text-foreground">
                  {NOMBRES_MODULOS[detalle.modulo] || detalle.modulo}
                </p>
                <p className="text-xs text-muted-foreground truncate" title={detalle.recursoTipo}>
                  {detalle.recursoTipo
                    ? `${detalle.recursoTipo}${detalle.recursoId ? ` #${detalle.recursoId}` : ""}`
                    : "—"}
                </p>
              </div>

              <div className="space-y-1">
                <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Clock className="size-3.5 text-primary" aria-hidden="true" /> Fecha y Hora
                </span>
                <p className="font-medium text-foreground text-xs leading-relaxed">
                  {formatearFechaCompleta(detalle.fechaHora)}
                </p>
              </div>

              <div className="space-y-1">
                <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <User className="size-3.5 text-primary" aria-hidden="true" /> Usuario / Actor
                </span>
                <p className="font-semibold text-foreground">
                  {detalle.actorCedula || "—"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {detalle.actorNombre || "Sin nombre registrado"}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Rol: {detalle.actorRolVisible || detalle.actorRol || "—"}
                </p>
              </div>

              <div className="space-y-1">
                <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Globe className="size-3.5 text-primary" aria-hidden="true" /> Origen IP
                </span>
                <p className="font-mono text-sm">{detalle.ip || "—"}</p>
              </div>

              <div className="space-y-1">
                <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Laptop className="size-3.5 text-primary" aria-hidden="true" /> Dispositivo
                </span>
                <p className="text-xs text-muted-foreground truncate" title={detalle.userAgent || "—"}>
                  {detalle.userAgent || "—"}
                </p>
              </div>
            </div>

            {/* Sección de Diferencias de Estado */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold tracking-tight text-foreground flex items-center gap-2">
                <span>Cambios en el estado de los datos</span>
                <Badge variant="secondary" className="text-xs">
                  {detalle.diferencias.length} campo(s) modificado(s)
                </Badge>
              </h4>

              {detalle.diferencias.length > 0 ? (
                <div className="rounded-md border border-border/70 overflow-hidden">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead className="w-[30%] font-semibold text-foreground">Campo</TableHead>
                        <TableHead className="w-[35%] font-semibold text-foreground">Valor Previo</TableHead>
                        <TableHead className="w-[35%] font-semibold text-foreground">Valor Nuevo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detalle.diferencias.map((dif) => (
                        <TableRow key={dif.campo} className="hover:bg-muted/20">
                          <TableCell className="font-mono text-xs font-semibold text-foreground/90 align-top">
                            {dif.campo}
                          </TableCell>
                          <TableCell className="text-xs bg-rose-50/40 dark:bg-rose-950/20 text-rose-900 dark:text-rose-200 align-top">
                            {formatearValor(dif.antes)}
                          </TableCell>
                          <TableCell className="text-xs bg-emerald-50/40 dark:bg-emerald-950/20 text-emerald-900 dark:text-emerald-200 align-top font-medium">
                            {formatearValor(dif.despues)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="rounded-md border border-dashed border-border/80 p-4 text-center">
                  <p className="text-sm text-muted-foreground">
                    Esta acción no generó diferencias de estado o consistió en una operación de solo lectura.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="flex justify-end pt-2 border-t">
          <Button type="button" variant="outline" onClick={onCerrar}>
            Cerrar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
