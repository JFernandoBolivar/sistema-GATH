import { beforeEach, describe, expect, it, vi } from "vitest";

const { get, patch, post } = vi.hoisted(() => ({
  get: vi.fn(),
  patch: vi.fn(),
  post: vi.fn(),
}));

vi.mock("@/shared/infrastructure/http/fetcher-api", () => ({
  apiClient: { get, patch, post },
}));

import { reglasCatalogosApi } from "../infrastructure/http/reglas-catalogos-api";

beforeEach(() => {
  get.mockReset();
  patch.mockReset();
  post.mockReset();
});

describe("Módulo Configuración - Reglas de Catálogos (A5)", () => {
  it("API client obtiene todas las reglas de catálogos", async () => {
    get.mockResolvedValue({
      status: "success",
      message: "ok",
      data: {
        parentescos: [{ id: 1, descripcion: "HIJO(A)", aplica_familiar: true }],
        categorias_motivo: [{ id: 1, categoria: "INGRESO" }],
        motivos: [
          {
            id: 10,
            movimiento: "NUEVO INGRESO",
            categoria_id: 1,
            categoria_nombre: "INGRESO",
            es_reservado: false,
          },
        ],
        nominas: [{ id: 1, nomina: "EMPLEADOS", requiere_codig: true, es_activo: true }],
      },
    });

    const resultado = await reglasCatalogosApi.obtenerTodas();
    expect(get).toHaveBeenCalledWith("/api/v1/configuracion/reglas-catalogos/");
    expect(resultado.data.parentescos).toHaveLength(1);
    expect(resultado.data.motivos).toHaveLength(1);
    expect(resultado.data.nominas).toHaveLength(1);
  });

  it("API client actualiza marca de parentesco", async () => {
    patch.mockResolvedValue({
      status: "success",
      message: "ok",
      data: { id: 1, descripcion: "HIJO(A)", aplica_familiar: false },
    });

    const res = await reglasCatalogosApi.actualizarParentesco(1, false);
    expect(patch).toHaveBeenCalledWith(
      "/api/v1/configuracion/reglas-catalogos/parentescos/1/",
      { aplica_familiar: false },
    );
    expect(res.data.aplica_familiar).toBe(false);
  });

  it("API client transfiere motivo a nueva categoría", async () => {
    patch.mockResolvedValue({
      status: "success",
      message: "ok",
      data: {
        id: 10,
        movimiento: "NUEVO INGRESO",
        categoria_id: 2,
        categoria_nombre: "TRASLADO",
        es_reservado: false,
      },
    });

    const res = await reglasCatalogosApi.cambiarCategoriaMotivo(10, 2);
    expect(patch).toHaveBeenCalledWith(
      "/api/v1/configuracion/reglas-catalogos/motivos/10/categoria/",
      { categoria_id: 2 },
    );
    expect(res.data.categoria_id).toBe(2);
  });

  it("API client crea nuevo motivo en una categoría", async () => {
    post.mockResolvedValue({
      status: "success",
      message: "ok",
      data: {
        id: 20,
        movimiento: "CONTRATO DETERMINADO",
        categoria_id: 1,
        categoria_nombre: "INGRESO",
        es_reservado: false,
      },
    });

    const res = await reglasCatalogosApi.crearMotivo("CONTRATO DETERMINADO", 1);
    expect(post).toHaveBeenCalledWith(
      "/api/v1/configuracion/reglas-catalogos/motivos/",
      { movimiento: "CONTRATO DETERMINADO", categoria_id: 1 },
    );
    expect(res.data.id).toBe(20);
  });

  it("API client actualiza marcas de tipo de nómina", async () => {
    patch.mockResolvedValue({
      status: "success",
      message: "ok",
      data: { id: 1, nomina: "EMPLEADOS", requiere_codig: false, es_activo: true },
    });

    const res = await reglasCatalogosApi.actualizarNomina(1, { requiere_codig: false });
    expect(patch).toHaveBeenCalledWith(
      "/api/v1/configuracion/reglas-catalogos/nominas/1/",
      { requiere_codig: false },
    );
    expect(res.data.requiere_codig).toBe(false);
  });
});
