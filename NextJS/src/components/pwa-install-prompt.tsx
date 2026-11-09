"use client";

import { useEffect, useState } from "react";
import { Download, Share2, X } from "lucide-react";

import { Button } from "@/shared/ui/components/button";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const CLAVE = "gath-pwa-instalacion-oculta";

/** Aviso discreto de instalación: solo en móvil y solo si el navegador lo permite. */
export function PwaInstallPrompt() {
  const [evento, setEvento] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.localStorage.getItem(CLAVE) === "1") return;
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);
    if (standalone) return;

    const esIos = /iphone|ipad|ipod/i.test(window.navigator.userAgent);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- capacidad del navegador solo disponible en cliente
    setIos(esIos);
    if (esIos) setVisible(true);

    const alPrompt = (e: Event) => {
      e.preventDefault();
      setEvento(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", alPrompt);
    return () => window.removeEventListener("beforeinstallprompt", alPrompt);
  }, []);

  if (!visible) return null;

  const cerrar = () => {
    setVisible(false);
    window.localStorage.setItem(CLAVE, "1");
  };

  const instalar = async () => {
    if (!evento) return;
    await evento.prompt();
    const eleccion = await evento.userChoice;
    if (eleccion.outcome === "accepted") cerrar();
  };

  return (
    <aside
      aria-label="Instalar la aplicación"
      className="fixed inset-x-3 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-50 rounded-xl border border-border bg-card p-3 shadow-lg md:hidden"
    >
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Download className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Instalar GATH</p>
          <p className="text-sm text-muted-foreground">
            {ios
              ? "En Safari, toque Compartir y luego «Añadir a pantalla de inicio»."
              : "Acceda más rápido desde su pantalla de inicio."}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {ios ? (
              <span className="inline-flex min-h-11 items-center gap-2 rounded-md border border-border px-3 text-sm">
                <Share2 className="size-4" aria-hidden /> Compartir
              </span>
            ) : (
              <Button type="button" onClick={instalar} className="min-h-11">
                Instalar
              </Button>
            )}
            <Button type="button" variant="ghost" onClick={cerrar} className="min-h-11">
              Ahora no
            </Button>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={cerrar}
          aria-label="Ocultar aviso de instalación"
        >
          <X aria-hidden />
        </Button>
      </div>
    </aside>
  );
}
