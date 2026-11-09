import { describe, expect, it, vi } from "vitest";

import type { RolEntity } from "../../domain/entities/rol-entity";
import type { RepoRoles, RolCrearInput } from "../../domain/ports/repo-roles";
import { actualizarRol, crearRol, listarRoles } from "./gestionar-roles";

function repoCon(roles: RolEntity[]): RepoRoles {
  return {
    listar: async () => roles,
    crear: async () => roles[0],
    actualizar: async () => roles[0],
    eliminar: async () => undefined,
  };
}

describe("listarRoles", () => {
  it("conserva usuarios y permisos por rol que devuelve el backend", async () => {
    const roles: RolEntity[] = [
      {
        id: 1,
        nombreRol: "ADMINISTRADOR",
        nombreVisible: "Administrador",
        descripcionRol: "",
        nUsuarios: 8,
        nPermisos: 117,
      },
      {
        id: 3,
        nombreRol: "AUTOGESTION",
        nombreVisible: "Autogestión",
        descripcionRol: "Personal activo",
        nUsuarios: 986,
        nPermisos: 11,
      },
    ];

    const resultado = await listarRoles(repoCon(roles));

    expect(resultado).toEqual([
      {
        id: 1,
        nombreRol: "ADMINISTRADOR",
        nombreVisible: "Administrador",
        descripcionRol: "",
        nUsuarios: 8,
        nPermisos: 117,
      },
      {
        id: 3,
        nombreRol: "AUTOGESTION",
        nombreVisible: "Autogestión",
        descripcionRol: "Personal activo",
        nUsuarios: 986,
        nPermisos: 11,
      },
    ]);
  });
});

describe("crear y actualizar rol (O43)", () => {
  const rol: RolEntity = {
    id: 5,
    nombreRol: "ANALISTA_BIENESTAR",
    nombreVisible: "Analista de Bienestar",
    descripcionRol: "",
    nUsuarios: 0,
    nPermisos: 0,
  };

  it("crea el rol enviando solo el nombre visible; el código lo genera el servidor", async () => {
    const crear = vi.fn(async (_entrada: RolCrearInput) => rol);
    const repo = { ...repoCon([rol]), crear };

    const dto = await crearRol(repo, { nombreVisible: "Analista de Bienestar" });

    expect(crear).toHaveBeenCalledWith({ nombreVisible: "Analista de Bienestar", descripcionRol: "" });
    expect(Object.keys(crear.mock.calls[0]?.[0] ?? {})).not.toContain("nombreRol");
    expect(dto.nombreRol).toBe("ANALISTA_BIENESTAR");
    expect(dto.nombreVisible).toBe("Analista de Bienestar");
  });

  it("al actualizar no envía el código y no toca la descripción si no se pidió", async () => {
    const actualizar = vi.fn(async () => rol);
    const repo = { ...repoCon([rol]), actualizar };

    await actualizarRol(repo, 5, { nombreVisible: "Analista Social" });

    expect(actualizar).toHaveBeenCalledWith(5, { nombreVisible: "Analista Social" });
  });
});
