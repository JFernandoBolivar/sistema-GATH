"use client";

import { useCallback, useState } from "react";

import type { PanelIzquierdo } from "../components/disenador/disenador-panel-nav-izquierdo";

/** Paneles del panel inferior (móvil). */
export type PanelMovil = "agregar" | "fondo" | "capas" | "propiedades" | "colores";

interface Opciones {
  /** Vista móvil (< 1024 px). */
  isMobile: boolean;
  /** Cambia la pestaña del inspector derecho (escritorio). */
  setTabInspector: (tab: "propiedades" | "colores") => void;
}

/**
 * Estado de UI de los paneles del diseñador: panel izquierdo (escritorio), panel
 * inferior (móvil) y la acción «mostrar Propiedades» que se dispara desde los
 * manejadores de selección (no desde un efecto), de modo que volver a tocar el
 * mismo elemento reabre el panel y cruzar el breakpoint no abre nada solo.
 */
export function useDisenadorPaneles({ isMobile, setTabInspector }: Opciones) {
  const [panelIzquierdo, setPanelIzquierdo] = useState<PanelIzquierdo>("capas");
  const [panelMovil, setPanelMovil] = useState<PanelMovil | null>(null);

  const mostrarPropiedades = useCallback(() => {
    setTabInspector("propiedades");
    if (isMobile) setPanelMovil("propiedades");
  }, [isMobile, setTabInspector]);

  return { panelIzquierdo, setPanelIzquierdo, panelMovil, setPanelMovil, mostrarPropiedades };
}
