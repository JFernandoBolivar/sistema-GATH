import { describe, expect, it, vi } from "vitest";

import type { RepoUsuarios } from "../../domain/ports/repo-usuarios";
import { guardarOverridesUsuario, obtenerMatrizPermisos } from "./gestionar-usuario";

const usuario = {
  id: 7,
  cedula: "12345678",
  nombres: "Ana",
  apellidos: "Pérez",
  correo: "ana@conatel.gob.ve",
  telefono: null,
  rolId: 2,
  rolNombre: "ANALISTA",
  isActive: true,
  ultimoAcceso: null,
  condicion: "ACTIVO",
  passwordInicialPendiente: false,
};

function fakeRepo(): RepoUsuarios {
  return {
    getAll: vi.fn(),
    obtenerDetalle: vi.fn().mockResolvedValue({
      usuario,
      permisos: {
        rolId: 2,
        rolNombre: "ANALISTA",
        delRol: ["identidad.ver_usuarios"],
        allow: [],
        deny: ["identidad.ver_usuarios"],
        efectivos: [],
        version: 2,
      },
    }),
    crear: vi.fn(),
    editar: vi.fn(),
    cambiarEstado: vi.fn(),
    restablecerAcceso: vi.fn(),
    cambiarCorreoAcceso: vi.fn(),
    guardarOverrides: vi.fn().mockResolvedValue({
      usuario,
      permisos: { rolId: 2, rolNombre: "ANALISTA", delRol: [], allow: [], deny: [], efectivos: [], version: 2 },
    }),
    matriz: vi.fn().mockResolvedValue({
      filas: [{ codigo: "identidad.ver_usuarios", nombre: "Ver usuarios", modulo: "identidad" }],
      roles: [{ rolId: 2, nombre: "ANALISTA", codigos: ["identidad.ver_usuarios"] }],
    }),
    guardarMatriz: vi.fn(),
    listarPermisos: vi.fn(),
  };
}

describe("guardarOverridesUsuario", () => {
  it("guarda allow/deny y devuelve el permiso efectivo recalculado por el servidor", async () => {
    const repo = fakeRepo();

    const detalle = await guardarOverridesUsuario(repo, 7, {
      allow: [],
      deny: ["identidad.ver_usuarios"],
      motivo: "Excepción temporal aprobada",
    });

    expect(repo.guardarOverrides).toHaveBeenCalledWith(7, {
      allow: [],
      deny: ["identidad.ver_usuarios"],
      motivo: "Excepción temporal aprobada",
    });
    expect(detalle.permisos.deny).toEqual(["identidad.ver_usuarios"]);
    expect(detalle.permisos.efectivos).toEqual([]);
  });
});

describe("obtenerMatrizPermisos", () => {
  it("mapea filas y columnas de la matriz a DTOs de la UI", async () => {
    const repo = fakeRepo();

    const matriz = await obtenerMatrizPermisos(repo);

    expect(matriz.filas[0]).toEqual({
      codigo: "identidad.ver_usuarios",
      nombre: "Ver usuarios",
      modulo: "identidad",
    });
    expect(matriz.roles[0]).toEqual({
      rolId: 2,
      nombre: "ANALISTA",
      codigos: ["identidad.ver_usuarios"],
    });
  });
});
