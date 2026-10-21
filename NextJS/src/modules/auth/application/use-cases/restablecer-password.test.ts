import { describe, expect, it, vi } from "vitest";
import type { RepoAutenticacion } from "../../domain/ports/repo-auth";
import { restablecerPassword } from "./restablecer-password";

function fakeRepo(overrides: Partial<RepoAutenticacion> = {}): RepoAutenticacion {
  return {
    iniciarSesion: vi.fn(),
    cerrarSesion: vi.fn(),
    cambiarPassword: vi.fn(),
    solicitarRecuperacion: vi.fn(),
    restablecerPassword: vi.fn().mockResolvedValue("Contraseña restablecida exitosamente."),
    ...overrides,
  };
}

describe("restablecerPassword", () => {
  it("delega en repo.restablecerPassword con payload válido", async () => {
    const repo = fakeRepo();
    const payload = {
      token: "token-seguro-123",
      passwordNuevo: "NuevaClave*2026",
      passwordConfirmacion: "NuevaClave*2026",
    };

    const resultado = await restablecerPassword(repo, payload);

    expect(repo.restablecerPassword).toHaveBeenCalledWith(payload);
    expect(resultado).toBe("Contraseña restablecida exitosamente.");
  });

  it("rechaza si falta el token sin invocar repo", async () => {
    const repo = fakeRepo();
    await expect(
      restablecerPassword(repo, {
        token: "",
        passwordNuevo: "NuevaClave*2026",
        passwordConfirmacion: "NuevaClave*2026",
      }),
    ).rejects.toThrow("El token de recuperación es requerido.");
    expect(repo.restablecerPassword).not.toHaveBeenCalled();
  });

  it("rechaza si las contraseñas difieren sin invocar repo", async () => {
    const repo = fakeRepo();
    await expect(
      restablecerPassword(repo, {
        token: "token-valido",
        passwordNuevo: "Clave123*",
        passwordConfirmacion: "Diferente123*",
      }),
    ).rejects.toThrow("Las contraseñas no coinciden.");
    expect(repo.restablecerPassword).not.toHaveBeenCalled();
  });
});
