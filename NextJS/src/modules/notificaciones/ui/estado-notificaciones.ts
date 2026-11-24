"use client";

/**
 * Sondeo único y liviano de la bandeja (H-5, «casi en tiempo real»).
 *
 * La campana, el contador del menú y la bandeja leen el MISMO estado SWR (`claveEstado`): una sola
 * consulta cada ~15 s, solo con la pestaña visible (`refreshWhenHidden: false`), y revalidación
 * inmediata al volver a la pestaña o recuperar la red. Solo cuando la huella cambia (llegó, se leyó
 * o se atendió un aviso) se recarga la lista completa y, si hay más no leídas, se muestra un toast.
 *
 * Varias pestañas del mismo usuario sondean por separado (cada una cada 15 s con petición barata);
 * un líder por BroadcastChannel queda como mejora futura.
 */
import { useEffect } from "react";
import useSWR, { useSWRConfig } from "swr";
import { toast } from "sonner";
import { consultarEstadoAction, listarNotificacionesAction } from "../infrastructure/actions/notificaciones-actions";
import {
  INTERVALO_SONDEO_MS,
  claveEstado,
  desenvolver,
  esClaveDeNotificaciones,
} from "./notificaciones-swr";

/** Estado ya procesado por el primer consumidor montado: evita recargas y toasts duplicados. */
let huellaProcesada: string | null = null;
let noLeidasProcesadas = 0;
let consumidores = 0;

/** Solo para pruebas. */
export function reiniciarSondeoNotificaciones() {
  huellaProcesada = null;
  noLeidasProcesadas = 0;
  consumidores = 0;
}

async function avisarNuevaNotificacion() {
  let titulo = "Tiene una notificación nueva";
  try {
    const pagina = desenvolver(await listarNotificacionesAction({ leida: false, limite: 1 }));
    if (pagina.resultados[0]?.titulo) titulo = pagina.resultados[0].titulo;
  } catch {
    // Sin el título se muestra el aviso genérico.
  }
  // La animación del toast se desactiva con `prefers-reduced-motion` (globals.css).
  toast.info(titulo, { duration: 6000 });
}

export function useEstadoNotificaciones(): { noLeidas: number } {
  const { mutate } = useSWRConfig();
  const { data } = useSWR(claveEstado(), async () => desenvolver(await consultarEstadoAction()), {
    refreshInterval: INTERVALO_SONDEO_MS,
    refreshWhenHidden: false,
    refreshWhenOffline: false,
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
    shouldRetryOnError: false,
  });

  useEffect(() => {
    consumidores += 1;
    return () => {
      consumidores -= 1;
      if (consumidores <= 0) reiniciarSondeoNotificaciones();
    };
  }, []);

  useEffect(() => {
    if (!data || data.huella === huellaProcesada) return;
    const primera = huellaProcesada === null;
    const hayNuevas = !primera && data.noLeidas > noLeidasProcesadas;
    huellaProcesada = data.huella;
    noLeidasProcesadas = data.noLeidas;
    if (primera) return;
    void mutate((clave) => esClaveDeNotificaciones(clave) && clave !== claveEstado());
    if (hayNuevas) void avisarNuevaNotificacion();
  }, [data, mutate]);

  return { noLeidas: data?.noLeidas ?? 0 };
}
