import { describe, expect, it, vi } from "vitest";

import type { RepoAutenticacion } from "../../domain/ports/repo-auth";
import { iniciarSesion } from "./iniciar-sesion";

function fakeRepo(overrides: Partial<RepoAutenticacion> = {}): RepoAutenticacion {
  return {
    iniciarSesion: vi
      .fn()
      .mockResolvedValue({
        usuarioId: 7,
        nombreCompleto: "Ana Pérez",
        rol: { id: 2, nombre: "Analista" },
        permisos: [{ id: 1, code: "identidad.listar", name: "Listar usuarios" }],
      }),
    cerrarSesion: vi.fn(),
    cambiarPassword: vi.fn(),
    solicitarRecuperacion: vi.fn(),
    restablecerPassword: vi.fn(),
    ...overrides,
  };
}

describe("iniciarSesion", () => {
  it("delega en repo.iniciarSesion con credenciales normalizadas y devuelve el DTO", async () => {
    const repo = fakeRepo();

    const result = await iniciarSesion(repo, {
      usuario: "  Ana.Perez@Conatel.gob.ve ",
      password: "Clave*Segura1",
    });

    expect(repo.iniciarSesion).toHaveBeenCalledWith({
      usuario: "ana.perez@conatel.gob.ve",
      password: "Clave*Segura1",
    });
    expect(result).toEqual({
      usuarioId: 7,
      nombreCompleto: "Ana Pérez",
      rolId: 2,
      rolNombre: "Analista",
      permisos: [{ id: 1, code: "identidad.listar", name: "Listar usuarios" }],
    });
  });

  it("rechaza un usuario con formato inválido sin invocar al repositorio", async () => {
    const repo = fakeRepo();

    await expect(
      iniciarSesion(repo, { usuario: "no-es-correo", password: "Clave*Segura1" }),
    ).rejects.toThrow();
    expect(repo.iniciarSesion).not.toHaveBeenCalled();
  });

  it("rechaza una contraseña corta sin invocar al repositorio", async () => {
    const repo = fakeRepo();

    await expect(
      iniciarSesion(repo, { usuario: "ana@conatel.gob.ve", password: "corta" }),
    ).rejects.toThrow();
    expect(repo.iniciarSesion).not.toHaveBeenCalled();
  });

  it("propaga el error del repositorio cuando la autenticación falla", async () => {
    const repo = fakeRepo({
      iniciarSesion: vi.fn().mockRejectedValue(new Error("Credenciales incorrectas")),
    });

    await expect(
      iniciarSesion(repo, { usuario: "ana@conatel.gob.ve", password: "Mala*Clave9" }),
    ).rejects.toThrow("Credenciales incorrectas");
  });
});
