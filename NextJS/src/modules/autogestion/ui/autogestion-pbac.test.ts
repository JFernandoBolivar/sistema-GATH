import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api-client", () => ({
  apiClient: vi.fn(),
  getAccessToken: vi.fn(),
}));

import { tienePermiso } from "@/shared/lib/evaluador-iam";

describe("Autogestion PBAC Gating", () => {
  it("debe evaluar correctamente los permisos de censo", () => {
    const permisosAdmin = [
      "autogestion.censo_ver_todos",
      "autogestion.censo_exportar",
      "autogestion.censo_actualizar_propio",
      "autogestion.censo_ver_propio",
    ];

    expect(tienePermiso(permisosAdmin, "autogestion.censo_ver_todos")).toBe(true);
    expect(tienePermiso(permisosAdmin, "autogestion.censo_exportar")).toBe(true);
    expect(tienePermiso(permisosAdmin, "autogestion.censo_actualizar_propio")).toBe(true);

    const permisosEmpleado = [
      "autogestion.censo_ver_propio",
      "autogestion.censo_actualizar_propio",
    ];

    expect(tienePermiso(permisosEmpleado, "autogestion.censo_ver_todos")).toBe(false);
    expect(tienePermiso(permisosEmpleado, "autogestion.censo_exportar")).toBe(false);
    expect(tienePermiso(permisosEmpleado, "autogestion.censo_actualizar_propio")).toBe(true);
  });
});
