"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  History,
  Loader2,
  Palette,
  PlusCircle,
  Search,
  Sparkles,
  Star,
  Trash2,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import type { PlantillaMotor, TipoCredencial } from "../../../domain/entities/carnet";
import { PlantillaMiniatura } from "./plantilla-miniatura";

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
  onDuplicarMotor: (plantilla: PlantillaMotor) => void;
  onEliminarMotor: (plantilla: PlantillaMotor) => void;
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
  onDuplicarMotor,
  onEliminarMotor,
}: PlantillasMotorGridProps) {
  const [busqueda, setBusqueda] = useState("");
  const [pagina, setPagina] = useState(1);
  const [porPagina] = useState(6);
  const [plantillaAEliminar, setPlantillaAEliminar] = useState<PlantillaMotor | null>(null);

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return plantillasMotor;
    return plantillasMotor.filter((p) =>
      `${p.nombre} ${p.codigo_tipo} ${p.estado} ${p.version}`.toLowerCase().includes(q),
    );
  }, [plantillasMotor, busqueda]);

  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / porPagina));
  const paginaActual = Math.min(pagina, totalPaginas);
  const inicio = (paginaActual - 1) * porPagina;
  const visibles = filtradas.slice(inicio, inicio + porPagina);

  const confirmarEliminacion = () => {
    if (!plantillaAEliminar) return;
    onEliminarMotor(plantillaAEliminar);
    setPlantillaAEliminar(null);
  };

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

      {/* Buscador de plantillas */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            value={busqueda}
            onChange={(e) => {
              setBusqueda(e.target.value);
              setPagina(1);
            }}
            placeholder="Buscar plantilla por nombre, tipo o versión…"
            className="pl-9 h-10 text-sm"
            aria-label="Buscar plantilla"
          />
        </div>
        <span className="text-xs text-muted-foreground">
          {filtradas.length} plantilla{filtradas.length === 1 ? "" : "s"}
          {busqueda.trim() ? " encontradas" : " registradas"}
        </span>
      </div>

      {/* Listado de Plantillas Motor */}
      {cargandoMotor ? (
        <div className="flex justify-center items-center py-20">
          <Loader2 className="size-8 animate-spin text-primary" />
        </div>
      ) : filtradas.length === 0 ? (
        <Card className="shadow-xs border border-dashed">
          <CardContent className="text-center py-12">
            <Palette className="size-12 mx-auto text-muted-foreground/40" />
            <h3 className="text-base font-semibold text-foreground mt-4">
              {busqueda.trim()
                ? "No hay plantillas que coincidan con la búsqueda"
                : "No hay plantillas registradas para este tipo"}
            </h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
              {busqueda.trim()
                ? "Pruebe con otro nombre, tipo o versión."
                : "Crea una nueva plantilla en borrador para configurar las dimensiones y capas oficiales."}
            </p>
            {!busqueda.trim() && (
              <Button onClick={onAbrirModalNuevo} className="mt-4 gap-2" variant="outline">
                <PlusCircle className="size-4" />
                Crear plantilla
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {visibles.map((p) => {
            const esActiva = p.activa;
            const esBorrador = p.estado === "borrador";
            return (
              <Card
                key={p.id}
                className={`flex min-w-0 flex-col justify-between border shadow-none transition-all ${
                  esActiva ? "border-primary/40 ring-2 ring-primary/20" : ""
                }`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-base font-semibold leading-tight line-clamp-1">
                        {p.nombre}
                      </CardTitle>
                      <CardDescription className="mt-1 text-xs">
                        Tipo: <span className="font-medium text-foreground">{p.codigo_tipo}</span>
                      </CardDescription>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Badge variant="secondary" className="tabular-nums text-xs">
                        v{p.version}
                      </Badge>
                      {esActiva ? (
                        <Badge className="gap-1 bg-primary text-primary-foreground">
                          <Star className="size-3 fill-current" aria-hidden />
                          Activa
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs text-muted-foreground">
                          Inactiva
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-3 pb-3 text-sm">
                  <div className="grid grid-cols-2 gap-2 rounded-lg border border-border bg-muted/30 p-2">
                    <div className="space-y-1">
                      <PlantillaMiniatura
                        definicion={p.definicion}
                        anchoMm={p.ancho_mm}
                        altoMm={p.alto_mm}
                        etiqueta={p.nombre}
                        cara="anverso"
                      />
                      <p className="text-center text-[11px] font-medium text-muted-foreground">
                        Anverso
                      </p>
                    </div>
                    <div className="space-y-1">
                      <PlantillaMiniatura
                        definicion={p.definicion}
                        anchoMm={p.ancho_mm}
                        altoMm={p.alto_mm}
                        etiqueta={p.nombre}
                        cara="reverso"
                      />
                      <p className="text-center text-[11px] font-medium text-muted-foreground">
                        Reverso
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 rounded-md border border-border bg-muted/30 p-2.5 text-xs">
                    <div>
                      <span className="block text-muted-foreground">Dimensiones</span>
                      <span className="font-semibold text-foreground">
                        {p.ancho_mm} × {p.alto_mm} mm
                      </span>
                    </div>
                    <div>
                      <span className="block text-muted-foreground">Orientación</span>
                      <span className="font-semibold capitalize text-foreground">
                        {p.orientacion}
                      </span>
                    </div>
                    <div>
                      <span className="block text-muted-foreground">Estado</span>
                      <span
                        className={`font-semibold capitalize ${
                          esBorrador ? "text-warning" : "text-success"
                        }`}
                      >
                        {p.estado}
                      </span>
                    </div>
                    <div>
                      <span className="block text-muted-foreground">Regla</span>
                      <span className="block truncate font-semibold text-foreground">
                        {p.regla_criterio}: {p.regla_valor}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 pt-1 text-xs text-muted-foreground">
                    <Clock className="size-3.5" aria-hidden />
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

                <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-border p-4 pt-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Button size="sm" variant="default" className="min-h-9 gap-1.5" asChild>
                      <Link href={`/carnetizacion/disenador?plantilla=${p.id}`}>
                        <Palette className="size-3.5" aria-hidden />
                        Editar
                      </Link>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="min-h-9 gap-1.5"
                      disabled={isPending}
                      onClick={() => onDuplicarMotor(p)}
                    >
                      <Copy className="size-3.5" aria-hidden />
                      Duplicar
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="min-h-9 gap-1.5 px-2 text-muted-foreground hover:text-foreground"
                      onClick={() => onAbrirHistorialVersiones(p)}
                      title="Historial de versiones"
                    >
                      <History className="size-3.5" aria-hidden />
                      <span className="sr-only">Historial</span>
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="min-h-9 gap-1.5 px-2 text-muted-foreground hover:text-destructive disabled:opacity-40"
                      disabled={isPending || esActiva}
                      onClick={() => setPlantillaAEliminar(p)}
                      title={
                        esActiva
                          ? "No se puede eliminar la plantilla activa"
                          : "Eliminar esta versión"
                      }
                    >
                      <Trash2 className="size-3.5" aria-hidden />
                      <span className="sr-only">Eliminar</span>
                    </Button>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {esBorrador && (
                      <Button
                        size="sm"
                        variant="secondary"
                        className="min-h-9 gap-1"
                        disabled={isPending}
                        onClick={() => onPublicarMotor(p.id, p.version)}
                      >
                        <Sparkles className="size-3.5" aria-hidden />
                        Publicar
                      </Button>
                    )}
                    {!esActiva && !esBorrador && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="min-h-9 gap-1 border-primary/40 text-primary hover:bg-secondary"
                        disabled={isPending}
                        onClick={() => onActivarMotor(p.id)}
                      >
                        <CheckCircle2 className="size-3.5" aria-hidden />
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

      {totalPaginas > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-border pt-4 text-xs text-muted-foreground">
          <span>
            Mostrando {filtradas.length ? inicio + 1 : 0}–
            {Math.min(inicio + porPagina, filtradas.length)} de {filtradas.length}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              className="h-8 px-2.5 text-xs"
              disabled={paginaActual <= 1}
              onClick={() => setPagina((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="size-3.5" />
              Anterior
            </Button>
            <span className="px-2 font-medium">
              {paginaActual} / {totalPaginas}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="h-8 px-2.5 text-xs"
              disabled={paginaActual >= totalPaginas}
              onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
            >
              Siguiente
              <ChevronRight className="size-3.5" />
            </Button>
          </div>
        </div>
      )}

      <AlertDialog
        open={!!plantillaAEliminar}
        onOpenChange={(open) => !open && setPlantillaAEliminar(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar esta plantilla?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará «{plantillaAEliminar?.nombre}» v{plantillaAEliminar?.version}.
              Esta acción no se puede deshacer. La plantilla activa está protegida.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmarEliminacion}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
