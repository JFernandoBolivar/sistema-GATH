"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { CalendarDays, Clock3, Plus, QrCode, Users } from "lucide-react";

import { Button } from "@/shared/ui/components/button";
import { Card, CardContent } from "@/shared/ui/components/card";
import { BarraFiltros, type FiltroActivoChip } from "@/shared/ui/components/barra-filtros";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/components/select";
import { cn } from "@/lib/utils";
import { getEventosPaginadoAction } from "@/modules/carnetizacion/infrastructure/actions/eventos-actions";
import type { PaginaEventos } from "@/modules/carnetizacion/domain/entities/evento";
import { EventoCrearDialog } from "./evento-crear-dialog";
import { EventosPaginacion } from "./eventos-paginacion";
import { ETIQUETAS_ESTADO, EventoTarjeta } from "./evento-tarjeta";

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
    <Card className="border-border/60 shadow-sm transition-shadow hover:shadow-md">
      <CardContent className="flex items-center gap-4 p-4">
        <span className={cn("flex size-12 shrink-0 items-center justify-center rounded-full", tono)}>
          <Icono className="size-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{etiqueta}</p>
          <p className="text-3xl font-bold leading-tight tabular-nums text-foreground">{valor}</p>
          <p className="truncate text-[11px] text-muted-foreground">{detalle}</p>
        </div>
      </CardContent>
    </Card>
  );
}

const TAMANO_PAGINA = 12;

export function EventosListaView() {
  // Referencia fija para distinguir eventos próximos (evita Date.now() en el render).
  const [ahora] = useState(() => Date.now());
  const [pagina, setPagina] = useState<PaginaEventos | null>(null);
  const [numPagina, setNumPagina] = useState(1);
  const [busqueda, setBusqueda] = useState("");
  const [busquedaAplicada, setBusquedaAplicada] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState("TODOS");
  const [openCrear, setOpenCrear] = useState(false);
  const [isPending, startTransition] = useTransition();

  // La búsqueda se envía al servidor con una pequeña espera.
  useEffect(() => {
    const t = setTimeout(() => setBusquedaAplicada(busqueda.trim()), 350);
    return () => clearTimeout(t);
  }, [busqueda]);

  const cargarEventos = useCallback(() => {
    startTransition(async () => {
      try {
        const data = await getEventosPaginadoAction({
          pagina: numPagina,
          page_size: TAMANO_PAGINA,
          estado: estadoFiltro === "TODOS" ? undefined : estadoFiltro,
          busqueda: busquedaAplicada || undefined,
        });
        setPagina(data);
      } catch (err) {
        console.error("Error cargando eventos:", err);
      }
    });
  }, [numPagina, estadoFiltro, busquedaAplicada]);

  useEffect(() => {
    cargarEventos();
  }, [cargarEventos]);

  const filtrados = pagina?.resultados ?? [];
  const resumen = pagina?.resumen;
  const metricas = {
    total: resumen?.eventos ?? 0,
    activos: resumen?.en_curso ?? 0,
    invitados: resumen?.invitados ?? 0,
    ingresos: resumen?.ingresos ?? 0,
  };

  const chipsActivos = useMemo<FiltroActivoChip[]>(() => {
    const chips: FiltroActivoChip[] = [];
    if (busqueda.trim()) {
      chips.push({
        id: "busqueda",
        label: "Búsqueda",
        valorLegible: busqueda,
        onRemover: () => {
          setBusqueda("");
          setBusquedaAplicada("");
          setNumPagina(1);
        },
      });
    }
    if (estadoFiltro !== "TODOS") {
      chips.push({
        id: "estado",
        label: "Estado",
        valorLegible: ETIQUETAS_ESTADO[estadoFiltro] ?? estadoFiltro,
        onRemover: () => {
          setEstadoFiltro("TODOS");
          setNumPagina(1);
        },
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
        onBusquedaChange={(v) => {
          setBusqueda(v);
          setNumPagina(1);
        }}
        placeholderBusqueda="Buscar por evento, lugar o descripción…"
        totalResultados={pagina?.total ?? 0}
        etiquetaResultados="eventos"
        hayFiltrosActivos={hayFiltros}
        onLimpiarFiltros={() => {
          setBusqueda("");
          setBusquedaAplicada("");
          setEstadoFiltro("TODOS");
          setNumPagina(1);
        }}
        chipsActivos={chipsActivos}
        tituloFiltrosMovil="Filtros de eventos"
      >
        <div className="flex min-w-0 flex-col gap-1.5">
          <span className="text-sm font-medium text-foreground">Estado del evento</span>
          <Select
            value={estadoFiltro}
            onValueChange={(v) => {
              setEstadoFiltro(v);
              setNumPagina(1);
            }}
          >
            <SelectTrigger className="h-11 w-full min-w-0 text-sm" aria-label="Estado del evento">
              <SelectValue placeholder="Todos los estados" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="TODOS">Todos los estados</SelectItem>
              <SelectItem value="activo">En curso</SelectItem>
              <SelectItem value="proximo">Próximos</SelectItem>
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
      {isPending && pagina === null ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Card key={i} className="h-80 animate-pulse border-border/60 bg-muted/30" />
          ))}
        </div>
      ) : filtrados.length === 0 ? (
        <Card className="border-dashed border-border/80 bg-card">
          <CardContent className="flex flex-col items-center px-4 py-16 text-center">
            <span className="flex size-20 items-center justify-center rounded-full bg-secondary text-primary ring-8 ring-secondary/50">
              <CalendarDays className="size-9" aria-hidden />
            </span>
            <h3 className="mt-4 text-lg font-semibold text-foreground">
              {hayFiltros ? "No hay eventos que coincidan con los filtros" : "Aún no hay eventos"}
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
          {filtrados.map((ev) => (
            <EventoTarjeta key={ev.id} evento={ev} ahora={ahora} />
          ))}
        </div>
      )}

      {pagina && pagina.total > 0 && (
        <EventosPaginacion
          pagina={pagina.pagina}
          totalPaginas={pagina.total_paginas}
          total={pagina.total}
          tamano={pagina.tamano}
          onPagina={setNumPagina}
        />
      )}

      <EventoCrearDialog
        open={openCrear}
        onOpenChange={setOpenCrear}
        onEventoCreado={() => {
          if (numPagina !== 1) setNumPagina(1);
          else cargarEventos();
        }}
      />
    </div>
  );
}
