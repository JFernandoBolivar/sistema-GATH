import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ElementoBiblioteca } from "../../../domain/entities/carnet";

const acciones = vi.hoisted(() => ({
  rasterizarFondoBibliotecaAction: vi.fn(),
}));
vi.mock("../../../infrastructure/actions/carnetizacion-actions", () => acciones);
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

import { DisenadorFondoPanel } from "./disenador-fondo-panel";

function medio(
  id: string,
  nombre: string,
  mime = "image/png",
): ElementoBiblioteca {
  return {
    id,
    nombre,
    categoria: "imagen",
    archivo_url: `/api/v1/carnetizacion/biblioteca/${id}/archivo/`,
    tamano_bytes: 10,
    mime_type: mime,
    ancho_px: 600,
    alto_px: 950,
    creado: "2026-01-01",
  };
}

const medios = [medio("m1", "Fondo institucional"), medio("pdf1", "Fondo PDF", "application/pdf")];

function montar(extra: Record<string, unknown> = {}) {
  const props = {
    cara: "anverso" as const,
    mediosBiblioteca: medios,
    onSeleccionarFondo: vi.fn(),
    onQuitarFondo: vi.fn(),
    ...extra,
  };
  render(<DisenadorFondoPanel {...props} />);
  return props;
}

describe("DisenadorFondoPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    acciones.rasterizarFondoBibliotecaAction.mockResolvedValue({
      success: true,
      data: medio("png-pdf", "Fondo PDF (fondo)"),
    });
  });

  it("sin fondo muestra el estado vacío y permite elegir una imagen de la biblioteca", () => {
    const props = montar();
    expect(screen.getByText(/Sin fondo/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Elegir de la biblioteca/ }));
    fireEvent.click(screen.getByText("Fondo institucional"));

    expect(props.onSeleccionarFondo).toHaveBeenCalledWith(
      "anverso",
      expect.objectContaining({
        biblioteca_id: "m1",
        nombre: "Fondo institucional",
        mime_type: "image/png",
        ancho_px: 600,
      }),
    );
  });

  it("con fondo muestra la miniatura y el nombre, y permite quitarlo", () => {
    const props = montar({
      fondo: { biblioteca_id: "m1", nombre: "Fondo institucional", mime_type: "image/png" },
    });

    expect(screen.getByText("Fondo institucional")).toBeInTheDocument();
    expect(screen.getByAltText("Fondo del anverso")).toHaveAttribute(
      "src",
      "/api/v1/carnetizacion/biblioteca/m1/archivo/",
    );

    fireEvent.click(screen.getByRole("button", { name: /Quitar fondo del anverso/ }));
    expect(props.onQuitarFondo).toHaveBeenCalledWith("anverso");
  });

  it("al elegir un PDF lo convierte a PNG y usa el medio convertido", async () => {
    const props = montar();

    fireEvent.click(screen.getByRole("button", { name: /Elegir de la biblioteca/ }));
    fireEvent.click(screen.getByText("Fondo PDF"));

    await waitFor(() =>
      expect(acciones.rasterizarFondoBibliotecaAction).toHaveBeenCalledWith("pdf1"),
    );
    await waitFor(() =>
      expect(props.onSeleccionarFondo).toHaveBeenCalledWith(
        "anverso",
        expect.objectContaining({ biblioteca_id: "png-pdf", mime_type: "image/png" }),
      ),
    );
  });

  it("muestra el error de carga de la biblioteca", () => {
    montar({ errorMedios: "No se pudo cargar la biblioteca de medios." });
    expect(screen.getByRole("alert")).toHaveTextContent("No se pudo cargar la biblioteca de medios.");
  });
});
