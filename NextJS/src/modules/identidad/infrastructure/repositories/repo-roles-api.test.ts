import { beforeEach, describe, expect, it, vi } from "vitest";

const { crearRol, actualizarRol } = vi.hoisted(() => ({
  crearRol: vi.fn(),
  actualizarRol: vi.fn(),
}));

vi.mock("../http/usuarios-api", () => ({
  usuariosApi: { crearRol, actualizarRol },
}));

import { repoRolesApi } from "./repo-roles-api";

const respuesta = { id: 1, nombre_rol: "X", nombre_visible: "X", descripcion_rol: "" };

describe("repoRolesApi (O43)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    crearRol.mockResolvedValue(respuesta);
    actualizarRol.mockResolvedValue(respuesta);
  });

  it("al crear envía el nombre visible y nunca el código", async () => {
    await repoRolesApi.crear({ nombreVisible: "Jefe de Recepción", descripcionRol: "" });

    expect(crearRol).toHaveBeenCalledWith({ nombre_visible: "Jefe de Recepción", descripcion_rol: "" });
    expect(Object.keys(crearRol.mock.calls[0][0])).not.toContain("nombre_rol");
  });

  it("al editar envía solo lo que cambió y nunca el código", async () => {
    await repoRolesApi.actualizar(3, { nombreVisible: "Recepción" });

    expect(actualizarRol).toHaveBeenCalledWith(3, { nombre_visible: "Recepción" });
  });
});
