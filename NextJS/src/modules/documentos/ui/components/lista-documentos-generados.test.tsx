import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ListaDocumentosGenerados } from "./lista-documentos-generados";

const descargarMock = vi.fn();
vi.mock("../hooks/use-descargar-documento", () => ({
  useDescargarDocumento: () => ({ descargando: null, descargar: descargarMock }),
}));

describe("ListaDocumentosGenerados", () => {
  it("muestra proceso, versión y fecha, y descarga el documento elegido", () => {
    descargarMock.mockReset();
    render(
      <ListaDocumentosGenerados
        documentos={[{
          id: "doc-1",
          nombre: "Constancia de trabajo",
          proceso: "Bajo demanda",
          version: 2,
          fecha: "2026-11-20T10:00:00Z",
        }]}
      />,
    );
    expect(screen.getByText("Constancia de trabajo")).toBeInTheDocument();
    expect(screen.getByText("Bajo demanda")).toBeInTheDocument();
    expect(screen.getByText("Versión 2")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Descargar Constancia de trabajo" }));
    expect(descargarMock).toHaveBeenCalledWith("doc-1", "Constancia de trabajo");
  });
});
