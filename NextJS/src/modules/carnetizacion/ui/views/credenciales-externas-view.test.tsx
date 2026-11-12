import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";

import CredencialesExternasView from "./credenciales-externas-view";

vi.mock("@/components/layout/page-layout", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("../../infrastructure/actions/credenciales-externas-actions", () => ({
  anularCredencialExternaAction: vi.fn(),
  crearCredencialExternaAction: vi.fn(),
  descargarCredencialPdfAction: vi.fn(),
  devolverCredencialExternaAction: vi.fn(),
  enviarCredencialExternaAction: vi.fn(),
  getCredencialesExternasAction: vi.fn().mockResolvedValue([]),
}));

vi.mock("../../infrastructure/actions/carnetizacion-actions", () => ({
  getTiposCredencialAction: vi.fn().mockResolvedValue([
    {
      codigo: "TEMPORAL_TRABAJADOR",
      nombre: "Credencial temporal de trabajador",
      descripcion: "",
      ancho_mm: 54,
      alto_mm: 86,
      orientacion: "vertical",
      grupo: "temporal",
      activo: true,
      orden: 1,
    },
  ]),
  buscarPersonalCarnetAction: vi.fn().mockResolvedValue([
    {
      id: 1,
      cedula: "18456789",
      nombre_completo: "BOLIVAR HERNANDEZ, JOSE",
      cargo: "Especialista en Seguridad",
      departamento: "Gerencia de Operaciones",
      codigo: "GATH-0042",
      correo: "jbolivar@conatel.gob.ve",
      telefono: "",
      total_solicitudes: 0,
      tiene_carnet: false,
    },
  ]),
}));

beforeAll(() => {
  // cmdk / radix necesitan estas APIs que jsdom no trae.
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  Element.prototype.scrollIntoView ??= () => {};
});

describe("Credencial temporal de trabajador", () => {
  it("con un solo tipo no muestra el select y al elegir trabajador aparece su tarjeta", async () => {
    render(<CredencialesExternasView grupo="temporal" />);

    await waitFor(() =>
      expect(screen.getByText("Credencial temporal de trabajador")).toBeTruthy(),
    );
    expect(document.getElementById("cred-tipo")).toBeNull();

    fireEvent.click(document.getElementById("cred-trabajador") as HTMLElement);
    fireEvent.change(screen.getByPlaceholderText("Buscar trabajador…"), {
      target: { value: "bolivar" },
    });
    const opcion = await screen.findByText("BOLIVAR HERNANDEZ, JOSE", {}, { timeout: 2000 });
    fireEvent.click(opcion);

    const tarjeta = await screen.findByTestId("tarjeta-trabajador");
    expect(tarjeta.textContent).toContain("BOLIVAR HERNANDEZ, JOSE");
    expect(tarjeta.textContent).toContain("18456789");
    expect(tarjeta.textContent).toContain("Especialista en Seguridad");
    expect(tarjeta.textContent).toContain("jbolivar@conatel.gob.ve");
  });
});
