"use client";

/**
 * Número de notificaciones sin leer junto al ítem «Notificaciones» del menú lateral (QA 2026-11-03).
 * Comparte con la campana el sondeo único del estado (`useEstadoNotificaciones`).
 */
import { SidebarMenuBadge } from "@/components/ui/sidebar";
import type { ModuloNotificaciones } from "../domain/entities/notificacion";
import { useEstadoNotificaciones } from "./estado-notificaciones";
import { usePuedeVerNotificaciones } from "./notificaciones-swr";

/** Bandeja de cada menú → módulo de notificaciones que muestra su campana. */
const MODULO_POR_RUTA: Record<string, ModuloNotificaciones> = {
  "/personal/notificaciones": "personal",
  "/carnetizacion/notificaciones": "carnetizacion",
  "/usuarios/notificaciones": "seguridad",
  "/autogestion/notificaciones": "autogestion",
  "/captacion/notificaciones": "postulacion",
  "/presupuesto/notificaciones": "postulacion",
  "/direccion/notificaciones": "postulacion",
};

export function moduloDeRutaNotificaciones(ruta: string): ModuloNotificaciones | null {
  return MODULO_POR_RUTA[ruta] ?? null;
}

export function ContadorMenuNotificaciones({ modulo }: { modulo: ModuloNotificaciones }) {
  const puedeVer = usePuedeVerNotificaciones();
  return puedeVer ? <ContadorActivo modulo={modulo} /> : null;
}

function ContadorActivo({ modulo }: { modulo: ModuloNotificaciones }) {
  // La lectura es por usuario: el módulo del shell ya no filtra el contador.
  void modulo;
  const { noLeidas } = useEstadoNotificaciones();
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
