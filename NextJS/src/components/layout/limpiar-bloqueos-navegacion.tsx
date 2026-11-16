"use client";

/**
 * Red de seguridad para el bloqueo táctil que deja Radix al navegar con varios
 * overlays abiertos (el menú móvil y un desplegable anidado dentro de él).
 *
 * `@radix-ui/react-dismissable-layer` pone `pointer-events: none` en el body
 * mientras hay una capa modal y lo restaura al desmontarse. En el bundle de
 * producción conviven dos copias del módulo (una para el Dialog/Sheet y otra
 * para el DropdownMenu), cada una con su propio valor "original": si la copia
 * del desplegable se desmonta después del Sheet, restaura el `none` que vio al
 * abrirse y toda la página queda sin recibir toques hasta recargar.
 *
 * Al cambiar de ruta, si ya no queda ningún overlay abierto, se limpia ese
 * estado residual. Se revisa varias veces porque el desplegable se desmonta al
 * terminar su animación de salida, más tarde que el cambio de ruta.
 */

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const SELECTOR_OVERLAY_ABIERTO = [
  '[data-slot="sidebar"][data-mobile="true"][data-state="open"]',
  '[data-slot="sheet-content"][data-state="open"]',
  '[data-slot="dialog-content"][data-state="open"]',
  '[data-slot="alert-dialog-content"][data-state="open"]',
  '[data-slot="drawer-content"][data-state="open"]',
  '[data-vaul-drawer][data-state="open"]',
  '[role="dialog"][data-state="open"]',
  '[role="alertdialog"][data-state="open"]',
  '[data-slot="dropdown-menu-content"][data-state="open"]',
  '[data-slot="select-content"][data-state="open"]',
  '[data-slot="popover-content"][data-state="open"]',
  '[data-slot="context-menu-content"][data-state="open"]',
].join(",");

function limpiarBloqueoResidual() {
  if (typeof document === "undefined") return;
  const body = document.body;
  const bloqueado =
    body.style.pointerEvents === "none" ||
    body.hasAttribute("data-scroll-locked") ||
    body.style.overflow === "hidden";
  if (!bloqueado) return;
  if (document.querySelector(SELECTOR_OVERLAY_ABIERTO)) return;

  body.style.pointerEvents = "";
  body.style.overflow = "";
  body.removeAttribute("data-scroll-locked");
}

export function LimpiarBloqueosNavegacion() {
  const pathname = usePathname();

  useEffect(() => {
    const tiempos = [0, 250, 700, 1500].map((ms) => window.setTimeout(limpiarBloqueoResidual, ms));
    return () => tiempos.forEach((id) => window.clearTimeout(id));
  }, [pathname]);

  useEffect(() => {
    // Safari/iOS puede restaurar la página desde la caché (bfcache) con los
    // estilos que tenía al salir; si salió con un overlay abierto, vuelve
    // bloqueada. `pageshow` también se dispara en la primera carga.
    window.addEventListener("pageshow", limpiarBloqueoResidual);
    return () => window.removeEventListener("pageshow", limpiarBloqueoResidual);
  }, []);

  return null;
}
