import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { PasoFoto } from "./paso-foto";

// Mock de CapturaFoto
vi.mock("@/shared/components/captura-foto/captura-foto", () => ({
  CapturaFoto: () => <div data-testid="captura-foto-mock">CapturaFoto</div>,
}));

describe("PasoFoto", () => {
  it("muestra la ayuda para permisos de cámara y el mock de captura", () => {
    render(
      <PasoFoto
        fotoVigente={false}
        exigeNueva={false}
        fotoElegida={null}
        subiendo={false}
        onFoto={vi.fn()}
        onAtras={vi.fn()}
        onContinuar={vi.fn()}
      />,
    );

    expect(screen.getByText(/Foto con su cédula/i)).toBeInTheDocument();
    expect(screen.getByTestId("captura-foto-mock")).toBeInTheDocument();
    expect(screen.getByTestId("ayuda-permiso-camara")).toBeInTheDocument();
  });

  it("muestra aviso accesible cuando la foto fue recuperada del dispositivo", () => {
    const file = new File(["test"], "foto.jpg", { type: "image/jpeg" });
    render(
      <PasoFoto
        fotoVigente={false}
        exigeNueva={false}
        fotoElegida={file}
        subiendo={false}
        fotoRecuperadaLocal={true}
        onFoto={vi.fn()}
        onAtras={vi.fn()}
        onContinuar={vi.fn()}
      />,
    );

    expect(screen.getByText(/Foto recuperada de este dispositivo/i)).toBeInTheDocument();
  });

  it("muestra el mensaje de reintento/progreso cuando está subiendo", () => {
    render(
      <PasoFoto
        fotoVigente={false}
        exigeNueva={false}
        fotoElegida={null}
        subiendo={true}
        mensajeSubida="Reintentando subida (intento 2 de 3)…"
        onFoto={vi.fn()}
        onAtras={vi.fn()}
        onContinuar={vi.fn()}
      />,
    );

    expect(screen.getByText(/Reintentando subida \(intento 2 de 3\)…/i)).toBeInTheDocument();
  });
});
