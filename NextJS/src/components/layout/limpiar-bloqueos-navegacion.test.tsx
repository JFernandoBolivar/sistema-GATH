import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  usePathname: () => "/personal",
}));

import { LimpiarBloqueosNavegacion } from "./limpiar-bloqueos-navegacion";

function reiniciarCuerpo() {
  document.body.style.pointerEvents = "";
  document.body.style.overflow = "";
  document.body.removeAttribute("data-scroll-locked");
}

describe("LimpiarBloqueosNavegacion", () => {
  afterEach(() => {
    vi.useRealTimers();
    reiniciarCuerpo();
  });

  it("limpia el bloqueo residual cuando ya no hay overlays abiertos", () => {
    vi.useFakeTimers();
    document.body.style.pointerEvents = "none";
    document.body.setAttribute("data-scroll-locked", "1");
    document.body.style.overflow = "hidden";

    render(<LimpiarBloqueosNavegacion />);
    vi.advanceTimersByTime(0);

    expect(document.body.style.pointerEvents).toBe("");
    expect(document.body.style.overflow).toBe("");
    expect(document.body.hasAttribute("data-scroll-locked")).toBe(false);
  });

  it("no desbloquea la página mientras el menu movil sigue abierto", () => {
    vi.useFakeTimers();
    document.body.style.pointerEvents = "none";
    const menu = document.createElement("div");
    menu.setAttribute("data-slot", "sidebar");
    menu.setAttribute("data-mobile", "true");
    menu.setAttribute("data-state", "open");
    document.body.appendChild(menu);

    render(<LimpiarBloqueosNavegacion />);
    vi.advanceTimersByTime(1_600);

    expect(document.body.style.pointerEvents).toBe("none");
    menu.remove();
  });
});
