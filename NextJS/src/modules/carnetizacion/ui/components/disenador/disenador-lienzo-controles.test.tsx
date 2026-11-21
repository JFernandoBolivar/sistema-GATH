/**
 * Pruebas para:
 * 1. La función pura `calcularEscalaAjuste` (cálculo de escala de ajuste).
 * 2. El componente `DisenadorLienzoControles` (botones de zoom).
 * 3. El componente `DisenadorPanelNavIzquierdo` (cambio de panel).
 */
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  calcularEscalaAjuste,
  DisenadorLienzoControles,
} from "./disenador-lienzo-controles";
import {
  DisenadorPanelNavIzquierdo,
  type PanelIzquierdo,
} from "./disenador-panel-nav-izquierdo";


// ─── calcularEscalaAjuste (función pura) ───────────────────────────────────────
describe("calcularEscalaAjuste", () => {
  it("ajusta al ancho si el contenedor es más ancho que el carnet", () => {
    // Contenedor 400×600, carnet 54×85.6 mm, margen 32 px
    // escalaH = (400-64)/54 ≈ 6.22; escalaV = (600-64)/85.6 ≈ 6.26 → min ≈ 6.22
    const escala = calcularEscalaAjuste(400, 600, 54, 85.6, 32);
    expect(escala).toBeCloseTo((400 - 64) / 54, 1);
  });

  it("ajusta al alto si el contenedor es más alto que el carnet en px/mm", () => {
    // Contenedor 300×200 con carnet 54×85.6 mm
    // escalaH = (300-64)/54 ≈ 4.37; escalaV = (200-64)/85.6 ≈ 1.59 → min = 1.59
    const escala = calcularEscalaAjuste(300, 200, 54, 85.6, 32);
    expect(escala).toBeCloseTo((200 - 64) / 85.6, 1);
  });

  it("no baja del límite mínimo de 1.5", () => {
    // Contenedor muy pequeño
    const escala = calcularEscalaAjuste(50, 50, 54, 85.6, 32);
    expect(escala).toBe(1.5);
  });

  it("no sube del límite máximo de 12", () => {
    // Contenedor enorme
    const escala = calcularEscalaAjuste(10000, 10000, 54, 85.6, 32);
    expect(escala).toBe(12);
  });

  it("devuelve la escala base si las dimensiones son inválidas", () => {
    const escala = calcularEscalaAjuste(0, 0, 54, 85.6, 32);
    expect(escala).toBe(4.2); // ESCALA_BASE
  });
});

// ─── DisenadorLienzoControles ──────────────────────────────────────────────────
describe("DisenadorLienzoControles", () => {
  it("muestra el porcentaje relativo a 4.2 px/mm", () => {
    render(
      <DisenadorLienzoControles
        escala={4.2}
        onCambiarEscala={vi.fn()}
        onAjustar={vi.fn()}
      />,
    );
    expect(screen.getByText("100%")).toBeInTheDocument();
  });

  it("llama a onCambiarEscala al hacer clic en Acercar", () => {
    const fn = vi.fn();
    render(
      <DisenadorLienzoControles
        escala={4.2}
        onCambiarEscala={fn}
        onAjustar={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /acercar zoom/i }));
    expect(fn).toHaveBeenCalledOnce();
  });

  it("llama a onCambiarEscala al hacer clic en Alejar", () => {
    const fn = vi.fn();
    render(
      <DisenadorLienzoControles
        escala={4.2}
        onCambiarEscala={fn}
        onAjustar={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /alejar zoom/i }));
    expect(fn).toHaveBeenCalledOnce();
  });

  it("deshabilita Alejar cuando ya está en el mínimo", () => {
    render(
      <DisenadorLienzoControles
        escala={1.5}
        onCambiarEscala={vi.fn()}
        onAjustar={vi.fn()}
        minEscala={1.5}
      />,
    );
    expect(screen.getByRole("button", { name: /alejar zoom/i })).toBeDisabled();
  });

  it("deshabilita Acercar cuando ya está en el máximo", () => {
    render(
      <DisenadorLienzoControles
        escala={12}
        onCambiarEscala={vi.fn()}
        onAjustar={vi.fn()}
        maxEscala={12}
      />,
    );
    expect(screen.getByRole("button", { name: /acercar zoom/i })).toBeDisabled();
  });

  it("llama a onAjustar (y no a onCambiarEscala) al pulsar Ajustar", () => {
    const alAjustar = vi.fn();
    const alCambiar = vi.fn();
    render(
      <DisenadorLienzoControles escala={6.0} onCambiarEscala={alCambiar} onAjustar={alAjustar} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /ajustar lienzo/i }));
    expect(alAjustar).toHaveBeenCalledOnce();
    expect(alCambiar).not.toHaveBeenCalled();
  });

  it("expone un grupo accesible y el porcentaje como status", () => {
    render(
      <DisenadorLienzoControles escala={4.2} onCambiarEscala={vi.fn()} onAjustar={vi.fn()} />,
    );
    expect(screen.getByRole("group", { name: /controles de zoom/i })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("100%");
  });
});

// ─── DisenadorPanelNavIzquierdo ────────────────────────────────────────────────
describe("DisenadorPanelNavIzquierdo", () => {
  it("renderiza los tres botones de panel con aria-label correcto", () => {
    render(
      <DisenadorPanelNavIzquierdo panelActivo="capas" onCambiarPanel={vi.fn()} />,
    );
    expect(
      screen.getByRole("button", { name: /panel de herramientas para agregar elementos/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /panel de fondo del carnet/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /panel de capas del carnet/i }),
    ).toBeInTheDocument();
  });

  it("el panel activo tiene aria-pressed=true y los demás false", () => {
    render(
      <DisenadorPanelNavIzquierdo panelActivo="fondo" onCambiarPanel={vi.fn()} />,
    );
    expect(
      screen.getByRole("button", { name: /panel de fondo del carnet/i }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByRole("button", { name: /panel de capas del carnet/i }),
    ).toHaveAttribute("aria-pressed", "false");
  });

  it("llama a onCambiarPanel con el ID correcto al hacer clic", () => {
    const fn = vi.fn();
    render(<DisenadorPanelNavIzquierdo panelActivo="capas" onCambiarPanel={fn} />);
    fireEvent.click(
      screen.getByRole("button", { name: /panel de herramientas para agregar elementos/i }),
    );
    expect(fn).toHaveBeenCalledWith("agregar" as PanelIzquierdo);
  });

  it("navegar de Capas a Fondo y luego a Agregar actualiza el panel activo", () => {
    let activo: PanelIzquierdo = "capas";
    const { rerender } = render(
      <DisenadorPanelNavIzquierdo
        panelActivo={activo}
        onCambiarPanel={(p) => {
          activo = p;
        }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /panel de fondo del carnet/i }));
    rerender(
      <DisenadorPanelNavIzquierdo
        panelActivo={activo}
        onCambiarPanel={(p) => {
          activo = p;
        }}
      />,
    );
    expect(activo).toBe("fondo");
    expect(
      screen.getByRole("button", { name: /panel de fondo del carnet/i }),
    ).toHaveAttribute("aria-pressed", "true");
  });
});
