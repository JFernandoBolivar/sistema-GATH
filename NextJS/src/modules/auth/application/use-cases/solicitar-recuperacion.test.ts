import { describe, expect, it, vi } from "vitest";
import type { RepoAutenticacion } from "../../domain/ports/repo-auth";
import { solicitarRecuperacion } from "./solicitar-recuperacion";

function fakeRepo(overrides: Partial<RepoAutenticacion> = {}): RepoAutenticacion {
  return {
    iniciarSesion: vi.fn(),
    cerrarSesion: vi.fn(),
    cambiarPassword: vi.fn(),
    solicitarRecuperacion: vi.fn().mockResolvedValue("Instrucciones enviadas al correo institucional."),
    restablecerPassword: vi.fn(),
    ...overrides,
  };
}

describe("solicitarRecuperacion", () => {
  it("delega en repo.solicitarRecuperacion con identificador limpio", async () => {
    const repo = fakeRepo();
    const resultado = await solicitarRecuperacion(repo, "  usuario@conatel.gob.ve  ");

    expect(repo.solicitarRecuperacion).toHaveBeenCalledWith("usuario@conatel.gob.ve");
    expect(resultado).toBe("Instrucciones enviadas al correo institucional.");
  });

  it("rechaza identificador vacío sin llamar al repo", async () => {
    const repo = fakeRepo();
    await expect(solicitarRecuperacion(repo, "   ")).rejects.toThrow("El identificador es requerido.");
    expect(repo.solicitarRecuperacion).not.toHaveBeenCalled();
  });

  it("propaga errores emitidos por el repo", async () => {
    const repo = fakeRepo({
      solicitarRecuperacion: vi.fn().mockRejectedValue(new Error("Error de red")),
    });

    await expect(solicitarRecuperacion(repo, "V-12345678")).rejects.toThrow("Error de red");
  });
});
