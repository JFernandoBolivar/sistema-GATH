"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
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
      {/* Cabecera Principal */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Eventos y Asistentes</h1>
          <p className="text-sm text-muted-foreground">
            Gestión de eventos especiales, acreditaciones de invitados y control de entrada con QR.
          </p>
        </div>
        <Button onClick={() => setOpenCrear(true)}>+ Nuevo Evento</Button>
      </div>

      {/* Barra de búsqueda */}
      <div className="flex items-center gap-4">
        <Input
          placeholder="Buscar por nombre o lugar..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="max-w-sm"
        />
      </div>

      {/* Listado de Tarjetas */}
      {isPending && eventos.length === 0 ? (
        <div className="p-8 text-center text-muted-foreground">Cargando eventos...</div>
      ) : eventosFiltrados.length === 0 ? (
        <Card className="p-8 text-center border-dashed">
          <CardTitle className="text-base text-muted-foreground">
            No se encontraron eventos
          </CardTitle>
          <CardDescription className="mt-1">
            Crea tu primer evento para comenzar a gestionar invitados y gafetes.
          </CardDescription>
          <Button className="mt-4" onClick={() => setOpenCrear(true)}>
            Crear Evento
          </Button>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {eventosFiltrados.map((ev) => (
            <Card key={ev.id} className="flex flex-col justify-between hover:border-primary/50 transition-colors">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start gap-2">
                  <Badge variant="outline" className="uppercase font-semibold text-[10px]">
                    {ev.estado}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    📅 {ev.fecha_inicio ? new Date(ev.fecha_inicio).toLocaleDateString() : ""}
                  </span>
                </div>
                <CardTitle className="text-lg line-clamp-1 mt-2">{ev.nombre}</CardTitle>
                <CardDescription className="line-clamp-2 text-xs">
                  📍 {ev.lugar}
                </CardDescription>
              </CardHeader>

              <CardContent className="pb-3">
                <div className="grid grid-cols-2 gap-2 p-3 bg-muted/40 rounded-lg text-center text-xs">
                  <div>
                    <span className="text-muted-foreground block">Invitados</span>
                    <span className="text-base font-bold">{ev.total_invitados ?? 0}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Ingresaron</span>
                    <span className="text-base font-bold text-emerald-600 dark:text-emerald-400">
                      {ev.total_entraron ?? 0}
                    </span>
                  </div>
                </div>
              </CardContent>

              <CardFooter className="pt-0 flex items-center justify-between gap-2 border-t mt-auto p-4">
                <Link href={`/carnetizacion/control-eventos?evento_id=${ev.id}`}>
                  <Button variant="ghost" size="sm" className="text-emerald-600 dark:text-emerald-400">
                    📲 Check-in
                  </Button>
                </Link>
                <Link href={`/carnetizacion/eventos/${ev.id}`}>
                  <Button variant="default" size="sm">
                    Ver Panel →
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
