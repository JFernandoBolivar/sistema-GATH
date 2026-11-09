"use client";

import Link from "next/link";
import { CheckCircle2, Clock, History, Loader2, Palette, PlusCircle, Sparkles, Star } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { PlantillaMotor, TipoCredencial } from "../../../domain/entities/carnet";

interface PlantillasMotorGridProps {
  tipoActivo: string;
  onCambiarTipoActivo: (tipo: string) => void;
  tiposCredencial: TipoCredencial[];
  plantillasMotor: PlantillaMotor[];
  cargandoMotor: boolean;
  isPending: boolean;
  onAbrirModalNuevo: () => void;
  onAbrirHistorialVersiones: (plantilla: PlantillaMotor) => void;
  onPublicarMotor: (id: string, version: number) => void;
  onActivarMotor: (id: string) => void;
}

export function PlantillasMotorGrid({
  tipoActivo,
  onCambiarTipoActivo,
  tiposCredencial,
  plantillasMotor,
  cargandoMotor,
  isPending,
  onAbrirModalNuevo,
  onAbrirHistorialVersiones,
  onPublicarMotor,
  onActivarMotor,
}: PlantillasMotorGridProps) {
  return (
    <div className="space-y-6">
      {/* Selector de Tipo de Credencial */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-lg border bg-card shadow-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground mr-1">
            Tipo de Credencial:
          </span>
          {tiposCredencial.length === 0 ? (
            <>
              <Button
                variant={tipoActivo === "trabajador" ? "default" : "outline"}
                size="sm"
                onClick={() => onCambiarTipoActivo("trabajador")}
              >
                Trabajador Activo
              </Button>
              <Button
                variant={tipoActivo === "pasivo" ? "default" : "outline"}
                size="sm"
                onClick={() => onCambiarTipoActivo("pasivo")}
              >
                Pasivo / Jubilado
              </Button>
            </>
          ) : (
            tiposCredencial.map((t) => (
              <Button
                key={t.codigo}
                variant={tipoActivo === t.codigo ? "default" : "outline"}
                size="sm"
                onClick={() => onCambiarTipoActivo(t.codigo)}
              >
                {t.nombre}
              </Button>
            ))
          )}
        </div>

        <Button onClick={onAbrirModalNuevo} className="gap-2 shrink-0" size="sm">
          <PlusCircle className="size-4" />
          Nueva Plantilla
        </Button>
      </div>

      {/* Listado de Plantillas Motor */}
      {cargandoMotor ? (
        <div className="flex justify-center items-center py-20">
          <Loader2 className="size-8 animate-spin text-primary" />
        </div>
      ) : plantillasMotor.length === 0 ? (
        <Card className="shadow-xs border border-dashed">
          <CardContent className="text-center py-12">
            <Palette className="size-12 mx-auto text-muted-foreground/40" />
            <h3 className="text-base font-semibold text-foreground mt-4">
              No hay plantillas registradas para este tipo
            </h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
              Crea una nueva plantilla en borrador para configurar las dimensiones y capas oficiales.
            </p>
            <Button onClick={onAbrirModalNuevo} className="mt-4 gap-2" variant="outline">
              <PlusCircle className="size-4" />
              Crear plantilla
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {plantillasMotor.map((p) => {
            const esActiva = p.activa;
            const esBorrador = p.estado === "borrador";
            return (
              <Card
                key={p.id}
                className={`flex flex-col justify-between transition-all shadow-xs border ${
                  esActiva ? "ring-2 ring-emerald-500 border-emerald-300 bg-emerald-50/10" : ""
                }`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-base font-semibold leading-tight line-clamp-1">
                        {p.nombre}
                      </CardTitle>
                      <CardDescription className="text-xs mt-1">
                        Tipo: <span className="font-medium text-foreground">{p.codigo_tipo}</span>
                      </CardDescription>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Badge variant="secondary" className="font-mono text-xs">
                        v{p.version}
                      </Badge>
                      {esActiva ? (
                        <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1">
                          <Star className="size-3 fill-current" />
                          Activa
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground text-xs">
                          Inactiva
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-3 pb-3 text-sm">
                  <div className="grid grid-cols-2 gap-2 p-2.5 rounded-md bg-muted/30 border text-xs">
                    <div>
                      <span className="text-muted-foreground block">Dimensiones</span>
                      <span className="font-semibold text-foreground">
                        {p.ancho_mm} × {p.alto_mm} mm
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">Orientación</span>
                      <span className="font-semibold capitalize text-foreground">
                        {p.orientacion}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">Estado</span>
                      <span
                        className={`font-semibold capitalize ${
                          esBorrador ? "text-amber-600" : "text-emerald-700"
                        }`}
                      >
                        {p.estado}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">Regla</span>
                      <span className="font-semibold text-foreground truncate block">
                        {p.regla_criterio}: {p.regla_valor}
                      </span>
                    </div>
                  </div>

                  <div className="text-xs text-muted-foreground flex items-center gap-1.5 pt-1">
                    <Clock className="size-3.5" />
                    <span>
                      Modificado:{" "}
                      {new Date(p.actualizado || p.creado).toLocaleDateString("es-ES", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                </CardContent>

                <div className="p-4 pt-0 mt-auto flex items-center justify-between gap-2 border-t pt-3">
                  <div className="flex items-center gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs h-8 gap-1.5 border-primary/30 text-primary hover:bg-primary/5"
                      asChild
                    >
                      <Link href={`/carnetizacion/disenador?plantilla=${p.id}`}>
                        <Palette className="size-3.5" />
                        Diseñar
                      </Link>
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-xs h-8 gap-1.5 px-2 text-muted-foreground hover:text-foreground"
                      onClick={() => onAbrirHistorialVersiones(p)}
                    >
                      <History className="size-3.5" />
                      Historial
                    </Button>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {esBorrador && (
                      <Button
                        size="sm"
                        variant="secondary"
                        className="text-xs h-8 gap-1"
                        disabled={isPending}
                        onClick={() => onPublicarMotor(p.id, p.version)}
                      >
                        <Sparkles className="size-3.5" />
                        Publicar
                      </Button>
                    )}
                    {!esActiva && !esBorrador && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs h-8 gap-1 border-emerald-500/40 text-emerald-700 hover:bg-emerald-50"
                        disabled={isPending}
                        onClick={() => onActivarMotor(p.id)}
                      >
                        <CheckCircle2 className="size-3.5" />
                        Activar
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
