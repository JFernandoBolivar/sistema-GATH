"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Calendar,
  CheckCircle2,
  MapPin,
  Plus,
  QrCode,
  Search,
  Users,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/shared/ui/components/card";
import { Button } from "@/shared/ui/components/button";
import { Badge } from "@/shared/ui/components/badge";
import { Input } from "@/shared/ui/components/input";
import { getEventosAction } from "@/modules/carnetizacion/infrastructure/actions/eventos-actions";
import type { Evento } from "@/modules/carnetizacion/domain/entities/evento";
import { EventoCrearDialog } from "./evento-crear-dialog";

export function EventosListaView() {
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [busqueda, setBusqueda] = useState("");
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

  const eventosFiltrados = eventos.filter((ev) => {
    return (
      !busqueda ||
      ev.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      ev.lugar.toLowerCase().includes(busqueda.toLowerCase())
    );
  });

  return (
    <div className="space-y-6">
      {/* Barra de Acciones y Búsqueda */}
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Buscar evento por nombre o lugar..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="pl-9 h-10 text-sm bg-background border-input"
          />
        </div>

        <Button onClick={() => setOpenCrear(true)} className="min-h-11 font-semibold text-xs px-4">
          <Plus className="size-4 mr-1.5" />
          Nuevo Evento
        </Button>
      </div>

      {/* Listado de Tarjetas de Eventos */}
      {isPending && eventos.length === 0 ? (
        <div className="p-12 text-center text-xs text-muted-foreground">Cargando eventos…</div>
      ) : eventosFiltrados.length === 0 ? (
        <Card className="p-10 text-center border-dashed border-border/80 bg-card">
          <div className="size-12 rounded-full bg-muted/60 text-muted-foreground flex items-center justify-center mx-auto mb-3">
            <Calendar className="size-6" />
          </div>
          <CardTitle className="text-base text-foreground font-semibold">
            No se encontraron eventos
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
            Crea tu primer evento institucional para comenzar a gestionar invitados, gafetes y control de acceso.
          </CardDescription>
          <Button className="mt-4 min-h-11 text-xs font-semibold" onClick={() => setOpenCrear(true)}>
            <Plus className="size-4 mr-1.5" />
            Crear Primer Evento
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {eventosFiltrados.map((ev) => (
            <Card
              key={ev.id}
              className="flex flex-col justify-between hover:border-primary/50 transition-colors bg-card shadow-xs"
            >
              <CardHeader className="pb-3 border-b border-border/40">
                <div className="flex justify-between items-start gap-2">
                  <Badge
                    variant="outline"
                    className={
                      ev.estado === "ACTIVO"
                        ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px] font-bold"
                        : "bg-muted text-muted-foreground border-border text-[10px] font-bold"
                    }
                  >
                    {ev.estado}
                  </Badge>

                  {ev.fecha_inicio && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1 font-mono">
                      <Calendar className="size-3 text-muted-foreground" />
                      {new Date(ev.fecha_inicio).toLocaleDateString("es-VE", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                      })}
                    </span>
                  )}
                </div>

                <CardTitle className="text-base font-bold text-foreground line-clamp-1 mt-2">
                  {ev.nombre}
                </CardTitle>

                <CardDescription className="text-xs text-muted-foreground flex items-center gap-1 line-clamp-1 mt-0.5">
                  <MapPin className="size-3 text-muted-foreground shrink-0" />
                  <span>{ev.lugar || "Sede CONATEL"}</span>
                </CardDescription>
              </CardHeader>

              <CardContent className="py-4">
                <div className="grid grid-cols-2 gap-2 p-3 bg-muted/40 rounded-lg text-center text-xs border border-border/40">
                  <div>
                    <span className="text-muted-foreground block text-[11px] font-medium flex items-center justify-center gap-1">
                      <Users className="size-3" />
                      Invitados
                    </span>
                    <span className="text-lg font-black text-foreground mt-0.5 block">
                      {ev.total_invitados ?? 0}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px] font-medium flex items-center justify-center gap-1">
                      <CheckCircle2 className="size-3 text-emerald-600" />
                      Ingresaron
                    </span>
                    <span className="text-lg font-black text-emerald-600 dark:text-emerald-400 mt-0.5 block">
                      {ev.total_entraron ?? 0}
                    </span>
                  </div>
                </div>
              </CardContent>

              <CardFooter className="pt-0 flex items-center justify-between gap-2 border-t border-border/40 mt-auto p-4">
                <Link href={`/carnetizacion/control-eventos?evento_id=${ev.id}`}>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10 text-xs font-semibold h-9"
                  >
                    <QrCode className="size-3.5 mr-1.5" />
                    Check-in QR
                  </Button>
                </Link>

                <Link href={`/carnetizacion/eventos/${ev.id}`}>
                  <Button variant="default" size="sm" className="text-xs font-semibold h-9">
                    Ver Hub
                    <ArrowRight className="size-3.5 ml-1.5" />
                  </Button>
                </Link>
              </CardFooter>
            </Card>
          ))}
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
