"use client";

import { BotonVerGuia } from "@/shared/ui/guias/boton-ver-guia";
import { useAbrirGuiaActual } from "./contexto-guia";

/** Único botón «Ver guía» de Autogestión; desaparece si la pantalla no tiene guía. */
export function BotonGuiaAutogestion({ className }: { className?: string }) {
  const abrir = useAbrirGuiaActual();
  if (!abrir) return null;
  return (
    <BotonVerGuia
      onClick={abrir}
      className={
        className ??
        "h-11 w-11 border-white/30 bg-transparent p-0 text-white hover:bg-white/10 hover:text-white dark:bg-transparent [&>span]:hidden sm:h-8 sm:w-auto sm:px-3 sm:[&>span]:inline"
      }
    />
  );
}
