import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api-client", () => ({
  apiClient: vi.fn(),
  getAccessToken: vi.fn(),
}));

import { construirColumnasCarnets } from "./carnetizacion-columnas";

describe("construirColumnasCarnets (PBAC Gating)", () => {
  it("debe construir todas las columnas incluyendo columna de acciones", () => {
    const columnas = construirColumnasCarnets(vi.fn(), vi.fn(), vi.fn(), vi.fn());
    expect(columnas).toHaveLength(6);
    const colAcciones = columnas.find((c) => c.id === "actions");
    expect(colAcciones).toBeDefined();
    expect(colAcciones?.header).toBe("Acciones");
  });

  it("debe aceptar opciones de PBAC configuradas explícitamente", () => {
    const columnas = construirColumnasCarnets(vi.fn(), vi.fn(), vi.fn(), vi.fn(), {
      puedeDisenar: false,
      puedeDescargar: false,
      puedeRevocar: false,
    });
    expect(columnas).toHaveLength(6);
    const colAcciones = columnas.find((c) => c.id === "actions");
    expect(colAcciones).toBeDefined();
  });
});
