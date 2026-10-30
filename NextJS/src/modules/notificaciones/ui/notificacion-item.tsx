"use client";

import Link from "next/link";
import { Check, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/shared/ui/components/status-badge";
import { cn } from "@/lib/utils";
import type { NotificacionDTO } from "../application/dtos/notificacion-dto";
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
  return (
    <li
      className={cn(
        "flex flex-col gap-2 rounded-lg border p-3",
        n.leida ? "bg-card" : "border-info/40 bg-info-soft/40",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <StatusBadge texto={n.leida ? "Leída" : "Nueva"} tono={n.leida ? "neutral" : "info"} />
        <time dateTime={n.creadaEn} className="text-sm text-muted-foreground">
          {formatearFechaNotificacion(n.creadaEn)}
        </time>
      </div>
      <p className={cn("text-base text-foreground", n.leida ? "font-medium" : "font-bold")}>
        {n.titulo}
      </p>
      {n.mensaje && !compacta ? (
        <p className="text-base text-muted-foreground">{n.mensaje}</p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        {n.enlace && (puedeAbrirEnlace?.(n.enlace) ?? true) ? (
          <Button asChild variant="outline" size="sm" className="min-h-11">
            <Link
              href={n.enlace}
              onClick={() => {
                if (!n.leida) onMarcarLeida(n.id);
                onNavegar?.();
              }}
            >
              <ExternalLink aria-hidden /> Ver detalle
            </Link>
          </Button>
        ) : null}
        {!n.leida ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="min-h-11"
            disabled={deshabilitado}
            onClick={() => onMarcarLeida(n.id)}
          >
            <Check aria-hidden /> Marcar como leída
          </Button>
        ) : null}
      </div>
    </li>
  );
}
