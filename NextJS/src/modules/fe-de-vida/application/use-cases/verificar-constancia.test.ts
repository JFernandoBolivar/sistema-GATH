import { describe, expect, it, vi } from "vitest";
import type { ConstanciaVerificadaEntity } from "../../domain/entities/verificacion-constancia";
import type { RepoVerificacionConstancia } from "../../domain/ports/repo-verificacion-constancia";
import { verificarConstancia } from "./verificar-constancia";

const CODIGO = "a1".repeat(32);

export const constanciaFake = (
  extra: Partial<ConstanciaVerificadaEntity> = {},
): ConstanciaVerificadaEntity => ({
  numero: "FV-2026-000001",
  emitidaEn: "2026-11-02T12:00:00Z",
  procesoNombre: "Fe de vida 2026-2027",
  nombreCompleto: "MARIA PEREZ",
  cedula: "51***11",
  cedulaOculta: true,
  solicitudId: null,
  certificantes: [],
  ...extra,
});

const errorHttp = (status: number) => Object.assign(new Error("x"), { status });

function repoFake(sobre: Partial<RepoVerificacionConstancia> = {}): RepoVerificacionConstancia {
  return {
    verificarPublica: vi.fn().mockResolvedValue(constanciaFake()),
    verificarInterna: vi
      .fn()
      .mockResolvedValue(constanciaFake({ cedula: "5111111", cedulaOculta: false })),
    ...sobre,
  };
}

describe("verificarConstancia", () => {
  it("sin permiso usa solo el endpoint público", async () => {
    const repo = repoFake();
    const r = await verificarConstancia(repo, CODIGO, false);
    expect(r).toMatchObject({ tipo: "valida", interna: false });
    expect(repo.verificarInterna).not.toHaveBeenCalled();
  });

  it("con permiso usa la vista interna", async () => {
    const repo = repoFake();
    const r = await verificarConstancia(repo, CODIGO, true);
    expect(r).toMatchObject({ tipo: "valida", interna: true });
    expect(repo.verificarPublica).not.toHaveBeenCalled();
  });

  it("si la interna deniega (403) cae a la pública", async () => {
    const repo = repoFake({ verificarInterna: vi.fn().mockRejectedValue(errorHttp(403)) });
    const r = await verificarConstancia(repo, CODIGO, true);
    expect(r).toMatchObject({ tipo: "valida", interna: false });
  });

  it("un código mal formado es inválido y no consulta al servidor", async () => {
    const repo = repoFake();
    expect(await verificarConstancia(repo, "abc", true)).toEqual({ tipo: "invalida" });
    expect(repo.verificarPublica).not.toHaveBeenCalled();
    expect(repo.verificarInterna).not.toHaveBeenCalled();
  });

  it("404 es inválida; 429 y fallos son error con mensaje, sin lanzar", async () => {
    const r404 = repoFake({ verificarPublica: vi.fn().mockRejectedValue(errorHttp(404)) });
    expect(await verificarConstancia(r404, CODIGO, false)).toEqual({ tipo: "invalida" });
    const r429 = repoFake({ verificarPublica: vi.fn().mockRejectedValue(errorHttp(429)) });
    expect(await verificarConstancia(r429, CODIGO, false)).toMatchObject({
      tipo: "error",
      mensaje: expect.stringMatching(/demasiadas/i),
    });
    const r500 = repoFake({ verificarPublica: vi.fn().mockRejectedValue(new Error("boom")) });
    expect(await verificarConstancia(r500, CODIGO, false)).toMatchObject({ tipo: "error" });
  });
});
