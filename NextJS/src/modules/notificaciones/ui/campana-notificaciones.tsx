"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import useSWR, { useSWRConfig } from "swr";
import { Bell, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/components/popover";
import { VistaCargando, VistaError, VistaVacia } from "@/shared/ui/components/vista-estados";
import { cn } from "@/lib/utils";
import type { ModuloNotificaciones } from "../domain/entities/notificacion";
import {
  contarNoLeidasAction,
  listarNotificacionesAction,
  marcarLeidaAction,
  marcarTodasLeidasAction,
} from "../infrastructure/actions/notificaciones-actions";
import { textoConteo } from "./formato-notificacion";
import { NotificacionItem } from "./notificacion-item";
import {
  INTERVALO_SONDEO_MS,
  claveConteo,
  claveRecientes,
  desenvolver,
  esClaveDeNotificaciones,
  usePuedeAbrirEnlace,
  usePuedeVerNotificaciones,
} from "./notificaciones-swr";

/** Cuántas notificaciones sin leer se adelantan en la campana (máximo). */
export const CANTIDAD_RECIENTES = 4;

interface Props {
  /** Bandeja del módulo en que está la cabecera: solo cuenta y muestra sus notificaciones. */
  modulo: ModuloNotificaciones;
  /** Ruta de la página de notificaciones DEL MÓDULO ACTUAL («Ver todas» lleva allí). */
  rutaBandeja: string;
  /** `oscura`: sobre cabecera de color (texto blanco); `clara`: sobre fondo claro. */
  variante?: "oscura" | "clara";
  className?: string;
}

/**
 * Campana de notificaciones: contador y las últimas sin leer (máx. 4) del módulo actual, con un
 * enlace «Ver todas» a la bandeja de ese módulo. Sin el permiso `notificaciones.ver_propias` no se
 * muestra ni se hace ninguna petición.
 */
export function CampanaNotificaciones(props: Props) {
  const puedeVer = usePuedeVerNotificaciones();
  return puedeVer ? <CampanaActiva {...props} /> : null;
}

function CampanaActiva({ variante = "clara", className, modulo, rutaBandeja }: Props) {
  const [abierto, setAbierto] = useState(false);
  const puedeAbrirEnlace = usePuedeAbrirEnlace();
  const [pendiente, startTransition] = useTransition();
  const { mutate } = useSWRConfig();

  const { data: noLeidas = 0 } = useSWR(
    claveConteo(modulo),
    async () => desenvolver(await contarNoLeidasAction(modulo)),
    {
      refreshInterval: INTERVALO_SONDEO_MS,
      refreshWhenHidden: false,
      revalidateOnFocus: true,
      shouldRetryOnError: false,
    },
  );

  const {
    data: recientes,
    error,
    isLoading,
  } = useSWR(
    abierto ? claveRecientes(modulo) : null,
    async () =>
      desenvolver(
        await listarNotificacionesAction({ modulo, leida: false, limite: CANTIDAD_RECIENTES }),
      ).resultados.slice(0, CANTIDAD_RECIENTES),
    { shouldRetryOnError: false },
  );

  const refrescar = () => mutate(esClaveDeNotificaciones);

  const marcarLeida = (id: string) =>
    startTransition(async () => {
      await marcarLeidaAction(id);
      await refrescar();
    });

  const marcarTodas = () =>
    startTransition(async () => {
      await marcarTodasLeidasAction(modulo);
      await refrescar();
    });

  const etiqueta = `Notificaciones: ${textoConteo(noLeidas)}`;

  return (
    <Popover open={abierto} onOpenChange={setAbierto}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={etiqueta}
          className={cn(
            "relative size-11",
            variante === "oscura" && "text-white hover:bg-white/15 hover:text-white",
            className,
          )}
        >
          <Bell aria-hidden className="size-5" />
          {noLeidas > 0 ? (
            <span
              aria-hidden
              className="absolute right-0.5 top-0.5 flex min-w-5 items-center justify-center rounded-full bg-danger px-1 text-xs font-bold leading-5 text-white"
            >
              {noLeidas > 99 ? "99+" : noLeidas}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      {/* Anuncia los cambios del contador a lectores de pantalla sin mover el foco. */}
      <span role="status" aria-live="polite" className="sr-only">
        {textoConteo(noLeidas)}
      </span>
      <PopoverContent align="end" className="w-[min(24rem,calc(100vw-1.5rem))] p-3">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-bold">Notificaciones</h2>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="min-h-11"
              disabled={pendiente || noLeidas === 0}
              onClick={marcarTodas}
            >
              <CheckCheck aria-hidden /> Marcar todas como leídas
            </Button>
          </div>

          {isLoading ? (
            <VistaCargando mensaje="Cargando notificaciones…" className="p-4" />
          ) : error ? (
            <VistaError
              mensaje="No se pudieron cargar sus notificaciones."
              onReintentar={() => void mutate(claveRecientes(modulo))}
            />
          ) : !recientes?.length ? (
            <VistaVacia titulo="No tiene notificaciones sin leer" className="p-4" />
          ) : (
            <ul className="flex max-h-[60svh] flex-col gap-2 overflow-y-auto">
              {recientes.map((n) => (
                <NotificacionItem
                  key={n.id}
                  notificacion={n}
                  compacta
                  deshabilitado={pendiente}
                  onMarcarLeida={marcarLeida}
                  onNavegar={() => setAbierto(false)}
                  puedeAbrirEnlace={puedeAbrirEnlace}
                />
              ))}
            </ul>
          )}

          <Button asChild variant="outline" className="min-h-11">
            <Link href={rutaBandeja} onClick={() => setAbierto(false)}>
              Ver todas
            </Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
