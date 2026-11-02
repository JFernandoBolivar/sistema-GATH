import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api-client", () => ({
  apiClient: vi.fn(),
  getAccessToken: vi.fn(),
}));

import { construirColumnasCargos } from "./cargos-columns";

describe("construirColumnasCargos (PBAC Gating)", () => {
  it("debe generar 12 columnas incluyendo columna de acciones", () => {
    const columnas = construirColumnasCargos(true, vi.fn());
    expect(columnas).toHaveLength(12);
    const colAcciones = columnas.find((c) => c.id === "actions");
    expect(colAcciones).toBeDefined();
    expect(colAcciones?.header).toBe("Acciones");
  });

  it("debe generar columnas con puedeVerDetalle=false para usuarios sin permiso", () => {
    const onVerDetalle = vi.fn();
    const columnas = construirColumnasCargos(false, onVerDetalle);
    const colAcciones = columnas.find((c) => c.id === "actions");
    expect(colAcciones).toBeDefined();
  });
});
