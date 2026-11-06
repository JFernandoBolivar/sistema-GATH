import { describe, expect, it } from "vitest";

import type { RolEntity } from "../../domain/entities/rol-entity";
import type { RepoRoles } from "../../domain/ports/repo-roles";
import { listarRoles } from "./gestionar-roles";

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
        descripcionRol: "",
        nUsuarios: 8,
        nPermisos: 117,
      },
      {
        id: 3,
        nombreRol: "AUTOGESTION",
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
        descripcionRol: "",
        nUsuarios: 8,
        nPermisos: 117,
      },
      {
        id: 3,
        nombreRol: "AUTOGESTION",
        descripcionRol: "Personal activo",
        nUsuarios: 986,
        nPermisos: 11,
      },
    ]);
  });
});
