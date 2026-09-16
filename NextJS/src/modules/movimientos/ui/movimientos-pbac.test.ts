import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api-client", () => ({
  apiClient: vi.fn(),
  getAccessToken: vi.fn(),
}));

import { construirColumnasMovimientos } from "./movimientos-columns";

describe("Movimientos PBAC Gating", () => {
  it("debe generar 10 columnas con puedeVer=true", () => {
    const cols = construirColumnasMovimientos(vi.fn(), true);
    expect(cols).toHaveLength(10);
    const colAcciones = cols.find((c) => c.id === "actions");
    expect(colAcciones).toBeDefined();
  });

  it("debe generar 10 columnas con puedeVer=false", () => {
    const cols = construirColumnasMovimientos(vi.fn(), false);
    expect(cols).toHaveLength(10);
    const colAcciones = cols.find((c) => c.id === "actions");
    expect(colAcciones).toBeDefined();
  });
});
