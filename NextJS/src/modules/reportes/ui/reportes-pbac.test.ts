import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api-client", () => ({
  apiClient: vi.fn(),
  getAccessToken: vi.fn(),
}));

import { tienePermiso } from "@/shared/lib/evaluador-iam";

describe("Reportes PBAC Gating", () => {
  it("debe evaluar correctamente los permisos de reportes", () => {
    const permisosCompletos = [
      "reportes.ver",
      "reportes.generar_pdf",
      "reportes.generar_excel",
      "reportes.estadisticas",
    ];

    expect(tienePermiso(permisosCompletos, "reportes.ver")).toBe(true);
    expect(tienePermiso(permisosCompletos, "reportes.generar_pdf")).toBe(true);
    expect(tienePermiso(permisosCompletos, "reportes.generar_excel")).toBe(true);
    expect(tienePermiso(permisosCompletos, "reportes.estadisticas")).toBe(true);

    const permisosSoloLectura = ["reportes.ver"];

    expect(tienePermiso(permisosSoloLectura, "reportes.ver")).toBe(true);
    expect(tienePermiso(permisosSoloLectura, "reportes.generar_pdf")).toBe(false);
    expect(tienePermiso(permisosSoloLectura, "reportes.generar_excel")).toBe(false);
    expect(tienePermiso(permisosSoloLectura, "reportes.estadisticas")).toBe(false);
  });
});
