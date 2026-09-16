import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api-client", () => ({
  apiClient: vi.fn(),
  getAccessToken: vi.fn(),
}));

import { construirColumnasUsuarios } from "./usuarios-columns";
import { construirColumnasRoles } from "./roles-columns";

describe("Identidad PBAC Gating", () => {
  describe("construirColumnasUsuarios", () => {
    it("debe generar 7 columnas incluyendo columna de acciones", () => {
      const cols = construirColumnasUsuarios([], [], true, true, vi.fn(), vi.fn());
      expect(cols).toHaveLength(7);
      const colAcciones = cols.find((c) => c.id === "actions");
      expect(colAcciones).toBeDefined();
      expect(colAcciones?.header).toBe("Acciones");
    });

    it("debe generar columnas con puedeEditar=false y puedeDesactivar=false", () => {
      const cols = construirColumnasUsuarios([], [], false, false, vi.fn(), vi.fn());
      expect(cols).toHaveLength(7);
      const colAcciones = cols.find((c) => c.id === "actions");
      expect(colAcciones).toBeDefined();
    });
  });

  describe("construirColumnasRoles", () => {
    it("debe generar 4 columnas de roles", () => {
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
