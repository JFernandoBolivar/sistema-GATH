"use client";

import { useEffect } from "react";

export const MENSAJE_CAMBIOS_SIN_GUARDAR =
  "Hay cambios sin guardar en la plantilla. Si sale ahora se perderán.";

/**
 * Avisa antes de abandonar la página con cambios sin guardar: cierre o recarga de la
 * pestaña (`beforeunload`) y clics en enlaces internos (menú lateral, migas), que en Next
 * no disparan `beforeunload`.
 */
export function useAvisoCambios(hayCambios: boolean) {
  useEffect(() => {
    if (!hayCambios) return;
    const antesDeSalir = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    const alHacerClic = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const ancla = (e.target as HTMLElement | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!ancla || ancla.target === "_blank" || ancla.hasAttribute("download")) return;
      const url = new URL(ancla.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      if (!window.confirm(MENSAJE_CAMBIOS_SIN_GUARDAR)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", antesDeSalir);
    document.addEventListener("click", alHacerClic, true);
    return () => {
      window.removeEventListener("beforeunload", antesDeSalir);
      document.removeEventListener("click", alHacerClic, true);
    };
  }, [hayCambios]);
}
