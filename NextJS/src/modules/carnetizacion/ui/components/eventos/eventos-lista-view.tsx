"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  MapPin,
  Plus,
  QrCode,
  Users,
} from "lucide-react";

import { Badge } from "@/shared/ui/components/badge";
import { Button } from "@/shared/ui/components/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/shared/ui/components/card";
import { BarraFiltros, type FiltroActivoChip } from "@/shared/ui/components/barra-filtros";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/components/select";
import { cn } from "@/lib/utils";
import { getEventosAction } from "@/modules/carnetizacion/infrastructure/actions/eventos-actions";
import type { Evento } from "@/modules/carnetizacion/domain/entities/evento";
import { EventoCrearDialog } from "./evento-crear-dialog";

const ETIQUETAS_ESTADO: Record<string, string> = {
  activo: "En curso",
  borrador: "Borrador",
  finalizado: "Finalizado",
  cancelado: "Cancelado",
};

function estiloEstado(estado: string): string {
  if (estado === "activo") return "border-success/30 bg-success-soft text-success";
  if (estado === "cancelado") return "border-danger/30 bg-danger-soft text-danger";
  if (estado === "borrador") return "border-warning/30 bg-warning-soft text-warning";
  return "border-border bg-muted text-muted-foreground";
}

function acentoEstado(estado: string): string {
  if (estado === "activo") return "bg-success";
  if (estado === "cancelado") return "bg-danger";
  if (estado === "borrador") return "bg-warning";
  return "bg-border";
}

function formatearFecha(iso?: string): string {
  if (!iso) return "Sin fecha";
  return new Date(iso).toLocaleDateString("es-VE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function Metrica({
  icono: Icono,
  etiqueta,
  valor,
  detalle,
  tono,
}: {
  icono: typeof Users;
  etiqueta: string;
  valor: number;
  detalle: string;
  tono: string;
}) {
  return (
    <Card className="border-border/60 shadow-none">
      <CardContent className="flex items-center gap-3 p-4">
        <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-xl", tono)}>
          <Icono className="size-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">{etiqueta}</p>
          <p className="text-2xl font-bold leading-tight tabular-nums text-foreground">{valor}</p>
          <p className="truncate text-[11px] text-muted-foreground">{detalle}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export function EventosListaView() {
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState("TODOS");
  const [openCrear, setOpenCrear] = useState(false);
  const [isPending, startTransition] = useTransition();

  const cargarEventos = () => {
    startTransition(async () => {
      try {
        const data = await getEventosAction();
        setEventos(data);
      } catch (err) {
        console.error("Error cargando eventos:", err);
      }
    });
  };

  useEffect(() => {
    cargarEventos();
  }, []);

  const metricas = useMemo(() => {
    const totalInvitados = eventos.reduce((total, ev) => total + (ev.total_invitados ?? 0), 0);
    const totalIngresos = eventos.reduce((total, ev) => total + (ev.total_entraron ?? 0), 0);
    return {
      total: eventos.length,
      activos: eventos.filter((ev) => ev.estado === "activo").length,
      invitados: totalInvitados,
      ingresos: totalIngresos,
    };
  }, [eventos]);

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return eventos.filter((ev) => {
      if (estadoFiltro !== "TODOS" && ev.estado !== estadoFiltro) return false;
      if (!q) return true;
      return (
        ev.nombre.toLowerCase().includes(q) ||
        (ev.lugar ?? "").toLowerCase().includes(q) ||
        (ev.descripcion ?? "").toLowerCase().includes(q)
      );
    });
  }, [eventos, busqueda, estadoFiltro]);

  const chipsActivos = useMemo<FiltroActivoChip[]>(() => {
    const chips: FiltroActivoChip[] = [];
    if (busqueda.trim()) {
      chips.push({
        id: "busqueda",
        label: "Búsqueda",
        valorLegible: busqueda,
        onRemover: () => setBusqueda(""),
      });
    }
    if (estadoFiltro !== "TODOS") {
      chips.push({
        id: "estado",
        label: "Estado",
        valorLegible: ETIQUETAS_ESTADO[estadoFiltro] ?? estadoFiltro,
        onRemover: () => setEstadoFiltro("TODOS"),
      });
    }
    return chips;
  }, [busqueda, estadoFiltro]);

  const hayFiltros = chipsActivos.length > 0;

  return (
    <div className="space-y-6">
      {/* Resumen operativo */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metrica
          icono={CalendarDays}
          etiqueta="Eventos"
          valor={metricas.total}
          detalle="Registrados en el sistema"
          tono="bg-secondary text-primary"
        />
        <Metrica
          icono={Clock3}
          etiqueta="En curso"
          valor={metricas.activos}
          detalle="Con control de acceso abierto"
          tono="bg-success-soft text-success"
        />
        <Metrica
          icono={Users}
          etiqueta="Invitados"
          valor={metricas.invitados}
          detalle="Nómina acumulada"
          tono="bg-info-soft text-info"
        />
        <Metrica
          icono={QrCode}
          etiqueta="Ingresos"
          valor={metricas.ingresos}
          detalle="Check-in QR registrados"
          tono="bg-warning-soft text-warning"
        />
      </div>

      {/* Búsqueda y filtros */}
      <BarraFiltros
        busqueda={busqueda}
        onBusquedaChange={setBusqueda}
        placeholderBusqueda="Buscar por evento, lugar o descripción…"
        totalResultados={filtrados.length}
        etiquetaResultados="eventos"
        hayFiltrosActivos={hayFiltros}
        onLimpiarFiltros={() => {
          setBusqueda("");
          setEstadoFiltro("TODOS");
        }}
        chipsActivos={chipsActivos}
        tituloFiltrosMovil="Filtros de eventos"
      >
        <div className="flex min-w-0 flex-col gap-1.5">
          <span className="text-sm font-medium text-foreground">Estado del evento</span>
          <Select
            value={estadoFiltro}
            onValueChange={setEstadoFiltro}
          >
            <SelectTrigger className="h-11 w-full min-w-0 text-sm" aria-label="Estado del evento">
              <SelectValue placeholder="Todos los estados" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="TODOS">Todos los estados</SelectItem>
              <SelectItem value="activo">En curso</SelectItem>
              <SelectItem value="borrador">Borrador</SelectItem>
              <SelectItem value="finalizado">Finalizado</SelectItem>
              <SelectItem value="cancelado">Cancelado</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex min-w-0 flex-col gap-1.5">
          <span className="text-sm font-medium text-foreground">Acción rápida</span>
          <Button
            onClick={() => setOpenCrear(true)}
            className="h-11 gap-2 text-sm font-semibold"
          >
            <Plus className="size-4" aria-hidden />
            Nuevo Evento
          </Button>
        </div>
      </BarraFiltros>

      {/* Listado */}
      {isPending && eventos.length === 0 ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Card key={i} className="h-72 animate-pulse border-border/60 bg-muted/30" />
          ))}
        </div>
      ) : filtrados.length === 0 ? (
        <Card className="border-dashed border-border/80 bg-card">
          <CardContent className="flex flex-col items-center py-14 text-center">
            <span className="flex size-14 items-center justify-center rounded-full bg-secondary text-primary">
              <CalendarDays className="size-7" aria-hidden />
            </span>
            <h3 className="mt-4 text-lg font-semibold text-foreground">
              {hayFiltros ? "No hay eventos que coincidan con los filtros" : "Aún no hay eventos registrados"}
            </h3>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              {hayFiltros
                ? "Ajuste la búsqueda o el estado para volver a ver la lista completa."
                : "Cree un evento para gestionar invitados, gafetes y control de acceso con QR."}
            </p>
            <Button className="mt-5 gap-2" onClick={() => setOpenCrear(true)}>
              <Plus className="size-4" aria-hidden />
              Crear evento
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          {filtrados.map((ev) => {
            const total = ev.total_invitados ?? 0;
            const ingresos = ev.total_entraron ?? 0;
            const asistencia = total > 0 ? Math.min(100, Math.round((ingresos / total) * 100)) : 0;
            const esActivo = ev.estado === "activo";

            return (
              <Card
                key={ev.id}
                className={cn(
                  "group relative flex flex-col overflow-hidden border-border/60 shadow-none transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md",
                  esActivo && "border-primary/30 ring-1 ring-primary/10",
                )}
              >
                <span className={cn("absolute inset-y-0 left-0 w-1", acentoEstado(ev.estado))} />

                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <Badge
                        variant="outline"
                        className={cn("gap-1.5 text-[10px] font-bold uppercase", estiloEstado(ev.estado))}
                      >
                        <span className={cn("size-1.5 rounded-full", acentoEstado(ev.estado))} />
                        {ETIQUETAS_ESTADO[ev.estado] ?? ev.estado}
                      </Badge>
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
                        <CalendarDays className="size-3" aria-hidden />
                        {formatearFecha(ev.fecha_inicio)}
                      </span>
                    </div>
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary">
                      <CalendarDays className="size-5" aria-hidden />
                    </span>
                  </div>

                  <CardTitle className="mt-3 line-clamp-1 text-lg font-bold text-foreground">
                    {ev.nombre}
                  </CardTitle>
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <MapPin className="size-3.5 shrink-0" aria-hidden />
                    <span className="truncate">{ev.lugar || "Sede CONATEL"}</span>
                  </p>
                </CardHeader>

                <CardContent className="space-y-4 pb-4">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-lg border border-border/50 bg-muted/30 p-2.5">
                      <span className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
                        <Users className="size-3" aria-hidden />
                        Invitados
                      </span>
                      <span className="mt-0.5 block text-xl font-bold tabular-nums text-foreground">
                        {total}
                      </span>
                    </div>
                    <div className="rounded-lg border border-border/50 bg-muted/30 p-2.5">
                      <span className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
                        <CheckCircle2 className="size-3 text-success" aria-hidden />
                        Ingresaron
                      </span>
                      <span className="mt-0.5 block text-xl font-bold tabular-nums text-success">
                        {ingresos}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] font-medium">
                      <span className="text-muted-foreground">Asistencia</span>
                      <span className="tabular-nums text-foreground">{asistencia}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${asistencia}%` }}
                      />
                    </div>
                  </div>
                </CardContent>

                <CardFooter className="mt-auto flex items-center justify-between gap-2 border-t border-border/50 pt-3">
                  <Link
                    href={`/carnetizacion/control-eventos?evento_id=${ev.id}`}
                    className="inline-flex"
                  >
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 gap-1.5 text-xs font-semibold text-success border-success/30 hover:bg-success-soft"
                    >
                      <QrCode className="size-3.5" aria-hidden />
                      Check-in QR
                    </Button>
                  </Link>

                  <Link href={`/carnetizacion/eventos/${ev.id}`} className="inline-flex">
                    <Button size="sm" className="h-9 gap-1.5 text-xs font-semibold">
                      Ver hub
                      <ArrowRight className="size-3.5" aria-hidden />
                    </Button>
                  </Link>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}

      <EventoCrearDialog
        open={openCrear}
        onOpenChange={setOpenCrear}
        onEventoCreado={() => cargarEventos()}
      />
    </div>
  );
}
