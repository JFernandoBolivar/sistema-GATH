"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeftRight,
  Bell,
  Check,
  ClipboardList,
  ExternalLink,
  HeartPulse,
  IdCard,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/shared/ui/components/status-badge";
import { cn } from "@/lib/utils";
import type { NotificacionDTO } from "../application/dtos/notificacion-dto";
import { destinoInterno, rutaActual } from "./enlace-notificacion";
import { formatearFechaNotificacion } from "./formato-notificacion";

const ICONOS_MODULO: Record<string, { Icono: LucideIcon; clases: string; etiqueta: string }> = {
  fe_de_vida: { Icono: HeartPulse, clases: "bg-success-soft text-success", etiqueta: "Fe de Vida" },
  autogestion: { Icono: ClipboardList, clases: "bg-secondary text-primary", etiqueta: "Autogestión" },
  identidad: { Icono: ShieldCheck, clases: "bg-warning-soft text-warning", etiqueta: "Cuentas y Seguridad" },
  carnetizacion: { Icono: IdCard, clases: "bg-info-soft text-info", etiqueta: "Carnetización" },
  movimiento: { Icono: ArrowLeftRight, clases: "bg-secondary text-primary", etiqueta: "Movimientos" },
};

const ICONO_POR_DEFECTO = { Icono: Bell, clases: "bg-muted text-muted-foreground", etiqueta: "Aviso" };


interface Props {
  notificacion: NotificacionDTO;
  onMarcarLeida: (id: string) => void;
  /** Se llama al seguir el enlace (p. ej. para cerrar el popover). */
  onNavegar?: () => void;
  deshabilitado?: boolean;
  compacta?: boolean;
  /** Si devuelve `false` no se muestra «Ver detalle» (recurso de otro módulo sin permiso). */
  puedeAbrirEnlace?: (enlace: string) => boolean;
}

/**
 * Una notificación. El estado leída/no leída se comunica con texto («Nueva» / «Leída»), no solo
 * con color o peso de fuente.
 */
export function NotificacionItem({
  notificacion: n,
  onMarcarLeida,
  onNavegar,
  deshabilitado,
  compacta,
  puedeAbrirEnlace,
}: Props) {
  const router = useRouter();

  const manejarEnlace = (evento: React.MouseEvent<HTMLAnchorElement>) => {
    // Los clics con modificador o con otro botón conservan el comportamiento
    // nativo del enlace (abrir en otra pestaña, etc.).
    if (
      evento.metaKey ||
      evento.ctrlKey ||
      evento.shiftKey ||
      evento.altKey ||
      evento.button !== 0
    ) {
      return;
    }

    if (!n.leida) onMarcarLeida(n.id);
    onNavegar?.();

    const destino = destinoInterno(n.enlace);
    evento.preventDefault();
    if (!destino) {
      toast.error("Esta notificación no tiene un destino válido. Revise la bandeja.");
      return;
    }

    // Misma pantalla: el enlace no produciría un cambio visible. Se recargan
    // los datos y se avisa, en vez de cerrar el panel en silencio.
    if (destino === rutaActual(window.location)) {
      router.refresh();
      toast.info("Ya está en esa pantalla. Se actualizaron los datos.");
      return;
    }

    router.push(destino);
  };

  const modulo = (n.tipo.split(".")[0] || "").trim();
  const meta = ICONOS_MODULO[modulo] ?? ICONO_POR_DEFECTO;
  const enlaceVisible = n.enlace && (puedeAbrirEnlace?.(n.enlace) ?? true);

  const acciones = (
    <>
      {enlaceVisible ? (
        <Button
          asChild
          variant="outline"
          size="sm"
          className={cn(compacta ? "h-9 min-h-9 shrink-0 px-2.5 text-xs" : "min-h-10")}
        >
          <Link href={n.enlace!} onClick={manejarEnlace}>
            <ExternalLink aria-hidden className={compacta ? "size-3.5" : "size-4"} /> Ver detalle
          </Link>
        </Button>
      ) : null}
      {!n.leida ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn(compacta ? "h-9 min-h-9 shrink-0 px-2 text-xs" : "min-h-10")}
          disabled={deshabilitado}
          onClick={() => onMarcarLeida(n.id)}
        >
          <Check aria-hidden className={compacta ? "size-3.5" : "size-4"} /> Marcar como leída
        </Button>
      ) : null}
    </>
  );

  if (compacta) {
    return (
      <li
        className={cn(
          "flex flex-col gap-1.5 rounded-lg border p-2.5",
          n.leida ? "bg-card" : "border-info/40 bg-info-soft/40",
        )}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <StatusBadge texto={n.leida ? "Leída" : "Nueva"} tono={n.leida ? "neutral" : "info"} />
          <time dateTime={n.creadaEn} className="text-xs text-muted-foreground">
            {formatearFechaNotificacion(n.creadaEn)}
          </time>
        </div>
        <p
          className={cn(
            "text-sm leading-snug text-foreground",
            n.leida ? "font-medium" : "font-bold",
          )}
        >
          {n.titulo}
        </p>
        <div className="flex flex-nowrap items-center gap-1.5 overflow-x-auto pt-0.5">
          {acciones}
        </div>
      </li>
    );
  }

  return (
    <li
      className={cn(
        "flex gap-3 rounded-lg border p-4",
        n.leida
          ? "border-border bg-card"
          : "border-border border-l-4 border-l-primary bg-info-soft/40",
      )}
    >
      <span
        className={cn(
          "mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-lg",
          meta.clases,
        )}
      >
        <meta.Icono className="size-5" aria-hidden />
      </span>

      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <p
              className={cn(
                "min-w-0 text-base leading-snug text-foreground",
                n.leida ? "font-semibold" : "font-bold",
              )}
            >
              {n.titulo}
            </p>
            <StatusBadge texto={n.leida ? "Leída" : "Nueva"} tono={n.leida ? "neutral" : "info"} />
          </div>
          <time
            dateTime={n.creadaEn}
            className="shrink-0 text-sm text-muted-foreground tabular-nums"
          >
            {formatearFechaNotificacion(n.creadaEn)}
          </time>
        </div>

        {n.mensaje ? (
          <p
            className={cn(
              "text-sm leading-relaxed",
              n.leida ? "text-muted-foreground" : "text-foreground",
            )}
          >
            {n.mensaje}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-2 pt-1">{acciones}</div>
      </div>
    </li>
  );
}
