import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api-client", () => ({
  apiClient: vi.fn(),
  getAccessToken: vi.fn(),
}));

import { construirColumnasCatalogo } from "./catalogos-columns";

describe("construirColumnasCatalogo (PBAC Gating)", () => {
  it("debe incluir columna de acciones cuando el usuario puede editar", () => {
    const columnas = construirColumnasCatalogo("organismos-adscritos", true, false, vi.fn(), vi.fn());
    expect(columnas).toHaveLength(3);
    const colAcciones = columnas.find((c) => c.id === "actions");
    expect(colAcciones).toBeDefined();
    expect(colAcciones?.header).toBe("Acciones");
  });

  it("debe incluir columna de acciones cuando el usuario puede eliminar", () => {
    const columnas = construirColumnasCatalogo("alergias", false, true, vi.fn(), vi.fn());
    expect(columnas).toHaveLength(3);
    const colAcciones = columnas.find((c) => c.id === "actions");
    expect(colAcciones).toBeDefined();
  });

  it("no debe incluir columna de acciones cuando no puede editar ni eliminar", () => {
    const columnas = construirColumnasCatalogo("alergias", false, false, vi.fn(), vi.fn());
    expect(columnas).toHaveLength(2);
    const colAcciones = columnas.find((c) => c.id === "actions");
    expect(colAcciones).toBeUndefined();
  });
});
