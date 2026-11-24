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

/** `ancho` ≥ 1280 px (3 columnas), `medio` ≥ 1024 px (2 columnas), `movil` (una columna con pestañas). */
export function useDisposicionEditor(): DisposicionEditor {
  const ancho = useMediaQuery("(min-width: 1280px)");
  const medio = useMediaQuery("(min-width: 1024px)");
  return ancho ? "ancho" : medio ? "medio" : "movil";
}
