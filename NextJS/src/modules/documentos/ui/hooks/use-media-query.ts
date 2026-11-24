"use client";

import { useEffect, useState } from "react";

/** Coincidencia con una media query (falso en el primer render y en el servidor). */
export function useMediaQuery(consulta: string): boolean {
  const [coincide, setCoincide] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia(consulta);
    const actualizar = () => setCoincide(mql.matches);
    actualizar();
    mql.addEventListener("change", actualizar);
    return () => mql.removeEventListener("change", actualizar);
  }, [consulta]);
  return coincide;
}

export type DisposicionEditor = "ancho" | "medio" | "movil";

/** Umbrales sobre el ancho ÚTIL del editor (no de la ventana: el menú lateral resta ~256 px). */
export const ANCHO_MINIMO_TRES_COLUMNAS = 1440;
export const ANCHO_MINIMO_DOS_COLUMNAS = 900;

export function disposicionPorAncho(ancho: number): DisposicionEditor {
  if (ancho >= ANCHO_MINIMO_TRES_COLUMNAS) return "ancho";
  if (ancho >= ANCHO_MINIMO_DOS_COLUMNAS) return "medio";
  return "movil";
}

/**
 * Disposición según el ancho real del contenedor: `ancho` ≥ 1440 px (3 columnas), `medio` ≥ 900 px
 * (2 columnas, vista previa conmutable) y `movil` (una columna con pestañas). Devuelve la `ref` que
 * debe llevar el contenedor del editor.
 */
export function useDisposicionEditor() {
  const [nodo, setNodo] = useState<HTMLElement | null>(null);
  const [disposicion, setDisposicion] = useState<DisposicionEditor>("movil");
  useEffect(() => {
    if (!nodo) return;
    const medir = () => setDisposicion(disposicionPorAncho(nodo.clientWidth));
    medir();
    const obs = new ResizeObserver(medir);
    obs.observe(nodo);
    return () => obs.disconnect();
  }, [nodo]);
  return { ref: setNodo, disposicion };
}
