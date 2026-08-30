import { describe, expect, it, vi } from "vitest";

import type { RepoUsuarios } from "../../domain/ports/repo-usuarios";
import { listarUsuarios } from "./listar-usuarios";

function fakeRepo(rows: Awaited<ReturnType<RepoUsuarios["getAll"]>> = []): RepoUsuarios {
  return {
    getAll: vi.fn().mockResolvedValue(rows),
    crear: vi.fn(),
    editar: vi.fn(),
    cambiarEstado: vi.fn(),
    listarDepartamentos: vi.fn(),
    listarPermisos: vi.fn(),
  };
}

const fila = {
  id: 1,
  cedula: "12345678",
  nombres: "Ana",
  apellidos: "Pérez",
  correo: "ana.perez@conatel.gob.ve",
  telefono: null,
  departamentoId: 3,
  rolId: 2,
  isActive: true,
  debeCambiarPassword: false,
};

describe("listarUsuarios", () => {
  it("mapea las entidades del repositorio a DTOs para la UI", async () => {
    const repo = fakeRepo([fila]);

    const result = await listarUsuarios(repo);

    expect(repo.getAll).toHaveBeenCalledWith(undefined);
    expect(result).toEqual([fila]);
  });

  it("propaga los filtros al repositorio", async () => {
    const repo = fakeRepo();

    await listarUsuarios(repo, { busqueda: "Ana", departamentoId: 3, rolId: 2, isActive: true });

    expect(repo.getAll).toHaveBeenCalledWith({ busqueda: "Ana", departamentoId: 3, rolId: 2, isActive: true });
  });

  it("devuelve una lista vacía cuando el repositorio no trae filas", async () => {
    const repo = fakeRepo([]);

    const result = await listarUsuarios(repo);

    expect(result).toEqual([]);
  });

  it("propaga el error cuando el repositorio falla", async () => {
    const repo = fakeRepo();
    (repo.getAll as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("backend caído"));

    await expect(listarUsuarios(repo)).rejects.toThrow("backend caído");
  });
});
