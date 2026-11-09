import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api-client", () => ({
  apiClient: vi.fn(),
  getAccessToken: vi.fn(),
}));

import { construirColumnasRoles } from "./roles-columns";

describe("Identidad PBAC Gating", () => {
  describe("construirColumnasRoles", () => {
    it("debe generar 4 columnas de roles (nombre visible y código, sin ID visible)", () => {
      const cols = construirColumnasRoles(true, true, vi.fn(), vi.fn());
      expect(cols).toHaveLength(4);
      const colAcciones = cols.find((c) => c.id === "actions");
      expect(colAcciones).toBeDefined();
    });

    it("debe permitir flags restrictivos en roles", () => {
      const cols = construirColumnasRoles(false, false, vi.fn(), vi.fn());
      expect(cols).toHaveLength(4);
    });
  });
});
