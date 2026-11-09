"use client";

import { useEffect, useState } from "react";
import { Download, Share2 } from "lucide-react";

import { Button } from "@/shared/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/components/dialog";
import { cn } from "@/lib/utils";

/**
 * Evento del estándar de Web Apps para instalación asistida.
 * Tipado estricto sin uso de `any` (regla anti-slop).
 */
export interface BeforeInstallPromptChoice {
  outcome: "accepted" | "dismissed";
  platform: string;
}

export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: readonly string[];
  readonly userChoice: Promise<BeforeInstallPromptChoice>;
  prompt(): Promise<void>;
}

interface NavigatorWithStandalone extends Navigator {
  standalone?: boolean;
}

export const TEXTOS_INSTALAR_APP = {
  BOTON_LABEL: "Instalar app",
  BOTON_TITULO: "Instalar aplicación GATH",
  IOS_DIALOGO_TITULO: "Instalar en iPhone o iPad",
  IOS_DIALOGO_DESCRIPCION:
    "Para instalar GATH en la pantalla de inicio de su dispositivo Apple:",
  IOS_PASO_COMPARTIR:
    "Toque el botón Compartir de Safari (icono cuadrado con flecha hacia arriba).",
  IOS_PASO_AGREGAR:
    "Seleccione la opción «Agregar a inicio» (o «Añadir a pantalla de inicio»).",
  IOS_INSTRUCCION_RESUMEN: "Compartir → Agregar a inicio",
  BOTON_CERRAR: "Entendido",
} as const;

export interface BotonInstalarAppProps {
  variante?: "oscura" | "clara" | "outline" | "default";
  conTexto?: boolean;
  className?: string;
}

function comprobarModoStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const nav = window.navigator as NavigatorWithStandalone;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    Boolean(nav.standalone)
  );
}

function comprobarEsIos(): boolean {
  if (typeof window === "undefined") return false;
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

/**
 * Botón «Instalar app» en el sistema (A10):
 * - Escucha `beforeinstallprompt` para navegadores compatibles (Chromium, Edge, Android).
 * - Se oculta automáticamente si la aplicación ya está instalada en modo standalone.
 * - Se oculta si el navegador no soporta instalación y no es iOS.
 * - En iOS / iPhone muestra un diálogo modal accesible con la instrucción «Compartir → Agregar a inicio».
 * - Reutilizable en cabeceras, barras laterales y paneles del sistema.
 */
export function BotonInstalarApp({
  variante = "clara",
  conTexto = false,
  className,
}: BotonInstalarAppProps) {
  const [instalada, setInstalada] = useState<boolean>(false);
  const [esIos, setEsIos] = useState<boolean>(false);
  const [eventoPrompt, setEventoPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [dialogoIosAbierto, setDialogoIosAbierto] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (comprobarModoStandalone()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sincronización con estado del navegador en cliente
      setInstalada(true);
      return;
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincronización con User Agent en cliente
    setEsIos(comprobarEsIos());

    const manejarPrompt = (e: Event) => {
      e.preventDefault();
      setEventoPrompt(e as BeforeInstallPromptEvent);
    };

    const manejarInstalada = () => {
      setInstalada(true);
      setEventoPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", manejarPrompt);
    window.addEventListener("appinstalled", manejarInstalada);

    return () => {
      window.removeEventListener("beforeinstallprompt", manejarPrompt);
      window.removeEventListener("appinstalled", manejarInstalada);
    };
  }, []);

  // Si ya está instalada o el navegador no ofrece prompt y no es iOS, el botón permanece oculto
  if (instalada) {
    return null;
  }

  if (!eventoPrompt && !esIos) {
    return null;
  }

  const alHacerClic = async () => {
    if (esIos) {
      setDialogoIosAbierto(true);
      return;
    }

    if (!eventoPrompt) {
      return;
    }

    try {
      await eventoPrompt.prompt();
      const resultado = await eventoPrompt.userChoice;
      if (resultado.outcome === "accepted") {
        setInstalada(true);
        setEventoPrompt(null);
      }
    } catch {
      // El usuario canceló o el navegador desestimó el prompt; no se altera el estado
    }
  };

  return (
    <>
      <Button
        type="button"
        variant={
          variante === "oscura"
            ? "ghost"
            : variante === "outline"
            ? "outline"
            : "ghost"
        }
        size={conTexto ? "default" : "icon"}
        aria-label={TEXTOS_INSTALAR_APP.BOTON_TITULO}
        title={TEXTOS_INSTALAR_APP.BOTON_TITULO}
        onClick={alHacerClic}
        className={cn(
          conTexto ? "min-h-10 gap-2 px-3" : "size-11",
          variante === "oscura" &&
            "text-white hover:bg-white/15 hover:text-white",
          className,
        )}
      >
        <Download className="size-5 shrink-0" aria-hidden="true" />
        {conTexto && <span>{TEXTOS_INSTALAR_APP.BOTON_LABEL}</span>}
      </Button>

      {esIos && (
        <Dialog open={dialogoIosAbierto} onOpenChange={setDialogoIosAbierto}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Share2 className="size-5 text-primary" aria-hidden="true" />
                {TEXTOS_INSTALAR_APP.IOS_DIALOGO_TITULO}
              </DialogTitle>
              <DialogDescription>
                {TEXTOS_INSTALAR_APP.IOS_DIALOGO_DESCRIPCION}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2 text-sm">
              <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/40 p-3">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                  1
                </span>
                <p>{TEXTOS_INSTALAR_APP.IOS_PASO_COMPARTIR}</p>
              </div>

              <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/40 p-3">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                  2
                </span>
                <p>{TEXTOS_INSTALAR_APP.IOS_PASO_AGREGAR}</p>
              </div>

              <div className="rounded-md bg-primary/10 py-2 text-center font-semibold text-primary">
                «{TEXTOS_INSTALAR_APP.IOS_INSTRUCCION_RESUMEN}»
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                className="w-full min-h-11"
                onClick={() => setDialogoIosAbierto(false)}
              >
                {TEXTOS_INSTALAR_APP.BOTON_CERRAR}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
