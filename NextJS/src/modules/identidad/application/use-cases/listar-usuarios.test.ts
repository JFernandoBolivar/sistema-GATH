import { describe, expect, it, vi } from "vitest";

import type { PaginaUsuariosEntity, RepoUsuarios } from "../../domain/ports/repo-usuarios";
import { listarUsuarios, obtenerDetalleUsuario } from "./listar-usuarios";

function fakeRepo(pagina: PaginaUsuariosEntity): RepoUsuarios {
  return {
    getAll: vi.fn().mockResolvedValue(pagina),
    obtenerDetalle: vi.fn(),
    crear: vi.fn(),
    editar: vi.fn(),
    cambiarEstado: vi.fn(),
    restablecerAcceso: vi.fn(),
    cambiarCorreoAcceso: vi.fn(),
    guardarOverrides: vi.fn(),
    matriz: vi.fn(),
    guardarMatriz: vi.fn(),
    listarPermisos: vi.fn(),
  };
}

const usuario = {
  id: 1,
  cedula: "12345678",
  nombres: "Ana",
  apellidos: "Pérez",
  correo: "ana.perez@conatel.gob.ve",
  telefono: null,
  rolId: 2,
  rolNombre: "ANALISTA",
  isActive: true,
  ultimoAcceso: null,
  condicion: "ACTIVO",
  passwordInicialPendiente: false,
};

const pagina: PaginaUsuariosEntity = {
  resultados: [usuario],
  total: 1,
  pagina: 1,
  tamano: 10,
  totalPaginas: 1,
};

describe("listarUsuarios", () => {
  it("mapea la página del repositorio al DTO de la UI", async () => {
    const repo = fakeRepo(pagina);

    const resultado = await listarUsuarios(repo);

    expect(repo.getAll).toHaveBeenCalledWith({
      cedula: undefined,
      nombre: undefined,
      correo: undefined,
      rolId: undefined,
      isActive: undefined,
      condicion: undefined,
      pagina: undefined,
      pageSize: undefined,
    });
    expect(resultado).toEqual({ ...pagina, resultados: [usuario] });
  });

  it("propaga los filtros y la paginación al repositorio", async () => {
    const repo = fakeRepo(pagina);

    await listarUsuarios(repo, {
      cedula: "123",
      nombre: "Ana",
      correo: "conatel",
      rolId: 2,
      isActive: true,
      condicion: "ACTIVO",
      pagina: 2,
      pageSize: 50,
    });

    expect(repo.getAll).toHaveBeenCalledWith({
      cedula: "123",
      nombre: "Ana",
      correo: "conatel",
      rolId: 2,
      isActive: true,
      condicion: "ACTIVO",
      pagina: 2,
      pageSize: 50,
    });
  });

  it("devuelve una página vacía sin filas", async () => {
    const repo = fakeRepo({ ...pagina, resultados: [], total: 0, totalPaginas: 1 });

    const resultado = await listarUsuarios(repo);

    expect(resultado.resultados).toEqual([]);
    expect(resultado.total).toBe(0);
  });

  it("propaga el error cuando el repositorio falla", async () => {
    const repo = fakeRepo(pagina);
    (repo.getAll as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("backend caído"));

    await expect(listarUsuarios(repo)).rejects.toThrow("backend caído");
  });
});

describe("obtenerDetalleUsuario", () => {
  it("expone el permiso efectivo calculado por el servidor", async () => {
    const repo = fakeRepo(pagina);
    (repo.obtenerDetalle as ReturnType<typeof vi.fn>).mockResolvedValue({
      usuario,
      permisos: {
        rolId: 2,
        rolNombre: "ANALISTA",
        delRol: ["identidad.ver_usuarios"],
        allow: ["personal.ver"],
        deny: ["identidad.ver_usuarios"],
        efectivos: ["personal.ver"],
        version: 3,
      },
    });

    const detalle = await obtenerDetalleUsuario(repo, 1);

    expect(detalle.permisos.efectivos).toEqual(["personal.ver"]);
    expect(detalle.permisos.deny).toEqual(["identidad.ver_usuarios"]);
    expect(detalle.permisos.version).toBe(3);
  });
});
