import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

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

    expect(await screen.findByRole("button", { name: /reemplazar/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^agregar$/i })).toBeDisabled();
    expect(screen.getByLabelText("Nueva versión del documento")).toHaveAttribute("type", "file");
  });

  it("muestra el mensaje del servidor si no puede listar", async () => {
    getDocumentos.mockResolvedValue({ error: "No fue posible cargar los documentos." });

    render(<FamiliarDocumentosActualizacion familiarId={7} />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No fue posible cargar los documentos.",
    );
  });
});
