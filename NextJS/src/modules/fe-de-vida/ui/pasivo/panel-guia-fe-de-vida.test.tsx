import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  PanelGuiaFeDeVida,
  PASOS_GUIA,
} from "./panel-guia-fe-de-vida";

describe("PanelGuiaFeDeVida", () => {
  it("contiene los 5 pasos canónicos de la fe de vida", () => {
    expect(PASOS_GUIA).toHaveLength(5);
    expect(PASOS_GUIA[0].titulo).toContain("Ingreso");
    expect(PASOS_GUIA[1].titulo).toContain("Verificación");
    expect(PASOS_GUIA[2].titulo).toContain("Foto");
    expect(PASOS_GUIA[3].titulo).toContain("Envío");
    expect(PASOS_GUIA[4].titulo).toContain("Notificación");
  });

  it("renderiza el panel abierto con los 5 pasos y su descripción accesible", () => {
    const handleOpenChange = vi.fn();
    render(
      <PanelGuiaFeDeVida
        abierto={true}
        onOpenChange={handleOpenChange}
        pasoActual={1}
      />,
    );

    expect(screen.getByRole("heading", { name: /guía de fe de vida/i })).toBeInTheDocument();
    expect(screen.getByText(/Ingreso a la plataforma/i)).toBeInTheDocument();
    expect(screen.getByText(/Verificación de datos/i)).toBeInTheDocument();
    expect(screen.getByText(/Foto y documentos/i)).toBeInTheDocument();
    expect(screen.getByText(/Envío y confirmación/i)).toBeInTheDocument();
    expect(screen.getByText(/Notificación y certificado/i)).toBeInTheDocument();
  });

  it("resalta correctamente el paso actual con aria-current e insignia", () => {
    const handleOpenChange = vi.fn();
    render(
      <PanelGuiaFeDeVida
        abierto={true}
        onOpenChange={handleOpenChange}
        pasoActual={3}
      />,
    );

    const items = screen.getAllByRole("listitem");
    // El paso 3 (índice 2) debe tener aria-current="step"
    const paso3 = items.find((el) => el.getAttribute("aria-current") === "step");
    expect(paso3).toBeDefined();
    expect(paso3).toHaveTextContent(/Foto y documentos/i);
    expect(paso3).toHaveTextContent(/Paso actual/i);

    // Los demás no deben tener aria-current
    const paso1 = items.find((el) => el.textContent?.includes("Ingreso a la plataforma"));
    expect(paso1?.getAttribute("aria-current")).toBeNull();
  });

  it("muestra pautas de fotografía en el paso 3 (qué hacer y qué evitar)", () => {
    render(
      <PanelGuiaFeDeVida
        abierto={true}
        onOpenChange={vi.fn()}
        pasoActual={3}
      />,
    );

    expect(screen.getByText(/Rostro descubierto y mirando a la cámara/i)).toBeInTheDocument();
    expect(screen.getByText(/Cédula visible, nítida y legible/i)).toBeInTheDocument();
    expect(screen.getByText(/No use lentes oscuros, gorras, sombreros/i)).toBeInTheDocument();
    expect(screen.getByText(/Evite reflejos o brillos/i)).toBeInTheDocument();
  });

  it("el botón 'Entendido' permite cerrar el panel", async () => {
    const user = userEvent.setup();
    const handleOpenChange = vi.fn();
    render(
      <PanelGuiaFeDeVida
        abierto={true}
        onOpenChange={handleOpenChange}
        pasoActual={2}
      />,
    );

    const botonCerrar = screen.getByRole("button", { name: /entendido/i });
    await user.click(botonCerrar);
    expect(handleOpenChange).toHaveBeenCalledWith(false);
  });
});
