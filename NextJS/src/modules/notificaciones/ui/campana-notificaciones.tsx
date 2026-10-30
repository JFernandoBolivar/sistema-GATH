"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import useSWR, { useSWRConfig } from "swr";
import { Bell, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/shared/ui/components/sheet";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/components/popover";
import { VistaCargando, VistaError, VistaVacia } from "@/shared/ui/components/vista-estados";
import { cn } from "@/lib/utils";
import { useSession } from "next-auth/react";
import { tienePermiso } from "@/shared/lib/evaluador-iam";
import BandejaNotificacionesPage from "./bandeja-notificaciones-page";
import {
  contarNoLeidasAction,
  listarNotificacionesAction,
  marcarLeidaAction,
  marcarTodasLeidasAction,
} from "../infrastructure/actions/notificaciones-actions";
import { textoConteo } from "./formato-notificacion";
import { NotificacionItem } from "./notificacion-item";
import {
  CLAVE_CONTEO,
  CLAVE_RECIENTES,
  INTERVALO_SONDEO_MS,
  desenvolver,
  esClaveDeNotificaciones,
  usePuedeVerNotificaciones,
} from "./notificaciones-swr";

const CANTIDAD_RECIENTES = 5;
const RUTA_BANDEJA_AUTOGESTION = "/autogestion/notificaciones";
const PERMISO_AUTOGESTION = "autogestion.ver_propio";

interface Props {
  /** `oscura`: sobre cabecera de color (texto blanco); `clara`: sobre fondo claro. */
  variante?: "oscura" | "clara";
  className?: string;
  /**
   * `pagina`: «Ver todas» navega a `rutaBandeja`. `panel`: la bandeja completa se abre en un
   * panel lateral sin salir de la página actual (cabeceras de módulos que no son Autogestión).
   */
  modoBandeja?: "pagina" | "panel";
  rutaBandeja?: string;
}

/**
 * Campana de notificaciones. Sin el permiso `notificaciones.ver_propias` no se muestra ni se
 * hace ninguna petición.
 */
export function CampanaNotificaciones(props: Props) {
  const puedeVer = usePuedeVerNotificaciones();
  return puedeVer ? <CampanaActiva {...props} /> : null;
}

function CampanaActiva({
  variante = "clara",
  className,
  modoBandeja = "pagina",
  rutaBandeja = RUTA_BANDEJA_AUTOGESTION,
}: Props) {
  const [abierto, setAbierto] = useState(false);
  const [panelAbierto, setPanelAbierto] = useState(false);
  const { data: session } = useSession();
  // Un enlace al área de Autogestión solo se ofrece si el usuario tiene acceso a ella.
  const puedeAbrirEnlace = (enlace: string) =>
    !enlace.startsWith("/autogestion") ||
    tienePermiso(session?.user?.permisos, PERMISO_AUTOGESTION);
  const [pendiente, startTransition] = useTransition();
  const { mutate } = useSWRConfig();

  const { data: noLeidas = 0 } = useSWR(
    CLAVE_CONTEO,
    async () => desenvolver(await contarNoLeidasAction()),
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
    abierto ? CLAVE_RECIENTES : null,
    async () =>
      desenvolver(await listarNotificacionesAction({ limite: CANTIDAD_RECIENTES })).resultados,
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
      await marcarTodasLeidasAction();
      await refrescar();
    });

  const etiqueta = `Notificaciones: ${textoConteo(noLeidas)}`;

  return (
    <>
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
                onReintentar={() => void mutate(CLAVE_RECIENTES)}
              />
            ) : !recientes?.length ? (
              <VistaVacia titulo="No tiene notificaciones" className="p-4" />
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

            {modoBandeja === "panel" ? (
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                onClick={() => {
                  setAbierto(false);
                  setPanelAbierto(true);
                }}
              >
                Ver todas las notificaciones
              </Button>
            ) : (
              <Button asChild variant="outline" className="min-h-11">
                <Link href={rutaBandeja} onClick={() => setAbierto(false)}>
                  Ver todas las notificaciones
                </Link>
              </Button>
            )}
          </div>
        </PopoverContent>
      </Popover>
      {modoBandeja === "panel" ? (
        <Sheet open={panelAbierto} onOpenChange={setPanelAbierto}>
          <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
            <SheetHeader>
              <SheetTitle>Notificaciones</SheetTitle>
              <SheetDescription>Avisos sobre sus trámites y solicitudes.</SheetDescription>
            </SheetHeader>
            <div className="px-4 pb-4">
              <BandejaNotificacionesPage
                enPanel
                onNavegar={() => setPanelAbierto(false)}
                puedeAbrirEnlace={puedeAbrirEnlace}
              />
            </div>
          </SheetContent>
        </Sheet>
      ) : null}
    </>
  );
}
