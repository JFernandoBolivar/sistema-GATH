import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

const { getDocumentos } = vi.hoisted(() => ({ getDocumentos: vi.fn() }));

vi.mock("../infrastructure/actions/familiares-actions", () => ({
  getDocumentosFamiliarAction: (...args: unknown[]) => getDocumentos(...args),
  subirDocumentoFamiliarAction: vi.fn(),
  reemplazarDocumentoFamiliarAction: vi.fn(),
}));

import { FamiliarDocumentosActualizacion } from "./familiar-documentos-actualizacion";

const DOCUMENTO = {
  id: 1,
  familiarId: 7,
  tipoDocumento: "cedula",
  rutaArchivo: "/api/v1/familiares/7/documentos/1/archivo/",
  fechaSubida: "2026-11-01T10:00:00Z",
  nombreArchivo: "cedula-familiar.pdf",
};

describe("FamiliarDocumentosActualizacion", () => {
  it("lista tipo, nombre y fecha, y permite ver el documento", async () => {
    getDocumentos.mockResolvedValue([DOCUMENTO]);

    render(<FamiliarDocumentosActualizacion familiarId={7} />);

    expect(await screen.findByText("Cédula del familiar")).toBeInTheDocument();
    expect(screen.getByText(/cedula-familiar\.pdf/)).toBeInTheDocument();
    expect(screen.getByText(/01\/11\/2026/)).toBeInTheDocument();

    const ver = screen.getByRole("link", { name: /ver/i });
    expect(ver).toHaveAttribute("href", "/api/v1/familiares/7/documentos/1/archivo/");
    expect(ver).toHaveAttribute("target", "_blank");
  });

  it("ofrece reemplazar y agregar documentos", async () => {
    getDocumentos.mockResolvedValue([DOCUMENTO]);

    render(<FamiliarDocumentosActualizacion familiarId={7} />);

    expect(await screen.findByRole("button", { name: /^reemplazar$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /reemplazar documento/i })).toBeDisabled();
    expect(screen.getByLabelText("Nueva versión del documento")).toHaveAttribute("type", "file");
  });

  it("con una cédula ya cargada avisa que se reemplazará", async () => {
    getDocumentos.mockResolvedValue([DOCUMENTO]);

    render(<FamiliarDocumentosActualizacion familiarId={7} />);

    expect(
      await screen.findByText("Ya hay una cédula cargada; se reemplazará."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reemplazar documento" })).toBeDisabled();
  });

  it("si el tipo elegido aún no tiene documento mantiene «Agregar documento»", async () => {
    getDocumentos.mockResolvedValue([]);

    render(<FamiliarDocumentosActualizacion familiarId={7} />);

    expect(
      await screen.findByText("No hay documentos registrados para este familiar."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/se reemplazará/i)).toBeNull();
    expect(screen.getByRole("button", { name: "Agregar documento" })).toBeDisabled();
  });

  it("al elegir un tipo que ya existe cambia a «Reemplazar documento» y avisa", async () => {
    getDocumentos.mockResolvedValue([
      { ...DOCUMENTO, id: 2, tipoDocumento: "partida_nacimiento", nombreArchivo: "partida.pdf" },
    ]);

    render(<FamiliarDocumentosActualizacion familiarId={7} />);

    await screen.findByText(/partida\.pdf/);
    expect(screen.getByRole("button", { name: "Agregar documento" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", { name: /partida de nacimiento/i }));

    expect(
      screen.getByText("Ya hay una partida de nacimiento cargada; se reemplazará."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reemplazar documento" })).toBeInTheDocument();
  });

  it("muestra el mensaje del servidor si no puede listar", async () => {
    getDocumentos.mockResolvedValue({ error: "No fue posible cargar los documentos." });

    render(<FamiliarDocumentosActualizacion familiarId={7} />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No fue posible cargar los documentos.",
    );
  });
});
