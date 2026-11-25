import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SeccionDocumentosTrabajador } from "./seccion-documentos-trabajador";

const useDocumentosMock = vi.fn();
vi.mock("@/modules/documentos/ui/hooks/use-documentos-datos", () => ({
  useDocumentosBajoDemanda: (...args: unknown[]) => useDocumentosMock(...args),
}));
vi.mock("@/modules/documentos/ui/components/generar-documento-dialog", () => ({
  GenerarDocumentoDialog: ({ abierto }: { abierto: boolean }) =>
    abierto ? <div role="dialog" aria-label="Generar documento">Panel de generación</div> : null,
}));
vi.mock("@/modules/documentos/ui/components/lista-documentos-generados", () => ({
  ListaDocumentosGenerados: ({ documentos }: { documentos: { id: string; nombre: string }[] }) => (
    <ul>{documentos.map((d) => <li key={d.id}>{d.nombre}</li>)}</ul>
  ),
}));
vi.mock("@/modules/movimientos/infrastructure/actions/movimientos-actions", () => ({
  getHistorialPorEmpleadoAction: vi.fn(),
}));

const generado = {
  id: "doc-1",
  plantilla_id: "pl1",
  plantilla_codigo: "CONSTANCIA",
  plantilla_nombre: "Constancia de trabajo",
  proceso: "bajo_demanda",
  proceso_etiqueta: "Bajo demanda",
  version_numero: 2,
  pdf_sha256: "a".repeat(64),
  generado_en: "2026-11-20T10:00:00Z",
};

beforeEach(() => {
  useDocumentosMock.mockReset();
  useDocumentosMock.mockReturnValue({
    plantillas: [],
    generados: [generado],
    cargando: false,
    error: null,
    recargar: vi.fn(),
  });
});

describe("SeccionDocumentosTrabajador", () => {
  it("solo muestra la acción y los documentos con el permiso de generación", () => {
    const { rerender } = render(
      <SeccionDocumentosTrabajador cedula="V12345678" puedeGenerar={false} puedeVerMovimientos={false} />,
    );
    expect(screen.queryByRole("button", { name: "Generar documento" })).not.toBeInTheDocument();
    expect(screen.queryByText("Constancia de trabajo")).not.toBeInTheDocument();

    rerender(<SeccionDocumentosTrabajador cedula="V12345678" puedeGenerar puedeVerMovimientos={false} />);
    expect(screen.getByRole("button", { name: "Generar documento" })).toBeInTheDocument();
    expect(screen.getByText("Constancia de trabajo")).toBeInTheDocument();
    expect(useDocumentosMock).toHaveBeenLastCalledWith("V12345678", true);
  });

  it("abre el panel amigable de generación", () => {
    render(<SeccionDocumentosTrabajador cedula="V12345678" puedeGenerar puedeVerMovimientos={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Generar documento" }));
    expect(screen.getByRole("dialog", { name: "Generar documento" })).toBeInTheDocument();
  });

  it("maneja carga, vacío y error de los documentos del trabajador", () => {
    useDocumentosMock.mockReturnValueOnce({ plantillas: [], generados: [], cargando: true, error: null, recargar: vi.fn() });
    const { rerender } = render(
      <SeccionDocumentosTrabajador cedula="V12345678" puedeGenerar puedeVerMovimientos={false} />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Cargando documentos");

    useDocumentosMock.mockReturnValueOnce({ plantillas: [], generados: [], cargando: false, error: null, recargar: vi.fn() });
    rerender(<SeccionDocumentosTrabajador cedula="V12345678" puedeGenerar puedeVerMovimientos={false} />);
    expect(screen.getByTestId("sin-documentos-generados")).toBeInTheDocument();

    useDocumentosMock.mockReturnValueOnce({ plantillas: [], generados: [], cargando: false, error: "No se pudo cargar.", recargar: vi.fn() });
    rerender(<SeccionDocumentosTrabajador cedula="V12345678" puedeGenerar puedeVerMovimientos={false} />);
    expect(screen.getByRole("alert")).toHaveTextContent("No se pudo cargar");
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeInTheDocument();
  });
});
