import { describe, expect, it, vi } from "vitest";

import type { RepoAutenticacion } from "../../domain/ports/repo-auth";
import { cerrarSesion } from "./cerrar-sesion";

function fakeRepo(overrides: Partial<RepoAutenticacion> = {}): RepoAutenticacion {
  return {
    iniciarSesion: vi.fn(),
    cerrarSesion: vi.fn().mockResolvedValue(undefined),
    cambiarPassword: vi.fn(),
    ...overrides,
  };
}

describe("cerrarSesion", () => {
  it("delega en repo.cerrarSesion", async () => {
    const repo = fakeRepo();

    await cerrarSesion(repo);

    expect(repo.cerrarSesion).toHaveBeenCalledTimes(1);
  });

  it("propaga el error del repositorio si el repo decide lanzar", async () => {
    const repo = fakeRepo({
      cerrarSesion: vi.fn().mockRejectedValue(new Error("fallo inesperado")),
    });

    await expect(cerrarSesion(repo)).rejects.toThrow("fallo inesperado");
  });
});
