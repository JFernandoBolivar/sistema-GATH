"use client";

import Link from "next/link";
import { ArrowRight, CheckCircle2, MapPin, QrCode, Users } from "lucide-react";

import { cn } from "@/lib/utils";
import type { Evento } from "@/modules/carnetizacion/domain/entities/evento";

export const ETIQUETAS_ESTADO: Record<string, string> = {
  activo: "En curso",
  borrador: "Borrador",
  proximo: "Próximo",
  finalizado: "Finalizado",
  cancelado: "Cancelado",
};

interface EstiloEstado {
  banda: string;
  punto: string;
  fecha: string;
}

function estiloEstado(estado: string): EstiloEstado {
  if (estado === "activo")
    return { banda: "bg-success-soft text-success", punto: "bg-success", fecha: "bg-success text-white" };
  if (estado === "proximo")
    return { banda: "bg-info-soft text-info", punto: "bg-info", fecha: "bg-info text-white" };
  if (estado === "borrador")
    return { banda: "bg-warning-soft text-warning", punto: "bg-warning", fecha: "bg-warning text-white" };
  if (estado === "cancelado")
    return {
      banda: "bg-destructive/10 text-destructive",
      punto: "bg-destructive",
      fecha: "bg-destructive text-white",
    };
  return { banda: "bg-muted text-muted-foreground", punto: "bg-muted-foreground", fecha: "bg-muted-foreground text-white" };
}

function partesFecha(iso?: string): { dia: string; mes: string; anio: string } | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return {
    dia: d.toLocaleDateString("es-VE", { day: "2-digit" }),
    mes: d.toLocaleDateString("es-VE", { month: "short" }).replace(".", "").toUpperCase(),
    anio: d.toLocaleDateString("es-VE", { year: "numeric" }),
  };
}

/** Momento de referencia para «próximo»: lo pasa la lista (render puro, sin Date.now()). */
export function EventoTarjeta({ evento: ev, ahora }: { evento: Evento; ahora: number }) {
  const total = ev.total_invitados ?? 0;
  const ingresos = ev.total_entraron ?? 0;
  const asistencia = total > 0 ? Math.min(100, Math.round((ingresos / total) * 100)) : 0;
  const empezo = !ev.fecha_inicio || new Date(ev.fecha_inicio).getTime() <= ahora;
  const estadoVisual = ev.estado === "activo" && !empezo ? "proximo" : ev.estado;
  const estilo = estiloEstado(estadoVisual);
  const fecha = partesFecha(ev.fecha_inicio);
  const esActivo = estadoVisual === "activo";
  const categorias = ev.categorias ?? [];
  const zonas = ev.zonas ?? [];
  const chips = [
    ...categorias.map((c) => ({ id: `c-${c.id}`, nombre: c.nombre })),
    ...zonas.map((z) => ({ id: `z-${z.id}`, nombre: z.nombre })),
  ];
  const visibles = chips.slice(0, 4);
  const restantes = chips.length - visibles.length;

  return (
    <article
      className={cn(
        "group flex h-full min-w-0 flex-col overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm transition-all",
        "hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md",
        "focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/20",
      )}
    >
      <header
        className={cn(
          "flex items-center justify-between gap-2 px-4 py-2 text-[11px] font-bold uppercase tracking-wide",
          estilo.banda,
        )}
      >
        <span className="inline-flex items-center gap-2">
          <span className="relative flex size-2">
            {esActivo && (
              <span
                className={cn(
                  "absolute inline-flex size-full rounded-full opacity-60 motion-safe:animate-ping",
                  estilo.punto,
                )}
                aria-hidden
              />
            )}
            <span className={cn("relative inline-flex size-2 rounded-full", estilo.punto)} aria-hidden />
          </span>
          {ETIQUETAS_ESTADO[estadoVisual] ?? estadoVisual}
        </span>
      </header>

      <div className="flex flex-1 flex-col gap-4 p-4">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "flex w-14 shrink-0 flex-col items-center overflow-hidden rounded-lg border border-border/60 bg-background text-center",
            )}
            aria-label={fecha ? `${fecha.dia} ${fecha.mes} ${fecha.anio}` : "Sin fecha"}
          >
            {fecha ? (
              <>
                <span className={cn("w-full py-0.5 text-[10px] font-bold uppercase leading-4", estilo.fecha)}>
                  {fecha.mes}
                </span>
                <span className="text-2xl font-bold leading-7 tabular-nums text-foreground">{fecha.dia}</span>
                <span className="pb-1 text-[10px] font-medium leading-3 text-muted-foreground">{fecha.anio}</span>
              </>
            ) : (
              <span className="px-1 py-4 text-[10px] font-medium text-muted-foreground">Sin fecha</span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="line-clamp-2 break-words text-lg font-semibold leading-snug text-foreground" title={ev.nombre}>
              {ev.nombre}
            </h3>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
              <MapPin className="size-3.5 shrink-0" aria-hidden />
              <span className="truncate">{ev.lugar || "Sede CONATEL"}</span>
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
              <Users className="size-3" aria-hidden />
              Invitados
            </p>
            <p className="text-2xl font-bold leading-tight tabular-nums text-foreground">{total}</p>
          </div>
          <div>
            <p className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
              <CheckCircle2 className="size-3 text-success" aria-hidden />
              Ingresaron
            </p>
            <p className="text-2xl font-bold leading-tight tabular-nums text-success">{ingresos}</p>
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px] font-medium">
            <span className="text-muted-foreground">Asistencia</span>
            <span className="tabular-nums text-foreground">{asistencia}%</span>
          </div>
          <div
            className="h-2 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={asistencia}
            aria-label="Asistencia"
          >
            <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${asistencia}%` }} />
          </div>
        </div>

        {visibles.length > 0 && (
          <ul className="flex flex-wrap gap-1.5" aria-label="Categorías y zonas">
            {visibles.map((c) => (
              <li
                key={c.id}
                className="max-w-full truncate rounded-full border border-border/60 bg-secondary px-2 py-0.5 text-[11px] font-medium text-secondary-foreground"
              >
                {c.nombre}
              </li>
            ))}
            {restantes > 0 && (
              <li className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                +{restantes}
              </li>
            )}
          </ul>
        )}
      </div>

      <footer className="mt-auto flex flex-wrap items-center gap-2 border-t border-border/50 p-4">
        <Link
          href={`/carnetizacion/eventos/${ev.id}`}
          className="inline-flex h-10 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          Ver hub
          <ArrowRight className="size-4" aria-hidden />
        </Link>
        <Link
          href={`/carnetizacion/control-eventos?evento_id=${ev.id}`}
          className="inline-flex h-10 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-md border border-border bg-background px-3 text-sm font-semibold text-foreground transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <QrCode className="size-4" aria-hidden />
          Check-in QR
        </Link>
      </footer>
    </article>
  );
}
