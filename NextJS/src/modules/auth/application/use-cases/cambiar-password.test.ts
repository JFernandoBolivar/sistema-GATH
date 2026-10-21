import { describe, expect, it, vi } from "vitest";

import type { RepoAutenticacion } from "../../domain/ports/repo-auth";
import { cambiarPassword } from "./cambiar-password";

function fakeRepo(overrides: Partial<RepoAutenticacion> = {}): RepoAutenticacion {
  return {
    iniciarSesion: vi.fn(),
    cerrarSesion: vi.fn(),
    cambiarPassword: vi.fn().mockResolvedValue("Contraseña actualizada exitosamente."),
    solicitarRecuperacion: vi.fn(),
    restablecerPassword: vi.fn(),
    ...overrides,
  };
}

describe("cambiarPassword", () => {
  it("delega en repo.cambiarPassword con las contraseñas validadas y devuelve el mensaje", async () => {
    const repo = fakeRepo();

    const mensaje = await cambiarPassword(repo, {
      passwordActual: "Clave*Actual1",
      passwordNuevo: "Clave*Nueva12",
    });

    expect(repo.cambiarPassword).toHaveBeenCalledWith({
      passwordActual: "Clave*Actual1",
      passwordNuevo: "Clave*Nueva12",
    });
    expect(mensaje).toBe("Contraseña actualizada exitosamente.");
  });

  it("rechaza una contraseña actual vacía sin invocar al repositorio", async () => {
    const repo = fakeRepo();

    await expect(
      cambiarPassword(repo, { passwordActual: "", passwordNuevo: "Clave*Nueva12" }),
    ).rejects.toThrow();
    expect(repo.cambiarPassword).not.toHaveBeenCalled();
  });

  it("rechaza una contraseña nueva demasiado corta sin invocar al repositorio", async () => {
    const repo = fakeRepo();

    await expect(
      cambiarPassword(repo, { passwordActual: "Clave*Actual1", passwordNuevo: "corta" }),
    ).rejects.toThrow();
    expect(repo.cambiarPassword).not.toHaveBeenCalled();
  });

  it("propaga el error del repositorio cuando el backend rechaza el cambio", async () => {
    const repo = fakeRepo({
      cambiarPassword: vi.fn().mockRejectedValue(new Error("La contraseña actual es incorrecta")),
    });

    await expect(
      cambiarPassword(repo, { passwordActual: "Clave*Mala1", passwordNuevo: "Clave*Nueva12" }),
    ).rejects.toThrow("La contraseña actual es incorrecta");
  });
});
