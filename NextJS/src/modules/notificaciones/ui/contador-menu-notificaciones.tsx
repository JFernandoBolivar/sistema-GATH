"use client";

/**
 * Número de notificaciones sin leer junto al ítem «Notificaciones» del menú lateral (QA 2026-11-03).
 * Usa la misma clave SWR que la campana: comparten el dato y no suman consultas al servidor.
 */
import useSWR from "swr";
import { SidebarMenuBadge } from "@/components/ui/sidebar";
import type { ModuloNotificaciones } from "../domain/entities/notificacion";
import { contarNoLeidasAction } from "../infrastructure/actions/notificaciones-actions";
import {
  INTERVALO_SONDEO_MS,
  claveConteo,
  desenvolver,
  usePuedeVerNotificaciones,
} from "./notificaciones-swr";

/** Bandeja de cada menú → módulo de notificaciones que muestra su campana. */
const MODULO_POR_RUTA: Record<string, ModuloNotificaciones> = {
  "/personal/notificaciones": "personal",
  "/carnetizacion/notificaciones": "carnetizacion",
  "/usuarios/notificaciones": "seguridad",
  "/autogestion/notificaciones": "autogestion",
};

export function moduloDeRutaNotificaciones(ruta: string): ModuloNotificaciones | null {
  return MODULO_POR_RUTA[ruta] ?? null;
}

export function ContadorMenuNotificaciones({ modulo }: { modulo: ModuloNotificaciones }) {
  const puedeVer = usePuedeVerNotificaciones();
  return puedeVer ? <ContadorActivo modulo={modulo} /> : null;
}

function ContadorActivo({ modulo }: { modulo: ModuloNotificaciones }) {
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
  if (!noLeidas) return null;
  return (
    <SidebarMenuBadge
      className="rounded-full bg-destructive px-1.5 text-[11px] font-semibold text-white"
      aria-label={`${noLeidas} sin leer`}
    >
      {noLeidas > 99 ? "99+" : noLeidas}
    </SidebarMenuBadge>
  );
}
