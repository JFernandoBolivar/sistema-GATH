"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/shared/ui/components/status-badge";
import { cn } from "@/lib/utils";
import type { NotificacionDTO } from "../application/dtos/notificacion-dto";
import { destinoInterno, rutaActual } from "./enlace-notificacion";
import { formatearFechaNotificacion } from "./formato-notificacion";

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

  return (
    <li
      className={cn(
        "flex flex-col rounded-lg border",
        compacta ? "gap-1.5 p-2.5" : "gap-2 p-3",
        n.leida ? "bg-card" : "border-info/40 bg-info-soft/40",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <StatusBadge texto={n.leida ? "Leída" : "Nueva"} tono={n.leida ? "neutral" : "info"} />
        <time dateTime={n.creadaEn} className="text-xs text-muted-foreground sm:text-sm">
          {formatearFechaNotificacion(n.creadaEn)}
        </time>
      </div>
      <p
        className={cn(
          "text-foreground",
          compacta ? "text-sm leading-snug" : "text-base",
          n.leida ? "font-medium" : "font-bold",
        )}
      >
        {n.titulo}
      </p>
      {n.mensaje && !compacta ? (
        <p className="text-base text-muted-foreground">{n.mensaje}</p>
      ) : null}
      <div
        className={cn(
          "flex items-center gap-1.5",
          compacta ? "flex-nowrap overflow-x-auto pt-0.5" : "flex-wrap gap-2 pt-1",
        )}
      >
        {n.enlace && (puedeAbrirEnlace?.(n.enlace) ?? true) ? (
          <Button
            asChild
            variant="outline"
            size="sm"
            className={cn(
              compacta
                ? "h-9 min-h-9 shrink-0 px-2.5 text-xs"
                : "min-h-11",
            )}
          >
            <Link
              href={n.enlace}
              onClick={manejarEnlace}
            >
              <ExternalLink aria-hidden className={compacta ? "size-3.5" : undefined} /> Ver detalle
            </Link>
          </Button>
        ) : null}
        {!n.leida ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={cn(
              compacta
                ? "h-9 min-h-9 shrink-0 px-2 text-xs"
                : "min-h-11",
            )}
            disabled={deshabilitado}
            onClick={() => onMarcarLeida(n.id)}
          >
            <Check aria-hidden className={compacta ? "size-3.5" : undefined} /> Marcar como leída
          </Button>
        ) : null}
      </div>
    </li>
  );
}
